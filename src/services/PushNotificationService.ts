/**
 * PushNotificationService - Native push notifications for Smart Nudges
 * 
 * Connects the Smart Nudge system to actual device notifications.
 * Uses Expo Notifications for cross-platform support.
 * 
 * Features:
 * - Register for push notifications
 * - Schedule local notifications based on nudge times
 * - Handle notification responses (deep linking)
 * - Manage notification permissions gracefully
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export type NudgeNotificationType = 
  | 'focus_time'      // It's your optimal focus time
  | 'energy_check'    // Time to check your energy
  | 'task_reminder'   // Reminder about a specific task
  | 'break_time'      // You've been focused, take a break
  | 'daily_planning'  // Morning planning prompt
  | 'weekly_review'   // Weekly review reminder
  | 'gentle_return'   // Gentle "come back" nudge
  | 'celebration';    // Achievement/milestone celebration

export interface ScheduledNotification {
  id: string;
  identifier: string; // Expo notification identifier
  type: NudgeNotificationType;
  title: string;
  body: string;
  scheduledTime: Date;
  data?: Record<string, any>;
  repeats?: 'daily' | 'weekly' | 'none';
  enabled: boolean;
}

interface NotificationSettings {
  enabled: boolean;
  quietHoursStart?: number; // Hour (0-23)
  quietHoursEnd?: number;
  allowedTypes: NudgeNotificationType[];
  pushToken?: string;
}

const STORAGE_KEYS = {
  SETTINGS: 'nero_notification_settings',
  SCHEDULED: 'nero_scheduled_notifications',
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 7,    // 7 AM
  allowedTypes: [
    'focus_time',
    'energy_check',
    'task_reminder',
    'break_time',
    'daily_planning',
    'weekly_review',
    'gentle_return',
    'celebration',
  ],
};

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class PushNotificationService {
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  private scheduledNotifications: ScheduledNotification[] = [];
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private onNotificationReceived?: (notification: Notifications.Notification) => void;
  private onNotificationResponse?: (response: Notifications.NotificationResponse) => void;

  async initialize(): Promise<boolean> {
    try {
      // Load saved settings
      const [settingsJson, scheduledJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED),
      ]);

      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }
      if (scheduledJson) {
        this.scheduledNotifications = JSON.parse(scheduledJson);
      }

      // Register for push notifications
      const token = await this.registerForPushNotifications();
      if (token) {
        this.settings.pushToken = token;
        await this.saveSettings();
      }

      // Set up listeners
      this.setupListeners();

      return true;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return false;
    }
  }

  private async registerForPushNotifications(): Promise<string | null> {
    // Check if we're on a physical device
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permissions not granted');
      return null;
    }

    // Get push token
    try {
      // For Expo Go, use experience ID; for standalone, use projectId
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      // Set up Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('nero-nudges', {
          name: 'Nero Nudges',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6C5CE7',
          sound: 'default',
        });
      }

      return tokenData.data;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  private setupListeners(): void {
    // Listen for incoming notifications while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        this.onNotificationReceived?.(notification);
      }
    );

    // Listen for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        this.onNotificationResponse?.(response);
      }
    );
  }

  // ============ NOTIFICATION SCHEDULING ============

  async scheduleNotification(
    type: NudgeNotificationType,
    title: string,
    body: string,
    scheduledTime: Date,
    options?: {
      data?: Record<string, any>;
      repeats?: 'daily' | 'weekly' | 'none';
    }
  ): Promise<ScheduledNotification | null> {
    // Check if notifications are enabled
    if (!this.settings.enabled) {
      console.log('Notifications are disabled');
      return null;
    }

    // Check if this type is allowed
    if (!this.settings.allowedTypes.includes(type)) {
      console.log(`Notification type ${type} is not allowed`);
      return null;
    }

    // Check quiet hours
    if (this.isInQuietHours(scheduledTime)) {
      // Adjust to after quiet hours
      scheduledTime = this.adjustForQuietHours(scheduledTime);
    }

    try {
      // Build the trigger
      let trigger: Notifications.NotificationTriggerInput;
      
      if (options?.repeats === 'daily') {
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: scheduledTime.getHours(),
          minute: scheduledTime.getMinutes(),
        };
      } else if (options?.repeats === 'weekly') {
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: scheduledTime.getDay() + 1, // 1-7, Sunday = 1
          hour: scheduledTime.getHours(),
          minute: scheduledTime.getMinutes(),
        };
      } else {
        trigger = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduledTime,
        };
      }

      // Schedule the notification
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type,
            ...options?.data,
          },
          sound: 'default',
          badge: 1,
          ...(Platform.OS === 'android' && { channelId: 'nero-nudges' }),
        },
        trigger,
      });

      // Save to our tracking list
      const notification: ScheduledNotification = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        identifier,
        type,
        title,
        body,
        scheduledTime,
        data: options?.data,
        repeats: options?.repeats || 'none',
        enabled: true,
      };

      this.scheduledNotifications.push(notification);
      await this.saveScheduled();

      return notification;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  async cancelNotification(id: string): Promise<boolean> {
    const notification = this.scheduledNotifications.find(n => n.id === id);
    if (!notification) return false;

    try {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      this.scheduledNotifications = this.scheduledNotifications.filter(n => n.id !== id);
      await this.saveScheduled();
      return true;
    } catch (error) {
      console.error('Failed to cancel notification:', error);
      return false;
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      this.scheduledNotifications = [];
      await this.saveScheduled();
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }

  // ============ CONVENIENCE METHODS FOR NERO NUDGES ============

  async scheduleFocusTimeNudge(hour: number, minute: number = 0): Promise<ScheduledNotification | null> {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (time <= new Date()) {
      time.setDate(time.getDate() + 1);
    }

    return this.scheduleNotification(
      'focus_time',
      '🎯 Peak Focus Time',
      "This is usually when you're most productive. Ready to tackle something important?",
      time,
      { repeats: 'daily' }
    );
  }

  async scheduleEnergyCheck(hour: number, minute: number = 0): Promise<ScheduledNotification | null> {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    
    if (time <= new Date()) {
      time.setDate(time.getDate() + 1);
    }

    return this.scheduleNotification(
      'energy_check',
      '⚡ Energy Check',
      "How are you feeling? Tap to update your energy level.",
      time,
      { repeats: 'daily' }
    );
  }

  async scheduleBreakReminder(afterMinutes: number): Promise<ScheduledNotification | null> {
    const time = new Date();
    time.setMinutes(time.getMinutes() + afterMinutes);

    return this.scheduleNotification(
      'break_time',
      '🧘 Break Time',
      "You've been focused for a while. Stretch, hydrate, or just look away from the screen.",
      time
    );
  }

  async scheduleDailyPlanning(hour: number = 9, minute: number = 0): Promise<ScheduledNotification | null> {
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    
    if (time <= new Date()) {
      time.setDate(time.getDate() + 1);
    }

    return this.scheduleNotification(
      'daily_planning',
      '📋 Morning Check-in',
      "What's the ONE thing you want to accomplish today?",
      time,
      { repeats: 'daily' }
    );
  }

  async scheduleWeeklyReview(dayOfWeek: number = 0, hour: number = 10): Promise<ScheduledNotification | null> {
    // dayOfWeek: 0 = Sunday, 1 = Monday, etc.
    const time = new Date();
    const currentDay = time.getDay();
    const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7;
    
    time.setDate(time.getDate() + daysUntil);
    time.setHours(hour, 0, 0, 0);

    return this.scheduleNotification(
      'weekly_review',
      '📊 Your Weekly Report',
      "Check out how your week went. You might be surprised!",
      time,
      { repeats: 'weekly' }
    );
  }

  async scheduleGentleReturn(afterMinutes: number = 30): Promise<ScheduledNotification | null> {
    const time = new Date();
    time.setMinutes(time.getMinutes() + afterMinutes);

    return this.scheduleNotification(
      'gentle_return',
      '👋 Hey there',
      "No pressure, but I'm here if you want to pick up where you left off.",
      time
    );
  }

  async sendCelebration(achievement: string): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Achievement Unlocked!',
        body: achievement,
        data: { type: 'celebration' },
        sound: 'default',
        badge: 0,
      },
      trigger: null, // Send immediately
    });
  }

  // ============ SETTINGS MANAGEMENT ============

  async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  async setQuietHours(start: number, end: number): Promise<void> {
    this.settings.quietHoursStart = start;
    this.settings.quietHoursEnd = end;
    await this.saveSettings();
  }

  async toggleNotificationType(type: NudgeNotificationType, enabled: boolean): Promise<void> {
    if (enabled && !this.settings.allowedTypes.includes(type)) {
      this.settings.allowedTypes.push(type);
    } else if (!enabled) {
      this.settings.allowedTypes = this.settings.allowedTypes.filter(t => t !== type);
    }
    await this.saveSettings();
  }

  // ============ HELPERS ============

  private isInQuietHours(time: Date): boolean {
    const hour = time.getHours();
    const start = this.settings.quietHoursStart ?? 22;
    const end = this.settings.quietHoursEnd ?? 7;

    if (start > end) {
      // Quiet hours span midnight (e.g., 22:00 - 07:00)
      return hour >= start || hour < end;
    } else {
      // Quiet hours are within same day
      return hour >= start && hour < end;
    }
  }

  private adjustForQuietHours(time: Date): Date {
    const adjusted = new Date(time);
    const end = this.settings.quietHoursEnd ?? 7;
    
    adjusted.setHours(end, 0, 0, 0);
    
    // If we're before the end time, we're already in the next day's quiet hours
    if (time.getHours() < end) {
      // Keep same day
    } else {
      // Move to next day
      adjusted.setDate(adjusted.getDate() + 1);
    }
    
    return adjusted;
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  private async saveScheduled(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED, JSON.stringify(this.scheduledNotifications));
    } catch (error) {
      console.error('Failed to save scheduled notifications:', error);
    }
  }

  getScheduledNotifications(): ScheduledNotification[] {
    return [...this.scheduledNotifications];
  }

  getPushToken(): string | undefined {
    return this.settings.pushToken;
  }

  // ============ EVENT HANDLERS ============

  setOnNotificationReceived(handler: (notification: Notifications.Notification) => void): void {
    this.onNotificationReceived = handler;
  }

  setOnNotificationResponse(handler: (response: Notifications.NotificationResponse) => void): void {
    this.onNotificationResponse = handler;
  }

  // ============ CLEANUP ============

  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
}

// Singleton instance
let serviceInstance: PushNotificationService | null = null;

export function getPushNotificationService(): PushNotificationService {
  if (!serviceInstance) {
    serviceInstance = new PushNotificationService();
  }
  return serviceInstance;
}

export async function initializePushNotifications(): Promise<PushNotificationService> {
  const service = getPushNotificationService();
  await service.initialize();
  return service;
}