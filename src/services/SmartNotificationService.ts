import {
  NotificationHistoryEntry,
  SmartNotificationContext,
  EnergyLevel,
  MoodLevel,
  CompletionRecord,
  NotificationStyle
} from '../types';
import { genId, NOTIFICATION_MESSAGES, C } from '../constants';
import { Platform } from 'react-native';

// ============ SMART NOTIFICATION SERVICE ============
// Optimizes notification timing based on user patterns
export class SmartNotificationService {
  private style: NotificationStyle = 'gentle';
  private enabled: boolean = true;
  private timers: NodeJS.Timeout[] = [];
  private notificationHistory: NotificationHistoryEntry[] = [];
  private completionHistory: CompletionRecord[] = [];
  private peakHours: number[] = [];
  private optimalNotificationTimes: number[] = [];
  private quietHoursStart: number = 22; // 10 PM
  private quietHoursEnd: number = 8; // 8 AM

  setStyle(style: NotificationStyle) {
    this.style = style;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setCompletionHistory(history: CompletionRecord[]) {
    this.completionHistory = history;
    this.analyzeOptimalTimes();
  }

  setNotificationHistory(history: NotificationHistoryEntry[]) {
    this.notificationHistory = history;
    this.analyzeOptimalTimes();
  }

  getNotificationHistory(): NotificationHistoryEntry[] {
    return this.notificationHistory;
  }

  private analyzeOptimalTimes() {
    // Find times when notifications led to action
    const effectiveNotifications = this.notificationHistory.filter(n => n.actionTaken);

    const hourCounts: Record<number, number> = {};
    effectiveNotifications.forEach(n => {
      const hour = new Date(n.sentAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find completion patterns
    const completionHours: Record<number, number> = {};
    this.completionHistory.forEach(c => {
      const hour = new Date(c.completedAt).getHours();
      completionHours[hour] = (completionHours[hour] || 0) + 1;
    });

    // Combine data to find optimal notification times
    // Best time to notify is slightly before peak productivity
    const productivityByHour = Object.entries(completionHours)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    this.peakHours = productivityByHour.slice(0, 3).map(h => h.hour);

    // Optimal notification times are 15-30 min before peak hours
    this.optimalNotificationTimes = this.peakHours.map(h => {
      const notifyHour = h > 0 ? h - 1 : 23;
      return notifyHour;
    });
  }

  isQuietHours(): boolean {
    const currentHour = new Date().getHours();
    if (this.quietHoursStart > this.quietHoursEnd) {
      // Quiet hours span midnight
      return currentHour >= this.quietHoursStart || currentHour < this.quietHoursEnd;
    }
    return currentHour >= this.quietHoursStart && currentHour < this.quietHoursEnd;
  }

  shouldSendNotification(
    energy: EnergyLevel | null,
    mood: MoodLevel | null
  ): boolean {
    if (!this.enabled) return false;
    if (this.isQuietHours()) return false;

    const currentHour = new Date().getHours();

    // Check for notification fatigue (max 3 per hour)
    const recentNotifications = this.notificationHistory.filter(n => {
      const sentTime = new Date(n.sentAt).getTime();
      return Date.now() - sentTime < 60 * 60 * 1000;
    });
    if (recentNotifications.length >= 3) return false;

    // Check if recently dismissed without action
    const recentDismissed = this.notificationHistory.filter(n => {
      const sentTime = new Date(n.sentAt).getTime();
      return n.dismissed && !n.actionTaken && Date.now() - sentTime < 30 * 60 * 1000;
    });
    if (recentDismissed.length >= 2) return false;

    // Be more gentle during low mood
    if (mood === 'low') {
      this.style = 'gentle';
    }

    return true;
  }

  getOptimalDelay(): number {
    const currentHour = new Date().getHours();

    // If it's an optimal time, send now (within 5 minutes)
    if (this.optimalNotificationTimes.includes(currentHour)) {
      return Math.random() * 5 * 60 * 1000; // 0-5 minutes
    }

    // Variable timing based on style
    if (this.style === 'variable') {
      // Random delays that are harder to predict/ignore
      const delays = [5, 12, 23, 37, 52, 73].map(m => m * 60 * 1000);
      return delays[Math.floor(Math.random() * delays.length)];
    }

    if (this.style === 'persistent') {
      // More regular, shorter intervals
      return [15, 30, 45].map(m => m * 60 * 1000)[Math.floor(Math.random() * 3)];
    }

    // Gentle - longer, more spaced out
    return [30, 45, 60, 90].map(m => m * 60 * 1000)[Math.floor(Math.random() * 4)];
  }

  getSmartMessage(
    taskTitle: string | null,
    energy: EnergyLevel | null,
    mood: MoodLevel | null
  ): string {
    let baseMessage = NOTIFICATION_MESSAGES[this.style][
      Math.floor(Math.random() * NOTIFICATION_MESSAGES[this.style].length)
    ];

    // Customize based on context
    if (mood === 'low') {
      baseMessage = [
        "No pressure, just a gentle nudge 💙",
        "Take it easy. One tiny step counts.",
        "Here when you're ready. No rush.",
      ][Math.floor(Math.random() * 3)];
    }

    if (energy === 'high' && this.peakHours.includes(new Date().getHours())) {
      baseMessage = [
        "⚡ Peak energy detected! Perfect time to tackle something!",
        "🚀 You're in the zone! What's the biggest thing you could do?",
        "💪 High energy hour - make it count!",
      ][Math.floor(Math.random() * 3)];
    }

    if (taskTitle) {
      baseMessage += ` Task: ${taskTitle}`;
    }

    return baseMessage;
  }

  scheduleSmartNotification(
    title: string,
    taskTitle: string | null,
    energy: EnergyLevel | null,
    mood: MoodLevel | null
  ): string | null {
    if (!this.shouldSendNotification(energy, mood)) return null;

    const delay = this.getOptimalDelay();
    const message = this.getSmartMessage(taskTitle, energy, mood);
    const notificationId = genId();

    // Record in history
    const entry: NotificationHistoryEntry = {
      id: notificationId,
      type: 'smart_reminder',
      sentAt: new Date(Date.now() + delay).toISOString(),
      dismissed: false,
      actionTaken: false,
    };
    this.notificationHistory.push(entry);

    // Schedule the notification
    if (Platform.OS === 'web' && 'Notification' in window) {
      const timer = setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification(title, { body: message, icon: '🧠' });
        }
      }, delay);
      this.timers.push(timer);
    }

    return notificationId;
  }

  recordNotificationResponse(notificationId: string, actionTaken: boolean) {
    const notification = this.notificationHistory.find(n => n.id === notificationId);
    if (notification) {
      notification.acknowledgedAt = new Date().toISOString();
      notification.dismissed = !actionTaken;
      notification.actionTaken = actionTaken;
    }

    // Re-analyze after new data
    this.analyzeOptimalTimes();
  }

  getNotificationEffectiveness(): {
    totalSent: number;
    actionRate: number;
    bestHour: number;
    worstHour: number;
  } {
    const total = this.notificationHistory.length;
    const actioned = this.notificationHistory.filter(n => n.actionTaken).length;

    const actionsByHour: Record<number, { sent: number; actioned: number }> = {};

    this.notificationHistory.forEach(n => {
      const hour = new Date(n.sentAt).getHours();
      if (!actionsByHour[hour]) {
        actionsByHour[hour] = { sent: 0, actioned: 0 };
      }
      actionsByHour[hour].sent++;
      if (n.actionTaken) {
        actionsByHour[hour].actioned++;
      }
    });

    let bestHour = 9;
    let worstHour = 14;
    let bestRate = 0;
    let worstRate = 1;

    Object.entries(actionsByHour).forEach(([hour, data]) => {
      if (data.sent > 2) { // Need minimum data
        const rate = data.actioned / data.sent;
        if (rate > bestRate) {
          bestRate = rate;
          bestHour = parseInt(hour);
        }
        if (rate < worstRate) {
          worstRate = rate;
          worstHour = parseInt(hour);
        }
      }
    });

    return {
      totalSent: total,
      actionRate: total > 0 ? actioned / total : 0,
      bestHour,
      worstHour,
    };
  }

  clearAll() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
}
