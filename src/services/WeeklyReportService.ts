// Weekly Focus Report Service
// Auto-generates weekly summaries showing sessions, focus time, completed tasks,
// and comparisons to previous weeks with percentage changes

import { supabase } from './supabase';

export interface WeeklyReportData {
  weekStart: string;
  weekEnd: string;
  sessionCount: number;
  totalFocusMinutes: number;
  tasksCompleted: number;
  bestDay: string;
  bestTimeOfDay: string;
  comparison: {
    sessionChange: number;
    focusTimeChange: number;
    tasksChange: number;
  };
  summary: string;
}

export interface DailyStats {
  day: string;
  dayName: string;
  sessions: number;
  focusMinutes: number;
  tasks: number;
}

export class WeeklyReportService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // Get the start of the current week (Monday)
  private getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Get the end of the week (Sunday)
  private getWeekEnd(weekStart: Date): Date {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // Fetch focus sessions for a date range
  async getFocusSessions(startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('nero_focus_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString());

    if (error) throw error;
    return data || [];
  }

  // Fetch completed tasks for a date range
  async getCompletedTasks(startDate: Date, endDate: Date) {
    const { data, error } = await supabase
      .from('nero_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .eq('completed', true)
      .gte('completed_at', startDate.toISOString())
      .lte('completed_at', endDate.toISOString());

    if (error) throw error;
    return data || [];
  }

  // Calculate daily stats
  calculateDailyStats(sessions: any[], tasks: any[], weekStart: Date): DailyStats[] {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const stats: DailyStats[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dayStr = dayDate.toISOString().split('T')[0];

      const daySessions = sessions.filter(s => 
        s.started_at.startsWith(dayStr)
      );
      const dayTasks = tasks.filter(t => 
        t.completed_at?.startsWith(dayStr)
      );

      stats.push({
        day: dayStr,
        dayName: dayNames[i],
        sessions: daySessions.length,
        focusMinutes: daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
        tasks: dayTasks.length,
      });
    }

    return stats;
  }

  // Find best day and time
  findBestDayAndTime(sessions: any[]): { bestDay: string; bestTimeOfDay: string } {
    if (sessions.length === 0) {
      return { bestDay: 'Not enough data', bestTimeOfDay: 'Not enough data' };
    }

    // Group by day of week
    const dayGroups: { [key: string]: number } = {};
    const hourGroups: { [key: number]: number } = {};

    sessions.forEach(session => {
      const date = new Date(session.started_at);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      const hour = date.getHours();

      dayGroups[dayName] = (dayGroups[dayName] || 0) + (session.duration_minutes || 0);
      hourGroups[hour] = (hourGroups[hour] || 0) + (session.duration_minutes || 0);
    });

    // Find best day
    const bestDay = Object.entries(dayGroups)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

    // Find best time range
    const bestHour = Object.entries(hourGroups)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    
    const hour = parseInt(bestHour || '9');
    let bestTimeOfDay: string;
    if (hour < 12) bestTimeOfDay = 'Morning';
    else if (hour < 17) bestTimeOfDay = 'Afternoon';
    else if (hour < 21) bestTimeOfDay = 'Evening';
    else bestTimeOfDay = 'Night';

    return { bestDay, bestTimeOfDay };
  }

  // Generate natural language summary
  generateSummary(data: Partial<WeeklyReportData>, dailyStats: DailyStats[]): string {
    const { sessionCount = 0, totalFocusMinutes = 0, tasksCompleted = 0, comparison, bestDay, bestTimeOfDay } = data;

    const hours = Math.floor(totalFocusMinutes / 60);
    const mins = totalFocusMinutes % 60;
    const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;

    let summary = `This week you had ${sessionCount} focus sessions totaling ${timeStr}`;
    
    if (tasksCompleted > 0) {
      summary += ` and completed ${tasksCompleted} task${tasksCompleted > 1 ? 's' : ''}`;
    }
    summary += '. ';

    if (comparison) {
      if (comparison.focusTimeChange > 0) {
        summary += `That's ${comparison.focusTimeChange}% more focus time than last week! 🎉 `;
      } else if (comparison.focusTimeChange < 0) {
        summary += `Focus time was down ${Math.abs(comparison.focusTimeChange)}% from last week, but that's okay - some weeks are like that. `;
      }
    }

    if (bestDay && bestDay !== 'Not enough data') {
      summary += `Your best day was ${bestDay}`;
      if (bestTimeOfDay && bestTimeOfDay !== 'Not enough data') {
        summary += ` and you focus best in the ${bestTimeOfDay.toLowerCase()}`;
      }
      summary += '.';
    }

    return summary;
  }

  // Main method to generate the weekly report
  async generateWeeklyReport(forDate: Date = new Date()): Promise<WeeklyReportData> {
    const currentWeekStart = this.getWeekStart(forDate);
    const currentWeekEnd = this.getWeekEnd(currentWeekStart);
    
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = this.getWeekEnd(previousWeekStart);

    // Fetch current week data
    const currentSessions = await this.getFocusSessions(currentWeekStart, currentWeekEnd);
    const currentTasks = await this.getCompletedTasks(currentWeekStart, currentWeekEnd);

    // Fetch previous week data for comparison
    const previousSessions = await this.getFocusSessions(previousWeekStart, previousWeekEnd);
    const previousTasks = await this.getCompletedTasks(previousWeekStart, previousWeekEnd);

    // Calculate stats
    const dailyStats = this.calculateDailyStats(currentSessions, currentTasks, currentWeekStart);
    const { bestDay, bestTimeOfDay } = this.findBestDayAndTime(currentSessions);

    const currentFocusMinutes = currentSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    const previousFocusMinutes = previousSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const comparison = {
      sessionChange: calcChange(currentSessions.length, previousSessions.length),
      focusTimeChange: calcChange(currentFocusMinutes, previousFocusMinutes),
      tasksChange: calcChange(currentTasks.length, previousTasks.length),
    };

    const reportData: Partial<WeeklyReportData> = {
      weekStart: currentWeekStart.toISOString().split('T')[0],
      weekEnd: currentWeekEnd.toISOString().split('T')[0],
      sessionCount: currentSessions.length,
      totalFocusMinutes: currentFocusMinutes,
      tasksCompleted: currentTasks.length,
      bestDay,
      bestTimeOfDay,
      comparison,
    };

    const summary = this.generateSummary(reportData, dailyStats);

    return {
      ...reportData,
      summary,
    } as WeeklyReportData;
  }

  // Check if it's time to show the weekly report (Monday morning)
  shouldShowWeeklyReport(): boolean {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    
    // Show on Monday (1) between 6am and 10am
    return dayOfWeek === 1 && hour >= 6 && hour <= 10;
  }
}

export default WeeklyReportService;
