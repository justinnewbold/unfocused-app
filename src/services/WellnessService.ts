/**
 * WellnessService - Hydration, movement, and wellness reminders
 *
 * Features:
 * - Hydration reminders
 * - Movement/stretch breaks
 * - Eye rest reminders (20-20-20 rule)
 * - Posture checks
 * - Crisis resources for mental health
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform, Linking } from 'react-native';

const STORAGE_KEY = 'nero_wellness_settings';

export type WellnessReminderType =
  | 'hydration'
  | 'movement'
  | 'eye_rest'
  | 'posture'
  | 'breathing'
  | 'snack';

export interface WellnessReminder {
  id: string;
  type: WellnessReminderType;
  title: string;
  message: string;
  emoji: string;
  timestamp: string;
  acknowledged: boolean;
  actionTaken?: string;
}

export interface WellnessSettings {
  enabled: boolean;
  hydrationInterval: number; // minutes
  movementInterval: number;
  eyeRestInterval: number;
  postureInterval: number;
  quietHoursStart: number; // hour 0-23
  quietHoursEnd: number;
  enabledTypes: WellnessReminderType[];
  hapticFeedback: boolean;
  dailyWaterGoal: number; // glasses
  showDuringFocus: boolean;
}

export interface WellnessStats {
  date: string;
  waterGlasses: number;
  movementBreaks: number;
  eyeRests: number;
  postureChecks: number;
}

export interface CrisisResource {
  id: string;
  name: string;
  description: string;
  phone?: string;
  text?: string;
  url?: string;
  country: string;
  available24h: boolean;
}

const DEFAULT_SETTINGS: WellnessSettings = {
  enabled: true,
  hydrationInterval: 45,
  movementInterval: 60,
  eyeRestInterval: 20,
  postureInterval: 30,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  enabledTypes: ['hydration', 'movement', 'eye_rest', 'posture'],
  hapticFeedback: true,
  dailyWaterGoal: 8,
  showDuringFocus: false,
};

// Wellness reminder messages
const REMINDER_MESSAGES: Record<WellnessReminderType, { titles: string[]; messages: string[]; emoji: string }> = {
  hydration: {
    emoji: '💧',
    titles: ['Hydration Check', 'Water Break', 'Stay Hydrated'],
    messages: [
      'Time for a glass of water!',
      'Your brain works better hydrated.',
      'Quick water break?',
      'Hydration helps focus.',
    ],
  },
  movement: {
    emoji: '🚶',
    titles: ['Movement Break', 'Stretch Time', 'Get Moving'],
    messages: [
      'Stand up and stretch!',
      'Take a quick walk around.',
      'Roll your shoulders and neck.',
      'Your body will thank you.',
    ],
  },
  eye_rest: {
    emoji: '👀',
    titles: ['Eye Rest', '20-20-20 Rule', 'Look Away'],
    messages: [
      'Look at something 20 feet away for 20 seconds.',
      'Give your eyes a break from the screen.',
      'Blink a few times and look away.',
      'Rest those eyes for a moment.',
    ],
  },
  posture: {
    emoji: '🧘',
    titles: ['Posture Check', 'Sit Up Straight', 'Body Check'],
    messages: [
      'How\'s your posture?',
      'Shoulders back, spine straight.',
      'Unclench your jaw.',
      'Relax your shoulders away from your ears.',
    ],
  },
  breathing: {
    emoji: '🌬️',
    titles: ['Breathing Break', 'Take a Breath', 'Pause'],
    messages: [
      'Take 3 deep breaths.',
      'Inhale slowly, exhale fully.',
      'A moment to center yourself.',
    ],
  },
  snack: {
    emoji: '🍎',
    titles: ['Snack Time', 'Fuel Up', 'Energy Check'],
    messages: [
      'Need a healthy snack?',
      'Keep your energy steady.',
      'A small snack can help focus.',
    ],
  },
};

// Crisis resources
const CRISIS_RESOURCES: CrisisResource[] = [
  {
    id: 'lifeline_us',
    name: '988 Suicide & Crisis Lifeline',
    description: '24/7 support for people in distress',
    phone: '988',
    text: '988',
    url: 'https://988lifeline.org',
    country: 'US',
    available24h: true,
  },
  {
    id: 'crisis_text_us',
    name: 'Crisis Text Line',
    description: 'Text HOME to 741741',
    text: '741741',
    url: 'https://www.crisistextline.org',
    country: 'US',
    available24h: true,
  },
  {
    id: 'samaritans_uk',
    name: 'Samaritans',
    description: '24/7 emotional support',
    phone: '116 123',
    url: 'https://www.samaritans.org',
    country: 'UK',
    available24h: true,
  },
  {
    id: 'lifeline_au',
    name: 'Lifeline Australia',
    description: '24/7 crisis support',
    phone: '13 11 14',
    url: 'https://www.lifeline.org.au',
    country: 'AU',
    available24h: true,
  },
  {
    id: 'befrienders',
    name: 'Befrienders Worldwide',
    description: 'International directory of crisis centers',
    url: 'https://www.befrienders.org',
    country: 'International',
    available24h: false,
  },
];

export class WellnessService {
  private settings: WellnessSettings = DEFAULT_SETTINGS;
  private reminders: WellnessReminder[] = [];
  private todayStats: WellnessStats = this.getEmptyStats();
  private lastReminders: Map<WellnessReminderType, Date> = new Map();
  private reminderIntervals: NodeJS.Timeout[] = [];

  // Callbacks
  private onReminder?: (reminder: WellnessReminder) => void;

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        this.todayStats = parsed.todayStats || this.getEmptyStats();
        this.reminders = parsed.reminders || [];
      }

      // Reset stats if new day
      const today = new Date().toISOString().split('T')[0];
      if (this.todayStats.date !== today) {
        this.todayStats = this.getEmptyStats();
      }
    } catch (error) {
      console.error('Failed to initialize WellnessService:', error);
    }
  }

  private getEmptyStats(): WellnessStats {
    return {
      date: new Date().toISOString().split('T')[0],
      waterGlasses: 0,
      movementBreaks: 0,
      eyeRests: 0,
      postureChecks: 0,
    };
  }

  // ============ REMINDER GENERATION ============

  startReminderSchedule(): void {
    this.stopReminderSchedule();

    if (!this.settings.enabled) return;

    // Schedule each type
    if (this.settings.enabledTypes.includes('hydration')) {
      this.scheduleReminder('hydration', this.settings.hydrationInterval);
    }
    if (this.settings.enabledTypes.includes('movement')) {
      this.scheduleReminder('movement', this.settings.movementInterval);
    }
    if (this.settings.enabledTypes.includes('eye_rest')) {
      this.scheduleReminder('eye_rest', this.settings.eyeRestInterval);
    }
    if (this.settings.enabledTypes.includes('posture')) {
      this.scheduleReminder('posture', this.settings.postureInterval);
    }
  }

  stopReminderSchedule(): void {
    for (const interval of this.reminderIntervals) {
      clearInterval(interval);
    }
    this.reminderIntervals = [];
  }

  private scheduleReminder(type: WellnessReminderType, intervalMinutes: number): void {
    const interval = setInterval(() => {
      if (this.shouldSendReminder(type)) {
        this.createReminder(type);
      }
    }, intervalMinutes * 60 * 1000);

    this.reminderIntervals.push(interval);
  }

  private shouldSendReminder(type: WellnessReminderType): boolean {
    // Check quiet hours
    const now = new Date();
    const hour = now.getHours();
    const { quietHoursStart, quietHoursEnd } = this.settings;

    if (quietHoursStart > quietHoursEnd) {
      // Spans midnight
      if (hour >= quietHoursStart || hour < quietHoursEnd) return false;
    } else {
      if (hour >= quietHoursStart && hour < quietHoursEnd) return false;
    }

    return true;
  }

  private async createReminder(type: WellnessReminderType): Promise<WellnessReminder> {
    const messages = REMINDER_MESSAGES[type];
    const title = messages.titles[Math.floor(Math.random() * messages.titles.length)];
    const message = messages.messages[Math.floor(Math.random() * messages.messages.length)];

    const reminder: WellnessReminder = {
      id: `wellness_${Date.now()}`,
      type,
      title,
      message,
      emoji: messages.emoji,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    this.reminders.push(reminder);
    this.lastReminders.set(type, new Date());

    // Haptic feedback
    if (this.settings.hapticFeedback && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    // Callback
    this.onReminder?.(reminder);

    await this.saveData();
    return reminder;
  }

  // ============ REMINDER ACTIONS ============

  async acknowledgeReminder(
    reminderId: string,
    actionTaken?: string
  ): Promise<void> {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (!reminder) return;

    reminder.acknowledged = true;
    reminder.actionTaken = actionTaken;

    // Update stats
    switch (reminder.type) {
      case 'hydration':
        this.todayStats.waterGlasses++;
        break;
      case 'movement':
        this.todayStats.movementBreaks++;
        break;
      case 'eye_rest':
        this.todayStats.eyeRests++;
        break;
      case 'posture':
        this.todayStats.postureChecks++;
        break;
    }

    await this.saveData();
  }

  async dismissReminder(reminderId: string): Promise<void> {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.acknowledged = true;
    }
    await this.saveData();
  }

  async logWater(): Promise<void> {
    this.todayStats.waterGlasses++;
    await this.saveData();
  }

  async logMovement(): Promise<void> {
    this.todayStats.movementBreaks++;
    await this.saveData();
  }

  // ============ STATS ============

  getTodayStats(): WellnessStats {
    return { ...this.todayStats };
  }

  getWaterProgress(): { current: number; goal: number; percentage: number } {
    return {
      current: this.todayStats.waterGlasses,
      goal: this.settings.dailyWaterGoal,
      percentage: Math.min(
        100,
        Math.round((this.todayStats.waterGlasses / this.settings.dailyWaterGoal) * 100)
      ),
    };
  }

  getPendingReminders(): WellnessReminder[] {
    return this.reminders.filter(r => !r.acknowledged);
  }

  // ============ CRISIS RESOURCES ============

  getCrisisResources(country?: string): CrisisResource[] {
    if (country) {
      return CRISIS_RESOURCES.filter(
        r => r.country === country || r.country === 'International'
      );
    }
    return [...CRISIS_RESOURCES];
  }

  async callCrisisLine(resource: CrisisResource): Promise<void> {
    if (resource.phone) {
      const url = `tel:${resource.phone}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    }
  }

  async textCrisisLine(resource: CrisisResource): Promise<void> {
    if (resource.text) {
      const url = `sms:${resource.text}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    }
  }

  async openCrisisWebsite(resource: CrisisResource): Promise<void> {
    if (resource.url) {
      const canOpen = await Linking.canOpenURL(resource.url);
      if (canOpen) {
        await Linking.openURL(resource.url);
      }
    }
  }

  // Check if user might need crisis support based on patterns
  checkForCrisisSigns(recentMoods: Array<{ level: number; timestamp: string }>): {
    showResources: boolean;
    reason?: string;
  } {
    if (recentMoods.length < 3) {
      return { showResources: false };
    }

    // Check for sustained low mood (3+ entries of low mood)
    const recentLowMoods = recentMoods
      .slice(-7)
      .filter(m => m.level === 1 || m.level === 0);

    if (recentLowMoods.length >= 3) {
      return {
        showResources: true,
        reason: 'It looks like you\'ve been having a hard time. These resources are here if you need them.',
      };
    }

    return { showResources: false };
  }

  // ============ QUICK ACTIVITIES ============

  getQuickActivities(): Array<{
    id: string;
    name: string;
    duration: string;
    emoji: string;
    instructions: string[];
  }> {
    return [
      {
        id: 'desk_stretch',
        name: 'Desk Stretch',
        duration: '2 min',
        emoji: '🙆',
        instructions: [
          'Reach arms overhead and stretch',
          'Roll shoulders forward and back',
          'Gently tilt head side to side',
          'Twist torso left and right',
        ],
      },
      {
        id: 'eye_exercise',
        name: 'Eye Exercise',
        duration: '1 min',
        emoji: '👁️',
        instructions: [
          'Close eyes for 10 seconds',
          'Look at something 20+ feet away',
          'Move eyes in circles',
          'Blink rapidly for 5 seconds',
        ],
      },
      {
        id: 'quick_walk',
        name: 'Quick Walk',
        duration: '5 min',
        emoji: '🚶',
        instructions: [
          'Stand up from your desk',
          'Walk around your space',
          'Go get a glass of water',
          'Return refreshed',
        ],
      },
      {
        id: 'deep_breathing',
        name: 'Deep Breathing',
        duration: '1 min',
        emoji: '🌬️',
        instructions: [
          'Breathe in for 4 counts',
          'Hold for 4 counts',
          'Breathe out for 4 counts',
          'Repeat 4 times',
        ],
      },
      {
        id: 'hand_stretch',
        name: 'Hand & Wrist',
        duration: '1 min',
        emoji: '🤲',
        instructions: [
          'Extend arm, pull fingers back',
          'Make fists, then spread fingers',
          'Rotate wrists in circles',
          'Shake hands loosely',
        ],
      },
    ];
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<WellnessSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveData();

    // Restart schedule with new settings
    if (this.settings.enabled) {
      this.startReminderSchedule();
    } else {
      this.stopReminderSchedule();
    }
  }

  getSettings(): WellnessSettings {
    return { ...this.settings };
  }

  setOnReminder(callback: (reminder: WellnessReminder) => void): void {
    this.onReminder = callback;
  }

  // ============ STORAGE ============

  private async saveData(): Promise<void> {
    try {
      const data = {
        settings: this.settings,
        todayStats: this.todayStats,
        reminders: this.reminders.slice(-50), // Keep last 50
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save wellness data:', error);
    }
  }

  cleanup(): void {
    this.stopReminderSchedule();
  }
}

// Singleton instance
let serviceInstance: WellnessService | null = null;

export function getWellnessService(): WellnessService {
  if (!serviceInstance) {
    serviceInstance = new WellnessService();
  }
  return serviceInstance;
}

export async function initializeWellnessService(): Promise<WellnessService> {
  const service = getWellnessService();
  await service.initialize();
  return service;
}
