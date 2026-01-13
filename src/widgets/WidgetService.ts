import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Task, EnergyLevel, MoodLevel, FocusSession } from '../types';

// ============ WIDGET SERVICE ============
// Manages shared data between the main app and home screen widgets
// Widgets require native code and expo-dev-client for full implementation

export interface WidgetData {
  // Quick View Widget
  nextTask: {
    id: string;
    title: string;
    energy: EnergyLevel;
  } | null;
  completedToday: number;
  currentEnergy: EnergyLevel | null;
  currentMood: MoodLevel | null;

  // Stats Widget
  totalTasks: number;
  streak: number;
  points: number;

  // Focus Timer Widget
  focusSession: {
    isActive: boolean;
    remainingSeconds: number;
    taskTitle?: string;
    isBreak: boolean;
  } | null;

  // Last updated
  lastUpdated: string;
}

// Storage key for widget data (shared with native widgets via App Groups on iOS)
const WIDGET_DATA_KEY = '@uf/widget_data';

export class WidgetService {
  private widgetData: WidgetData = {
    nextTask: null,
    completedToday: 0,
    currentEnergy: null,
    currentMood: null,
    totalTasks: 0,
    streak: 0,
    points: 0,
    focusSession: null,
    lastUpdated: new Date().toISOString(),
  };

  async loadWidgetData(): Promise<WidgetData> {
    try {
      const stored = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      if (stored) {
        this.widgetData = JSON.parse(stored);
      }
    } catch (e) {
      console.log('Failed to load widget data:', e);
    }
    return this.widgetData;
  }

  async saveWidgetData(): Promise<void> {
    try {
      this.widgetData.lastUpdated = new Date().toISOString();
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(this.widgetData));

      // On iOS, we'd also save to App Group shared container
      // On Android, we'd trigger widget update via native bridge
      this.triggerWidgetUpdate();
    } catch (e) {
      console.log('Failed to save widget data:', e);
    }
  }

  updateTasks(tasks: Task[]): void {
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedToday = tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      return new Date(t.completedAt).toDateString() === new Date().toDateString();
    }).length;

    const nextTask = pendingTasks[0];

    this.widgetData.nextTask = nextTask
      ? {
          id: nextTask.id,
          title: nextTask.title,
          energy: nextTask.energy,
        }
      : null;
    this.widgetData.completedToday = completedToday;
    this.widgetData.totalTasks = tasks.length;

    this.saveWidgetData();
  }

  updateEnergy(energy: EnergyLevel | null): void {
    this.widgetData.currentEnergy = energy;
    this.saveWidgetData();
  }

  updateMood(mood: MoodLevel | null): void {
    this.widgetData.currentMood = mood;
    this.saveWidgetData();
  }

  updateStats(streak: number, points: number): void {
    this.widgetData.streak = streak;
    this.widgetData.points = points;
    this.saveWidgetData();
  }

  updateFocusSession(
    isActive: boolean,
    remainingSeconds: number = 0,
    taskTitle?: string,
    isBreak: boolean = false
  ): void {
    this.widgetData.focusSession = isActive
      ? { isActive, remainingSeconds, taskTitle, isBreak }
      : null;
    this.saveWidgetData();
  }

  private triggerWidgetUpdate(): void {
    // This would call native code to refresh widgets
    // For iOS: WidgetCenter.shared.reloadAllTimelines()
    // For Android: AppWidgetManager.updateAppWidget()

    // Placeholder for native bridge integration
    if (Platform.OS === 'ios') {
      // Would use expo-modules or react-native-widgetkit
      console.log('Triggering iOS widget update');
    } else if (Platform.OS === 'android') {
      // Would use native module to update Android widget
      console.log('Triggering Android widget update');
    }
  }

  // Get formatted data for quick display
  getQuickViewData(): {
    title: string;
    subtitle: string;
    energyEmoji: string;
    progressText: string;
  } {
    const { nextTask, completedToday, currentEnergy } = this.widgetData;

    const energyEmojis: Record<EnergyLevel, string> = {
      low: '🌙',
      medium: '✨',
      high: '⚡',
    };

    return {
      title: nextTask?.title || 'All clear!',
      subtitle: nextTask ? 'Your next task' : 'No tasks pending',
      energyEmoji: currentEnergy ? energyEmojis[currentEnergy] : '📊',
      progressText: `${completedToday} done today`,
    };
  }
}

