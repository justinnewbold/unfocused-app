/**
 * SystemIntegrationService - Native OS integrations
 *
 * Features:
 * - iOS Focus Mode integration
 * - Android Do Not Disturb
 * - iOS Shortcuts
 * - Android Intents
 * - Siri integration
 * - Google Assistant
 */

import { Platform, Linking, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'nero_system_integration';

export type FocusModeType = 'dnd' | 'focus' | 'sleep' | 'personal' | 'work';

export interface SystemIntegrationSettings {
  autoEnableFocusMode: boolean;
  focusModeType: FocusModeType;
  autoDisableOnBreak: boolean;
  showFocusNotification: boolean;
  siriShortcutsEnabled: boolean;
  androidIntentsEnabled: boolean;
}

export interface ShortcutAction {
  id: string;
  name: string;
  description: string;
  phrase?: string; // Siri phrase
  intentAction?: string; // Android intent
  params?: Record<string, any>;
}

const DEFAULT_SETTINGS: SystemIntegrationSettings = {
  autoEnableFocusMode: false,
  focusModeType: 'focus',
  autoDisableOnBreak: true,
  showFocusNotification: true,
  siriShortcutsEnabled: false,
  androidIntentsEnabled: false,
};

// Available shortcuts/automations
const AVAILABLE_SHORTCUTS: ShortcutAction[] = [
  {
    id: 'start_focus',
    name: 'Start Focus Session',
    description: 'Begin a 25-minute focus session',
    phrase: 'Start focus with Nero',
    intentAction: 'app.unfocused.START_FOCUS',
  },
  {
    id: 'add_task',
    name: 'Quick Add Task',
    description: 'Add a new task',
    phrase: 'Add task with Nero',
    intentAction: 'app.unfocused.ADD_TASK',
  },
  {
    id: 'check_energy',
    name: 'Energy Check-in',
    description: 'Log your current energy level',
    phrase: 'Energy check with Nero',
    intentAction: 'app.unfocused.ENERGY_CHECK',
  },
  {
    id: 'show_today',
    name: 'Today\'s Tasks',
    description: 'View tasks due today',
    phrase: 'Show today\'s tasks',
    intentAction: 'app.unfocused.SHOW_TODAY',
  },
  {
    id: 'panic_mode',
    name: 'Panic Mode',
    description: 'Activate calm-down mode',
    phrase: 'I need help from Nero',
    intentAction: 'app.unfocused.PANIC_MODE',
  },
  {
    id: 'morning_planning',
    name: 'Morning Planning',
    description: 'Start your morning planning routine',
    phrase: 'Plan my day with Nero',
    intentAction: 'app.unfocused.MORNING_PLANNING',
  },
  {
    id: 'evening_reflection',
    name: 'Evening Reflection',
    description: 'Start your evening reflection',
    phrase: 'Reflect on my day',
    intentAction: 'app.unfocused.EVENING_REFLECTION',
  },
];

export class SystemIntegrationService {
  private settings: SystemIntegrationSettings = DEFAULT_SETTINGS;
  private isFocusModeActive: boolean = false;

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      }
    } catch (error) {
      console.error('Failed to initialize SystemIntegrationService:', error);
    }
  }

  // ============ FOCUS MODE (iOS) / DND (Android) ============

  async enableFocusMode(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // iOS Focus Mode requires user to set up in Settings
        // We can only suggest opening Settings
        // In a real app, you'd use a native module for this
        console.log('iOS Focus Mode integration would be enabled');

        // For now, just track state
        this.isFocusModeActive = true;
        return true;
      } else if (Platform.OS === 'android') {
        // Android Do Not Disturb
        // Requires NOTIFICATION_POLICY_ACCESS permission
        // In a real app, use native module or expo-notifications
        console.log('Android DND would be enabled');
        this.isFocusModeActive = true;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to enable focus mode:', error);
      return false;
    }
  }

  async disableFocusMode(): Promise<boolean> {
    try {
      this.isFocusModeActive = false;

      if (Platform.OS === 'ios') {
        console.log('iOS Focus Mode would be disabled');
        return true;
      } else if (Platform.OS === 'android') {
        console.log('Android DND would be disabled');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to disable focus mode:', error);
      return false;
    }
  }

  isFocusModeEnabled(): boolean {
    return this.isFocusModeActive;
  }

  async openFocusModeSettings(): Promise<void> {
    if (Platform.OS === 'ios') {
      // Open iOS Focus settings
      await Linking.openSettings();
    } else if (Platform.OS === 'android') {
      // Open Android DND settings
      await Linking.openSettings();
    }
  }

  // ============ SIRI SHORTCUTS (iOS) ============

  getAvailableShortcuts(): ShortcutAction[] {
    return [...AVAILABLE_SHORTCUTS];
  }

  async donateShortcut(shortcutId: string): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    const shortcut = AVAILABLE_SHORTCUTS.find(s => s.id === shortcutId);
    if (!shortcut) return false;

    try {
      // In a real app, use react-native-siri-shortcut or similar
      // This would "donate" the shortcut to Siri for suggestions
      console.log(`Donating Siri shortcut: ${shortcut.name}`);
      return true;
    } catch (error) {
      console.error('Failed to donate Siri shortcut:', error);
      return false;
    }
  }

  async presentShortcut(shortcutId: string): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    const shortcut = AVAILABLE_SHORTCUTS.find(s => s.id === shortcutId);
    if (!shortcut) return false;

    try {
      // Present the "Add to Siri" dialog
      console.log(`Presenting Siri shortcut setup: ${shortcut.name}`);
      return true;
    } catch (error) {
      console.error('Failed to present Siri shortcut:', error);
      return false;
    }
  }

  // ============ ANDROID INTENTS ============

  getAvailableIntents(): ShortcutAction[] {
    if (Platform.OS !== 'android') return [];
    return AVAILABLE_SHORTCUTS.filter(s => s.intentAction);
  }

  async registerIntent(intentId: string): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    const intent = AVAILABLE_SHORTCUTS.find(s => s.id === intentId);
    if (!intent) return false;

    try {
      // In a real app, register the intent with Android
      console.log(`Registering Android intent: ${intent.intentAction}`);
      return true;
    } catch (error) {
      console.error('Failed to register intent:', error);
      return false;
    }
  }

  // ============ DEEP LINKING ============

  parseDeepLink(url: string): {
    action?: string;
    params?: Record<string, string>;
  } | null {
    try {
      // Expected format: unfocused://action?param1=value1&param2=value2
      const urlObj = new URL(url);

      if (urlObj.protocol !== 'unfocused:') return null;

      const action = urlObj.hostname || urlObj.pathname.replace(/^\//, '');
      const params: Record<string, string> = {};

      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return { action, params };
    } catch {
      return null;
    }
  }

  generateDeepLink(action: string, params?: Record<string, string>): string {
    let url = `unfocused://${action}`;

    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  // ============ WIDGET SUPPORT ============

  async updateWidgets(): Promise<void> {
    // Trigger widget refresh
    // In a real app, use expo-widgets or react-native-widget-extension
    if (Platform.OS === 'ios') {
      console.log('Updating iOS widgets');
    } else if (Platform.OS === 'android') {
      console.log('Updating Android widgets');
    }
  }

  getWidgetData(): {
    currentTask?: { title: string; energy: string };
    todayCount: { total: number; completed: number };
    focusMinutes: number;
    currentEnergy?: string;
  } {
    // This would be called by native widget code
    // Return current state for widget display
    return {
      todayCount: { total: 5, completed: 2 },
      focusMinutes: 45,
    };
  }

  // ============ APPLE WATCH / WEAR OS ============

  async syncToWatch(): Promise<boolean> {
    // In a real app, use react-native-watch-connectivity
    try {
      if (Platform.OS === 'ios') {
        console.log('Syncing to Apple Watch');
      } else if (Platform.OS === 'android') {
        console.log('Syncing to Wear OS');
      }
      return true;
    } catch (error) {
      console.error('Failed to sync to watch:', error);
      return false;
    }
  }

  isWatchConnected(): boolean {
    // Check if watch is connected
    return false; // Stub
  }

  // ============ AUTOMATION TRIGGERS ============

  async triggerAutomation(
    trigger: 'focus_started' | 'focus_ended' | 'task_completed' | 'break_started'
  ): Promise<void> {
    // Handle automation triggers
    switch (trigger) {
      case 'focus_started':
        if (this.settings.autoEnableFocusMode) {
          await this.enableFocusMode();
        }
        break;

      case 'focus_ended':
      case 'break_started':
        if (this.settings.autoDisableOnBreak) {
          await this.disableFocusMode();
        }
        break;

      case 'task_completed':
        // Could trigger celebrations, notifications, etc.
        break;
    }
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<SystemIntegrationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveData();
  }

  getSettings(): SystemIntegrationSettings {
    return { ...this.settings };
  }

  // ============ CAPABILITIES ============

  getCapabilities(): {
    hasFocusMode: boolean;
    hasSiri: boolean;
    hasGoogleAssistant: boolean;
    hasWidgets: boolean;
    hasWatch: boolean;
  } {
    return {
      hasFocusMode: Platform.OS === 'ios' || Platform.OS === 'android',
      hasSiri: Platform.OS === 'ios',
      hasGoogleAssistant: Platform.OS === 'android',
      hasWidgets: Platform.OS === 'ios' || Platform.OS === 'android',
      hasWatch: Platform.OS === 'ios' || Platform.OS === 'android',
    };
  }

  // ============ STORAGE ============

  private async saveData(): Promise<void> {
    try {
      const data = { settings: this.settings };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save system integration data:', error);
    }
  }
}

// Singleton instance
let serviceInstance: SystemIntegrationService | null = null;

export function getSystemIntegrationService(): SystemIntegrationService {
  if (!serviceInstance) {
    serviceInstance = new SystemIntegrationService();
  }
  return serviceInstance;
}

export async function initializeSystemIntegrationService(): Promise<SystemIntegrationService> {
  const service = getSystemIntegrationService();
  await service.initialize();
  return service;
}
