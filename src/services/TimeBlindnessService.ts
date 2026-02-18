/**
 * TimeBlindnessService - Helpers for ADHD time perception issues
 *
 * Time blindness is a common ADHD challenge where people have difficulty
 * perceiving the passage of time accurately.
 *
 * Features:
 * - Time anchors (important daily events)
 * - Relative time displays
 * - Periodic time reminders
 * - Visual time representations
 * - "How long ago" indicators
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type {
  TimeAnchor,
  TimeVisualization,
  TimeBlindnessSettings,
  DayOfWeek,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_time_blindness_settings',
  ANCHORS: 'nero_time_anchors',
};

const DAY_MAP: Record<DayOfWeek, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const DEFAULT_SETTINGS: TimeBlindnessSettings = {
  anchors: [],
  visualization: {
    type: 'countdown',
    showRemaining: true,
    showElapsed: true,
    colorCoded: true,
    soundAlerts: false,
    vibrationAlerts: true,
  },
  showRelativeTime: true,
  periodicTimeReminders: false,
  reminderIntervalMinutes: 30,
};

// Common time anchors people might use
const SUGGESTED_ANCHORS: Omit<TimeAnchor, 'id' | 'enabled'>[] = [
  { label: 'Morning routine', time: '08:00', isRecurring: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], reminderMinutes: 15 },
  { label: 'Lunch time', time: '12:00', isRecurring: true, reminderMinutes: 10 },
  { label: 'End of work day', time: '17:00', isRecurring: true, days: ['mon', 'tue', 'wed', 'thu', 'fri'], reminderMinutes: 15 },
  { label: 'Dinner time', time: '18:30', isRecurring: true, reminderMinutes: 10 },
  { label: 'Wind down time', time: '21:00', isRecurring: true, reminderMinutes: 30 },
  { label: 'Bedtime', time: '22:30', isRecurring: true, reminderMinutes: 30 },
];

export class TimeBlindnessService {
  private settings: TimeBlindnessSettings = DEFAULT_SETTINGS;
  private reminderInterval: NodeJS.Timeout | null = null;
  private onTimeReminder?: (message: string) => void;

  async initialize(): Promise<void> {
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }

      // Start periodic reminders if enabled
      if (this.settings.periodicTimeReminders) {
        this.startPeriodicReminders();
      }
    } catch (error) {
      console.error('Failed to initialize TimeBlindnessService:', error);
    }
  }

  // ============ TIME ANCHORS ============

  getAnchors(): TimeAnchor[] {
    return [...this.settings.anchors];
  }

  getActiveAnchors(): TimeAnchor[] {
    const now = new Date();
    const currentDay = now.getDay();
    const dayName = Object.entries(DAY_MAP).find(([_, num]) => num === currentDay)?.[0] as DayOfWeek;

    return this.settings.anchors.filter(anchor => {
      if (!anchor.enabled) return false;
      if (!anchor.isRecurring) return true;
      if (!anchor.days || anchor.days.length === 0) return true;
      return anchor.days.includes(dayName);
    });
  }

  async addAnchor(
    label: string,
    time: string,
    options?: {
      isRecurring?: boolean;
      days?: DayOfWeek[];
      reminderMinutes?: number;
    }
  ): Promise<TimeAnchor> {
    const anchor: TimeAnchor = {
      id: `anchor_${Date.now()}`,
      label,
      time,
      isRecurring: options?.isRecurring ?? true,
      days: options?.days,
      reminderMinutes: options?.reminderMinutes ?? 15,
      enabled: true,
    };

    this.settings.anchors.push(anchor);
    await this.saveSettings();
    return anchor;
  }

  async updateAnchor(anchorId: string, updates: Partial<TimeAnchor>): Promise<TimeAnchor | null> {
    const anchor = this.settings.anchors.find(a => a.id === anchorId);
    if (!anchor) return null;

    Object.assign(anchor, updates);
    await this.saveSettings();
    return anchor;
  }

  async removeAnchor(anchorId: string): Promise<boolean> {
    const initialLength = this.settings.anchors.length;
    this.settings.anchors = this.settings.anchors.filter(a => a.id !== anchorId);

    if (this.settings.anchors.length !== initialLength) {
      await this.saveSettings();
      return true;
    }
    return false;
  }

  async toggleAnchor(anchorId: string): Promise<boolean> {
    const anchor = this.settings.anchors.find(a => a.id === anchorId);
    if (!anchor) return false;

    anchor.enabled = !anchor.enabled;
    await this.saveSettings();
    return anchor.enabled;
  }

  getSuggestedAnchors(): typeof SUGGESTED_ANCHORS {
    return SUGGESTED_ANCHORS;
  }

  // ============ TIME CALCULATIONS ============

  getNextAnchor(): { anchor: TimeAnchor; minutesUntil: number } | null {
    const activeAnchors = this.getActiveAnchors();
    if (activeAnchors.length === 0) return null;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let closestAnchor: TimeAnchor | null = null;
    let minMinutes = Infinity;

    for (const anchor of activeAnchors) {
      const [hours, minutes] = anchor.time.split(':').map(n => parseInt(n, 10));
      const anchorMinutes = hours * 60 + minutes;

      let diff = anchorMinutes - currentMinutes;
      if (diff < 0) diff += 24 * 60; // Next day

      if (diff < minMinutes) {
        minMinutes = diff;
        closestAnchor = anchor;
      }
    }

    if (!closestAnchor) return null;

    return {
      anchor: closestAnchor,
      minutesUntil: minMinutes,
    };
  }

  getUpcomingAnchors(withinMinutes: number = 120): Array<{
    anchor: TimeAnchor;
    minutesUntil: number;
    shouldRemind: boolean;
  }> {
    const activeAnchors = this.getActiveAnchors();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const upcoming: Array<{
      anchor: TimeAnchor;
      minutesUntil: number;
      shouldRemind: boolean;
    }> = [];

    for (const anchor of activeAnchors) {
      const [hours, minutes] = anchor.time.split(':').map(n => parseInt(n, 10));
      const anchorMinutes = hours * 60 + minutes;

      let diff = anchorMinutes - currentMinutes;
      if (diff < 0) continue; // Already passed today

      if (diff <= withinMinutes) {
        upcoming.push({
          anchor,
          minutesUntil: diff,
          shouldRemind: diff <= anchor.reminderMinutes,
        });
      }
    }

    return upcoming.sort((a, b) => a.minutesUntil - b.minutesUntil);
  }

  // ============ RELATIVE TIME FORMATTING ============

  formatRelativeTime(timestamp: string | Date): string {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 0) {
      // Future time
      const futureMinutes = Math.abs(diffMinutes);
      if (futureMinutes < 60) return `in ${futureMinutes} min`;
      const futureHours = Math.floor(futureMinutes / 60);
      if (futureHours < 24) return `in ${futureHours} hour${futureHours > 1 ? 's' : ''}`;
      return `in ${Math.floor(futureHours / 24)} day${Math.floor(futureHours / 24) > 1 ? 's' : ''}`;
    }

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }

  formatTimeUntil(targetTime: string): string {
    const [hours, minutes] = targetTime.split(':').map(n => parseInt(n, 10));
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const diffMs = target.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    return this.formatDuration(diffMinutes);
  }

  // ============ VISUAL TIME REPRESENTATION ============

  getTimeProgress(startTime: string | Date, endTime: string | Date): number {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
    const now = new Date();

    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();

    if (totalDuration <= 0) return 1;
    return Math.max(0, Math.min(1, elapsed / totalDuration));
  }

  getTimeColor(minutesRemaining: number): string {
    // Color coding for urgency
    if (minutesRemaining <= 5) return '#FF6B6B'; // Red - urgent
    if (minutesRemaining <= 15) return '#FFE66D'; // Yellow - soon
    if (minutesRemaining <= 30) return '#4ECDC4'; // Teal - approaching
    return '#6C5CE7'; // Purple - plenty of time
  }

  getDayProgress(): number {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(7, 0, 0, 0); // Assuming day starts at 7 AM

    const endOfDay = new Date(now);
    endOfDay.setHours(22, 0, 0, 0); // Assuming day ends at 10 PM

    return this.getTimeProgress(startOfDay, endOfDay);
  }

  // ============ PERIODIC REMINDERS ============

  startPeriodicReminders(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
    }

    const intervalMs = this.settings.reminderIntervalMinutes * 60 * 1000;

    this.reminderInterval = setInterval(() => {
      this.sendTimeReminder();
    }, intervalMs);
  }

  stopPeriodicReminders(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }

  private async sendTimeReminder(): Promise<void> {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messages = [
      `It's ${timeString}`,
      `Time check: ${timeString}`,
      `🕐 ${timeString}`,
      `Current time: ${timeString}`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    // Haptic feedback
    if (this.settings.visualization.vibrationAlerts && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    // Callback to app
    if (this.onTimeReminder) {
      this.onTimeReminder(message);
    }
  }

  setTimeReminderCallback(callback: (message: string) => void): void {
    this.onTimeReminder = callback;
  }

  // ============ TIME PERCEPTION HELPERS ============

  /**
   * Estimate how long something will "feel" based on task type
   */
  getPerceivedDuration(actualMinutes: number, taskType: 'boring' | 'engaging' | 'neutral'): {
    perceived: string;
    explanation: string;
  } {
    let multiplier = 1;

    switch (taskType) {
      case 'boring':
        multiplier = 1.5; // Boring tasks feel longer
        break;
      case 'engaging':
        multiplier = 0.5; // Engaging tasks feel shorter (hyperfocus risk)
        break;
      default:
        multiplier = 1;
    }

    const perceivedMinutes = Math.round(actualMinutes * multiplier);

    let explanation = '';
    if (taskType === 'boring') {
      explanation = 'Boring tasks often feel 50% longer than they are';
    } else if (taskType === 'engaging') {
      explanation = '⚠️ Engaging tasks can pass twice as fast - set a timer!';
    }

    return {
      perceived: this.formatDuration(perceivedMinutes),
      explanation,
    };
  }

  /**
   * Generate "time landmarks" to help anchor perception
   */
  getTimeLandmarks(): Array<{
    label: string;
    time: string;
    isPast: boolean;
    minutesAway: number;
  }> {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const landmarks = [
      { label: 'Midnight', hour: 0 },
      { label: 'Early morning', hour: 6 },
      { label: 'Morning', hour: 9 },
      { label: 'Noon', hour: 12 },
      { label: 'Afternoon', hour: 15 },
      { label: 'Evening', hour: 18 },
      { label: 'Night', hour: 21 },
    ];

    return landmarks.map(lm => {
      const lmMinutes = lm.hour * 60;
      let diff = lmMinutes - currentMinutes;

      if (diff < -12 * 60) diff += 24 * 60; // Wrap around

      const isPast = diff < 0;

      return {
        label: lm.label,
        time: `${lm.hour.toString().padStart(2, '0')}:00`,
        isPast,
        minutesAway: Math.abs(diff),
      };
    });
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<TimeBlindnessSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };

    // Handle periodic reminder changes
    if ('periodicTimeReminders' in updates || 'reminderIntervalMinutes' in updates) {
      if (this.settings.periodicTimeReminders) {
        this.startPeriodicReminders();
      } else {
        this.stopPeriodicReminders();
      }
    }

    await this.saveSettings();
  }

  getSettings(): TimeBlindnessSettings {
    return { ...this.settings };
  }

  async updateVisualization(updates: Partial<TimeVisualization>): Promise<void> {
    this.settings.visualization = { ...this.settings.visualization, ...updates };
    await this.saveSettings();
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save time blindness settings:', error);
    }
  }

  // ============ CLEANUP ============

  cleanup(): void {
    this.stopPeriodicReminders();
  }
}

// Singleton instance
let serviceInstance: TimeBlindnessService | null = null;

export function getTimeBlindnessService(): TimeBlindnessService {
  if (!serviceInstance) {
    serviceInstance = new TimeBlindnessService();
  }
  return serviceInstance;
}

export async function initializeTimeBlindnessService(): Promise<TimeBlindnessService> {
  const service = getTimeBlindnessService();
  await service.initialize();
  return service;
}