// ============ WIDGET CONFIGURATION ============
// This configuration is used by native widget code

export const WIDGET_CONFIG = {
  // iOS Widget Configuration
  ios: {
    // Small widget (2x2)
    small: {
      kind: 'QuickViewWidget',
      displayName: 'Next Task',
      description: 'See your next task at a glance',
      supportedFamilies: ['systemSmall'],
    },
    // Medium widget (4x2)
    medium: {
      kind: 'TaskListWidget',
      displayName: 'Tasks',
      description: 'Your top 3 tasks and progress',
      supportedFamilies: ['systemMedium'],
    },
    // Large widget (4x4)
    large: {
      kind: 'DashboardWidget',
      displayName: 'Dashboard',
      description: 'Full productivity dashboard',
      supportedFamilies: ['systemLarge'],
    },
    // Lock screen widget
    accessory: {
      kind: 'FocusWidget',
      displayName: 'Focus Timer',
      description: 'Quick access to focus timer',
      supportedFamilies: ['accessoryRectangular', 'accessoryCircular'],
    },
  },

  // Android Widget Configuration
  android: {
    // Small widget (2x1)
    quickTask: {
      name: 'QuickTaskWidget',
      label: 'Next Task',
      description: 'Shows your next task',
      minWidth: 180,
      minHeight: 40,
      resizeMode: 'horizontal',
    },
    // Medium widget (4x2)
    taskList: {
      name: 'TaskListWidget',
      label: 'Task List',
      description: 'Shows top tasks and progress',
      minWidth: 250,
      minHeight: 110,
      resizeMode: 'horizontal|vertical',
    },
    // Focus timer widget (2x2)
    focusTimer: {
      name: 'FocusTimerWidget',
      label: 'Focus Timer',
      description: 'Control your focus timer',
      minWidth: 110,
      minHeight: 110,
      resizeMode: 'none',
    },
  },

  // App Group identifier for iOS (for shared storage)
  appGroup: 'group.cloud.newbold.unfocused',

  // Update intervals
  updateInterval: {
    idle: 15 * 60 * 1000, // 15 minutes when idle
    active: 60 * 1000, // 1 minute when focus timer active
  },
};

// ============ WIDGET DEEP LINKS ============
// Handle widget tap actions

export const WIDGET_DEEP_LINKS = {
  completeTask: (taskId: string) => `unfocused://task/complete/${taskId}`,
  openTask: (taskId: string) => `unfocused://task/${taskId}`,
  startFocus: () => 'unfocused://focus/start',
  pauseFocus: () => 'unfocused://focus/pause',
  openApp: () => 'unfocused://',
  setEnergy: (level: EnergyLevel) => `unfocused://energy/${level}`,
};

export function parseWidgetDeepLink(url: string): {
  action: string;
  params: Record<string, string>;
} | null {
  try {
    const match = url.match(/^unfocused:\/\/(.+)$/);
    if (!match) return null;

    const path = match[1];
    const parts = path.split('/');

    if (parts[0] === 'task' && parts[1] === 'complete') {
      return { action: 'completeTask', params: { taskId: parts[2] } };
    }
    if (parts[0] === 'task') {
      return { action: 'openTask', params: { taskId: parts[1] } };
    }
    if (parts[0] === 'focus') {
      return { action: parts[1] === 'start' ? 'startFocus' : 'pauseFocus', params: {} };
    }
    if (parts[0] === 'energy') {
      return { action: 'setEnergy', params: { level: parts[1] } };
    }

    return { action: 'openApp', params: {} };
  } catch {
    return null;
  }
}
