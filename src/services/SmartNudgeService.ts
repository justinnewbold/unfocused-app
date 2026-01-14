// Smart Nudge Scheduling Service
// Analyzes focus session history to identify optimal times,
// correlates with energy logs, and schedules intelligent nudges

import { supabase } from './supabase';

export interface OptimalTimeSlot {
  hour: number;
  confidence: number;
  reason: string;
  dayOfWeek?: number[];
}

export interface ScheduledNudge {
  id: string;
  userId: string;
  scheduledTime: string;
  type: 'focus_reminder' | 'energy_check' | 'task_suggestion' | 'break_reminder';
  message: string;
  enabled: boolean;
  repeatDays: number[]; // 0=Sunday, 1=Monday, etc.
}

export interface NudgeAnalysis {
  topTimes: OptimalTimeSlot[];
  lowEnergyPeriods: string[];
  recommendedNudges: ScheduledNudge[];
}

export class SmartNudgeService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // Analyze focus sessions to find best times
  async analyzeFocusPatterns(): Promise<{ hourly: Map<number, number>; daily: Map<number, number> }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sessions, error } = await supabase
      .from('nero_focus_sessions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('started_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    const hourlyProductivity = new Map<number, number>();
    const dailyProductivity = new Map<number, number>();

    (sessions || []).forEach(session => {
      const date = new Date(session.started_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const duration = session.duration_minutes || 0;

      hourlyProductivity.set(hour, (hourlyProductivity.get(hour) || 0) + duration);
      dailyProductivity.set(dayOfWeek, (dailyProductivity.get(dayOfWeek) || 0) + duration);
    });

    return { hourly: hourlyProductivity, daily: dailyProductivity };
  }

  // Analyze energy logs to correlate with productivity
  async analyzeEnergyPatterns(): Promise<Map<number, number>> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: energyLogs, error } = await supabase
      .from('nero_energy_logs')
      .select('*')
      .eq('user_id', this.userId)
      .gte('logged_at', thirtyDaysAgo.toISOString());

    if (error) throw error;

    const hourlyEnergy = new Map<number, { total: number; count: number }>();

    (energyLogs || []).forEach(log => {
      const date = new Date(log.logged_at);
      const hour = date.getHours();
      const current = hourlyEnergy.get(hour) || { total: 0, count: 0 };
      hourlyEnergy.set(hour, {
        total: current.total + (log.energy_level || 0),
        count: current.count + 1,
      });
    });

    // Calculate average energy per hour
    const averageEnergy = new Map<number, number>();
    hourlyEnergy.forEach((value, hour) => {
      averageEnergy.set(hour, value.count > 0 ? value.total / value.count : 0);
    });

    return averageEnergy;
  }

  // Find optimal time slots based on both focus and energy data
  async findOptimalTimeSlots(): Promise<OptimalTimeSlot[]> {
    const { hourly: focusHourly, daily: focusDaily } = await this.analyzeFocusPatterns();
    const energyHourly = await this.analyzeEnergyPatterns();

    const slots: OptimalTimeSlot[] = [];

    // Calculate scores for each hour
    const hourScores: { hour: number; score: number; focusMinutes: number; avgEnergy: number }[] = [];

    for (let hour = 6; hour <= 22; hour++) {
      const focusMinutes = focusHourly.get(hour) || 0;
      const avgEnergy = energyHourly.get(hour) || 5; // Default to medium energy

      // Weighted score: focus history (60%) + energy (40%)
      const normalizedFocus = focusMinutes / (Math.max(...Array.from(focusHourly.values())) || 1);
      const normalizedEnergy = avgEnergy / 10;
      const score = normalizedFocus * 0.6 + normalizedEnergy * 0.4;

      hourScores.push({ hour, score, focusMinutes, avgEnergy });
    }

    // Sort by score and get top 3
    hourScores.sort((a, b) => b.score - a.score);
    const topHours = hourScores.slice(0, 3);

    topHours.forEach((item, index) => {
      const timeLabel = this.formatHour(item.hour);
      const confidence = Math.round(item.score * 100);

      let reason = '';
      if (item.focusMinutes > 0 && item.avgEnergy >= 7) {
        reason = `You've had ${Math.round(item.focusMinutes)} minutes of focus here with high energy`;
      } else if (item.focusMinutes > 0) {
        reason = `You've successfully focused here ${Math.round(item.focusMinutes / 25)} times`;
      } else if (item.avgEnergy >= 7) {
        reason = `Your energy tends to be high around this time`;
      } else {
        reason = `Based on typical patterns for your schedule`;
      }

      // Find best days for this hour
      const bestDays = Array.from(focusDaily.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([day]) => day);

      slots.push({
        hour: item.hour,
        confidence,
        reason,
        dayOfWeek: bestDays,
      });
    });

    return slots;
  }

  // Format hour for display
  private formatHour(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  // Generate recommended nudge schedule
  async generateRecommendedNudges(): Promise<ScheduledNudge[]> {
    const optimalSlots = await this.findOptimalTimeSlots();
    const nudges: ScheduledNudge[] = [];

    // Create focus reminder for best time
    if (optimalSlots[0]) {
      nudges.push({
        id: `nudge_focus_${Date.now()}`,
        userId: this.userId,
        scheduledTime: `${optimalSlots[0].hour.toString().padStart(2, '0')}:00`,
        type: 'focus_reminder',
        message: `Hey! This is usually a great time for you to focus. Ready to start a session?`,
        enabled: true,
        repeatDays: optimalSlots[0].dayOfWeek || [1, 2, 3, 4, 5], // Weekdays default
      });
    }

    // Create energy check for second best time
    if (optimalSlots[1]) {
      nudges.push({
        id: `nudge_energy_${Date.now()}`,
        userId: this.userId,
        scheduledTime: `${optimalSlots[1].hour.toString().padStart(2, '0')}:00`,
        type: 'energy_check',
        message: `Quick check-in: How's your energy right now?`,
        enabled: true,
        repeatDays: [1, 2, 3, 4, 5],
      });
    }

    // Create afternoon task suggestion
    nudges.push({
      id: `nudge_afternoon_${Date.now()}`,
      userId: this.userId,
      scheduledTime: '14:00',
      type: 'task_suggestion',
      message: `Afternoon slump? Here's a quick win you could tackle right now.`,
      enabled: true,
      repeatDays: [1, 2, 3, 4, 5],
    });

    return nudges;
  }

  // Save nudge to database
  async saveNudge(nudge: ScheduledNudge): Promise<void> {
    const { error } = await supabase
      .from('nero_nudges')
      .upsert({
        id: nudge.id,
        user_id: nudge.userId,
        scheduled_time: nudge.scheduledTime,
        type: nudge.type,
        message: nudge.message,
        enabled: nudge.enabled,
        repeat_days: nudge.repeatDays,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  // Get all scheduled nudges for user
  async getScheduledNudges(): Promise<ScheduledNudge[]> {
    const { data, error } = await supabase
      .from('nero_nudges')
      .select('*')
      .eq('user_id', this.userId)
      .eq('enabled', true);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      scheduledTime: row.scheduled_time,
      type: row.type,
      message: row.message,
      enabled: row.enabled,
      repeatDays: row.repeat_days,
    }));
  }

  // Toggle nudge enabled state
  async toggleNudge(nudgeId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase
      .from('nero_nudges')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('id', nudgeId)
      .eq('user_id', this.userId);

    if (error) throw error;
  }

  // Delete a nudge
  async deleteNudge(nudgeId: string): Promise<void> {
    const { error } = await supabase
      .from('nero_nudges')
      .delete()
      .eq('id', nudgeId)
      .eq('user_id', this.userId);

    if (error) throw error;
  }

  // Check if any nudge should fire now
  shouldFireNudge(nudge: ScheduledNudge): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if today is in repeat days
    if (!nudge.repeatDays.includes(currentDay)) {
      return false;
    }

    // Parse scheduled time
    const [scheduledHour, scheduledMinute] = nudge.scheduledTime.split(':').map(Number);

    // Check if within 5-minute window
    const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    return Math.abs(scheduledMinutes - currentMinutes) <= 5;
  }

  // Get task suggestion based on current context
  async getTaskSuggestion(): Promise<{ task: string; reason: string } | null> {
    const { data: tasks, error } = await supabase
      .from('nero_tasks')
      .select('*')
      .eq('user_id', this.userId)
      .eq('completed', false)
      .order('created_at', { ascending: true })
      .limit(5);

    if (error || !tasks?.length) return null;

    // Find quickest/easiest task (by estimated time or first created)
    const quickTask = tasks.find(t => t.estimated_minutes && t.estimated_minutes <= 15) || tasks[0];

    return {
      task: quickTask.title,
      reason: quickTask.estimated_minutes 
        ? `It's a quick one - about ${quickTask.estimated_minutes} minutes` 
        : `It's been waiting for a bit - let's knock it out!`,
    };
  }
}

export default SmartNudgeService;
