/**
 * ScreenTimeService - App usage awareness
 *
 * Features:
 * - Track time spent in app
 * - Daily/weekly usage reports
 * - Usage pattern analysis
 * - Alerts if app usage becomes excessive
 * - Healthy usage recommendations
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const STORAGE_KEY = 'nero_screen_time';

export interface UsageSession {
  id: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  activeScreens: string[];
  tasksCompleted: number;
  focusSessionsCompleted: number;
}

export interface DailyUsage {
  date: string;
  totalMinutes: number;
  sessions: number;
  avgSessionMinutes: number;
  longestSessionMinutes: number;
  tasksCompleted: number;
  focusSessionsCompleted: number;
  peakUsageHour: number;
  usageByHour: Record<number, number>;
}

export interface ScreenTimeSettings {
  enabled: boolean;
  dailyGoalMinutes: number;
  maxSessionMinutes: number;
  showUsageAlerts: boolean;
  alertThresholdMinutes: number;
  weeklyReportEnabled: boolean;
  trackScreens: boolean;
}

const DEFAULT_SETTINGS: ScreenTimeSettings = {
  enabled: true,
  dailyGoalMinutes: 60, // Healthy target
  maxSessionMinutes: 90,
  showUsageAlerts: true,
  alertThresholdMinutes: 120,
  weeklyReportEnabled: true,
  trackScreens: true,
};

export class ScreenTimeService {
  private settings: ScreenTimeSettings = DEFAULT_SETTINGS;
  private sessions: UsageSession[] = [];
  private currentSession: UsageSession | null = null;
  private dailyUsage: Map<string, DailyUsage> = new Map();
  private appStateSubscription: any = null;
  private sessionTimer: NodeJS.Timeout | null = null;
  private screensVisited: Set<string> = new Set();

  // Callbacks
  private onUsageAlert?: (message: string, minutes: number) => void;

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        this.sessions = parsed.sessions || [];
        this.dailyUsage = new Map(Object.entries(parsed.dailyUsage || {}));
      }

      // Start tracking
      this.startSession();
      this.setupAppStateListener();
    } catch (error) {
      console.error('Failed to initialize ScreenTimeService:', error);
    }
  }

  // ============ SESSION TRACKING ============

  private startSession(): void {
    if (this.currentSession) return;

    this.currentSession = {
      id: `session_${Date.now()}`,
      startTime: new Date().toISOString(),
      activeScreens: [],
      tasksCompleted: 0,
      focusSessionsCompleted: 0,
    };

    this.screensVisited.clear();

    // Start timer for alerts
    if (this.settings.showUsageAlerts) {
      this.startSessionTimer();
    }
  }

  private async endSession(): Promise<void> {
    if (!this.currentSession) return;

    const endTime = new Date();
    const startTime = new Date(this.currentSession.startTime);
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60)
    );

    this.currentSession.endTime = endTime.toISOString();
    this.currentSession.durationMinutes = durationMinutes;
    this.currentSession.activeScreens = Array.from(this.screensVisited);

    // Only save sessions longer than 1 minute
    if (durationMinutes >= 1) {
      this.sessions.push(this.currentSession);
      await this.updateDailyUsage(this.currentSession);
    }

    this.currentSession = null;
    this.stopSessionTimer();
    await this.saveData();
  }

  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          this.startSession();
        } else if (state === 'background' || state === 'inactive') {
          this.endSession();
        }
      }
    );
  }

  // ============ USAGE ALERTS ============

  private startSessionTimer(): void {
    this.stopSessionTimer();

    // Check every minute
    this.sessionTimer = setInterval(() => {
      this.checkUsageAlerts();
    }, 60 * 1000);
  }

  private stopSessionTimer(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private checkUsageAlerts(): void {
    if (!this.currentSession || !this.settings.showUsageAlerts) return;

    const currentMinutes = this.getCurrentSessionMinutes();
    const todayMinutes = this.getTodayUsage().totalMinutes + currentMinutes;

    // Session length alert
    if (currentMinutes >= this.settings.maxSessionMinutes) {
      this.onUsageAlert?.(
        `You've been using the app for ${currentMinutes} minutes. Consider taking a break!`,
        currentMinutes
      );
    }

    // Daily limit alert
    if (todayMinutes >= this.settings.alertThresholdMinutes) {
      this.onUsageAlert?.(
        `You've used the app for ${todayMinutes} minutes today. That's more than usual!`,
        todayMinutes
      );
    }
  }

  getCurrentSessionMinutes(): number {
    if (!this.currentSession) return 0;

    const now = new Date();
    const start = new Date(this.currentSession.startTime);
    return Math.round((now.getTime() - start.getTime()) / (1000 * 60));
  }

  // ============ SCREEN TRACKING ============

  trackScreenVisit(screenName: string): void {
    if (!this.settings.trackScreens) return;

    this.screensVisited.add(screenName);
  }

  recordTaskCompletion(): void {
    if (this.currentSession) {
      this.currentSession.tasksCompleted++;
    }
  }

  recordFocusSession(): void {
    if (this.currentSession) {
      this.currentSession.focusSessionsCompleted++;
    }
  }

  // ============ DAILY USAGE ============

  private async updateDailyUsage(session: UsageSession): Promise<void> {
    const date = session.startTime.split('T')[0];
    const hour = new Date(session.startTime).getHours();

    let daily = this.dailyUsage.get(date);
    if (!daily) {
      daily = {
        date,
        totalMinutes: 0,
        sessions: 0,
        avgSessionMinutes: 0,
        longestSessionMinutes: 0,
        tasksCompleted: 0,
        focusSessionsCompleted: 0,
        peakUsageHour: hour,
        usageByHour: {},
      };
    }

    // Update stats
    daily.totalMinutes += session.durationMinutes || 0;
    daily.sessions++;
    daily.avgSessionMinutes = Math.round(daily.totalMinutes / daily.sessions);
    daily.longestSessionMinutes = Math.max(
      daily.longestSessionMinutes,
      session.durationMinutes || 0
    );
    daily.tasksCompleted += session.tasksCompleted;
    daily.focusSessionsCompleted += session.focusSessionsCompleted;

    // Track by hour
    daily.usageByHour[hour] = (daily.usageByHour[hour] || 0) + (session.durationMinutes || 0);

    // Find peak hour
    let maxHourMinutes = 0;
    for (const [h, minutes] of Object.entries(daily.usageByHour)) {
      if (minutes > maxHourMinutes) {
        maxHourMinutes = minutes;
        daily.peakUsageHour = parseInt(h);
      }
    }

    this.dailyUsage.set(date, daily);
    await this.saveData();
  }

  getTodayUsage(): DailyUsage {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyUsage.get(today) || {
      date: today,
      totalMinutes: 0,
      sessions: 0,
      avgSessionMinutes: 0,
      longestSessionMinutes: 0,
      tasksCompleted: 0,
      focusSessionsCompleted: 0,
      peakUsageHour: 0,
      usageByHour: {},
    };
  }

  getWeekUsage(): DailyUsage[] {
    const week: DailyUsage[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const usage = this.dailyUsage.get(dateStr);

      week.push(usage || {
        date: dateStr,
        totalMinutes: 0,
        sessions: 0,
        avgSessionMinutes: 0,
        longestSessionMinutes: 0,
        tasksCompleted: 0,
        focusSessionsCompleted: 0,
        peakUsageHour: 0,
        usageByHour: {},
      });
    }

    return week;
  }

  // ============ STATISTICS ============

  getStatistics(): {
    todayMinutes: number;
    weeklyAvgMinutes: number;
    totalTasksCompleted: number;
    totalFocusSessions: number;
    avgSessionLength: number;
    mostActiveDay: string;
    mostActiveHour: number;
    productivityRatio: number;
  } {
    const weekUsage = this.getWeekUsage();
    const todayUsage = this.getTodayUsage();

    const weeklyTotal = weekUsage.reduce((sum, d) => sum + d.totalMinutes, 0);
    const daysWithUsage = weekUsage.filter(d => d.totalMinutes > 0).length;
    const weeklyAvg = daysWithUsage > 0 ? Math.round(weeklyTotal / daysWithUsage) : 0;

    // Find most active day
    const mostActiveUsage = weekUsage.reduce(
      (max, d) => d.totalMinutes > max.totalMinutes ? d : max,
      weekUsage[0]
    );

    // Calculate productivity ratio (tasks per hour of usage)
    const totalMinutes = weekUsage.reduce((sum, d) => sum + d.totalMinutes, 0);
    const totalTasks = weekUsage.reduce((sum, d) => sum + d.tasksCompleted, 0);
    const productivityRatio = totalMinutes > 0
      ? Math.round((totalTasks / (totalMinutes / 60)) * 10) / 10
      : 0;

    return {
      todayMinutes: todayUsage.totalMinutes + this.getCurrentSessionMinutes(),
      weeklyAvgMinutes: weeklyAvg,
      totalTasksCompleted: totalTasks,
      totalFocusSessions: weekUsage.reduce((sum, d) => sum + d.focusSessionsCompleted, 0),
      avgSessionLength: todayUsage.avgSessionMinutes,
      mostActiveDay: this.getDayName(new Date(mostActiveUsage.date).getDay()),
      mostActiveHour: todayUsage.peakUsageHour,
      productivityRatio,
    };
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  }

  // ============ INSIGHTS ============

  getInsights(): string[] {
    const insights: string[] = [];
    const stats = this.getStatistics();
    const todayUsage = this.getTodayUsage();

    // Usage level insight
    if (stats.todayMinutes > this.settings.alertThresholdMinutes) {
      insights.push(`📱 Heavy usage today (${stats.todayMinutes} min). Consider a screen break!`);
    } else if (stats.todayMinutes < this.settings.dailyGoalMinutes && todayUsage.tasksCompleted > 0) {
      insights.push(`✨ Efficient session! ${todayUsage.tasksCompleted} tasks in ${stats.todayMinutes} min`);
    }

    // Productivity insight
    if (stats.productivityRatio >= 2) {
      insights.push(`🚀 Great productivity! ${stats.productivityRatio} tasks per hour of app time`);
    } else if (stats.productivityRatio < 0.5 && stats.todayMinutes > 30) {
      insights.push(`💡 Try using Focus Mode to complete more tasks`);
    }

    // Peak hour insight
    if (stats.mostActiveHour >= 22 || stats.mostActiveHour < 6) {
      insights.push(`🌙 You use the app most at night. Consider earlier planning sessions.`);
    }

    // Weekly comparison
    const weekUsage = this.getWeekUsage();
    const firstHalfTotal = weekUsage.slice(0, 4).reduce((s, d) => s + d.totalMinutes, 0);
    const thisWeekTotal = weekUsage.slice(4).reduce((s, d) => s + d.totalMinutes, 0);
    if (thisWeekTotal > firstHalfTotal * 1.5 && firstHalfTotal > 0) {
      insights.push(`📈 App usage up 50% this week. Everything okay?`);
    }

    return insights;
  }

  // ============ GOAL TRACKING ============

  getDailyGoalProgress(): {
    current: number;
    goal: number;
    percentage: number;
    isOverGoal: boolean;
    status: 'under' | 'optimal' | 'over';
  } {
    const current = this.getTodayUsage().totalMinutes + this.getCurrentSessionMinutes();
    const goal = this.settings.dailyGoalMinutes;
    const percentage = Math.round((current / goal) * 100);

    let status: 'under' | 'optimal' | 'over' = 'under';
    if (percentage >= 80 && percentage <= 120) {
      status = 'optimal';
    } else if (percentage > 120) {
      status = 'over';
    }

    return {
      current,
      goal,
      percentage: Math.min(percentage, 200), // Cap at 200% for display
      isOverGoal: current > goal,
      status,
    };
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<ScreenTimeSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveData();
  }

  getSettings(): ScreenTimeSettings {
    return { ...this.settings };
  }

  setOnUsageAlert(callback: (message: string, minutes: number) => void): void {
    this.onUsageAlert = callback;
  }

  // ============ STORAGE ============

  private async saveData(): Promise<void> {
    try {
      // Keep last 30 days of daily usage
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];

      const filteredUsage: Record<string, DailyUsage> = {};
      for (const [date, usage] of this.dailyUsage) {
        if (date >= cutoffStr) {
          filteredUsage[date] = usage;
        }
      }

      const data = {
        settings: this.settings,
        sessions: this.sessions.slice(-100), // Keep last 100 sessions
        dailyUsage: filteredUsage,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save screen time data:', error);
    }
  }

  // ============ CLEANUP ============

  cleanup(): void {
    this.endSession();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.stopSessionTimer();
  }
}

// Singleton instance
let serviceInstance: ScreenTimeService | null = null;

export function getScreenTimeService(): ScreenTimeService {
  if (!serviceInstance) {
    serviceInstance = new ScreenTimeService();
  }
  return serviceInstance;
}

export async function initializeScreenTimeService(): Promise<ScreenTimeService> {
  const service = getScreenTimeService();
  await service.initialize();
  return service;
}
