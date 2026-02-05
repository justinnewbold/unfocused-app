/**
 * QuickAddWidgetService - Home screen widget for instant task capture
 *
 * Features:
 * - iOS/Android widget support
 * - Quick task creation
 * - Voice input support
 * - One-tap common tasks
 * - Deep linking to app
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import type { Task, EnergyLevel, WidgetConfig, WidgetSize, WidgetType } from '../types';

const STORAGE_KEYS = {
  WIDGET_CONFIG: 'nero_widget_config',
  PENDING_TASKS: 'nero_widget_pending_tasks',
  QUICK_TASKS: 'nero_widget_quick_tasks',
};

export interface QuickTask {
  id: string;
  title: string;
  energy: EnergyLevel;
  icon?: string;
  usageCount: number;
}

export interface WidgetData {
  currentTask?: {
    title: string;
    energy: EnergyLevel;
    startedAt?: string;
  };
  focusTimer?: {
    remaining: number; // seconds
    isRunning: boolean;
  };
  energyLevel?: EnergyLevel;
  quickTasks: QuickTask[];
  stats?: {
    completedToday: number;
    focusMinutesToday: number;
  };
}

export class QuickAddWidgetService {
  private config: WidgetConfig[] = [];
  private quickTasks: QuickTask[] = [];
  private pendingTasks: Partial<Task>[] = [];

  async initialize(): Promise<void> {
    try {
      const [configJson, quickTasksJson, pendingJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.WIDGET_CONFIG),
        AsyncStorage.getItem(STORAGE_KEYS.QUICK_TASKS),
        AsyncStorage.getItem(STORAGE_KEYS.PENDING_TASKS),
      ]);

      if (configJson) {
        this.config = JSON.parse(configJson);
      }

      if (quickTasksJson) {
        this.quickTasks = JSON.parse(quickTasksJson);
      } else {
        // Initialize default quick tasks
        this.quickTasks = this.getDefaultQuickTasks();
        await this.saveQuickTasks();
      }

      if (pendingJson) {
        this.pendingTasks = JSON.parse(pendingJson);
      }
    } catch (error) {
      console.error('Failed to initialize QuickAddWidgetService:', error);
    }
  }

  private getDefaultQuickTasks(): QuickTask[] {
    return [
      { id: 'qt_email', title: 'Check email', energy: 'low', icon: '📧', usageCount: 0 },
      { id: 'qt_water', title: 'Drink water', energy: 'low', icon: '💧', usageCount: 0 },
      { id: 'qt_break', title: 'Take a break', energy: 'low', icon: '☕', usageCount: 0 },
      { id: 'qt_stretch', title: 'Quick stretch', energy: 'low', icon: '🧘', usageCount: 0 },
      { id: 'qt_focus', title: 'Start focus session', energy: 'medium', icon: '🎯', usageCount: 0 },
    ];
  }

  // ============ WIDGET CONFIGURATION ============

  getWidgetConfigs(): WidgetConfig[] {
    return [...this.config];
  }

  async addWidget(type: WidgetType, size: WidgetSize): Promise<WidgetConfig> {
    const widget: WidgetConfig = {
      id: `widget_${Date.now()}`,
      type,
      size,
      position: this.config.length,
    };

    this.config.push(widget);
    await this.saveConfig();
    return widget;
  }

  async removeWidget(widgetId: string): Promise<boolean> {
    const initialLength = this.config.length;
    this.config = this.config.filter(w => w.id !== widgetId);

    if (this.config.length !== initialLength) {
      // Reorder positions
      this.config.forEach((w, i) => { w.position = i; });
      await this.saveConfig();
      return true;
    }
    return false;
  }

  async updateWidget(widgetId: string, updates: Partial<WidgetConfig>): Promise<WidgetConfig | null> {
    const widget = this.config.find(w => w.id === widgetId);
    if (!widget) return null;

    Object.assign(widget, updates);
    await this.saveConfig();
    return widget;
  }

  // ============ QUICK TASK MANAGEMENT ============

  getQuickTasks(): QuickTask[] {
    // Return sorted by usage count (most used first)
    return [...this.quickTasks].sort((a, b) => b.usageCount - a.usageCount);
  }

  async addQuickTask(title: string, energy: EnergyLevel, icon?: string): Promise<QuickTask> {
    const quickTask: QuickTask = {
      id: `qt_${Date.now()}`,
      title,
      energy,
      icon,
      usageCount: 0,
    };

    this.quickTasks.push(quickTask);
    await this.saveQuickTasks();
    return quickTask;
  }

  async removeQuickTask(quickTaskId: string): Promise<boolean> {
    const initialLength = this.quickTasks.length;
    this.quickTasks = this.quickTasks.filter(t => t.id !== quickTaskId);

    if (this.quickTasks.length !== initialLength) {
      await this.saveQuickTasks();
      return true;
    }
    return false;
  }

  async useQuickTask(quickTaskId: string): Promise<QuickTask | null> {
    const quickTask = this.quickTasks.find(t => t.id === quickTaskId);
    if (!quickTask) return null;

    quickTask.usageCount++;
    await this.saveQuickTasks();
    return quickTask;
  }

  // ============ PENDING TASKS (for offline widget capture) ============

  async addPendingTask(task: Partial<Task>): Promise<void> {
    this.pendingTasks.push({
      ...task,
      id: task.id || `pending_${Date.now()}`,
      createdAt: new Date().toISOString(),
    });
    await this.savePendingTasks();
  }

  getPendingTasks(): Partial<Task>[] {
    return [...this.pendingTasks];
  }

  async clearPendingTasks(): Promise<Partial<Task>[]> {
    const tasks = [...this.pendingTasks];
    this.pendingTasks = [];
    await this.savePendingTasks();
    return tasks;
  }

  async removePendingTask(taskId: string): Promise<boolean> {
    const initialLength = this.pendingTasks.length;
    this.pendingTasks = this.pendingTasks.filter(t => t.id !== taskId);

    if (this.pendingTasks.length !== initialLength) {
      await this.savePendingTasks();
      return true;
    }
    return false;
  }

  // ============ WIDGET DATA ============

  async getWidgetData(): Promise<WidgetData> {
    // This would be called by the widget to get current state
    // In a real implementation, this would use shared app groups (iOS) or similar
    return {
      quickTasks: this.getQuickTasks().slice(0, 5),
      stats: {
        completedToday: 0, // Would fetch from main app
        focusMinutesToday: 0,
      },
    };
  }

  async updateWidgetData(data: Partial<WidgetData>): Promise<void> {
    // Update widget shared data
    // This would use shared app groups on iOS or similar mechanism
    try {
      const currentData = await this.getWidgetData();
      const updatedData = { ...currentData, ...data };
      await AsyncStorage.setItem('nero_widget_shared_data', JSON.stringify(updatedData));

      // Trigger widget refresh (platform-specific)
      this.requestWidgetUpdate();
    } catch (error) {
      console.error('Failed to update widget data:', error);
    }
  }

  private requestWidgetUpdate(): void {
    // Platform-specific widget refresh
    // iOS: Use WidgetKit
    // Android: Use AppWidgetManager
    if (Platform.OS === 'ios') {
      // Would use expo-apple-targets or similar
      console.log('Requesting iOS widget update');
    } else if (Platform.OS === 'android') {
      // Would use native module to update widget
      console.log('Requesting Android widget update');
    }
  }

  // ============ DEEP LINKING ============

  getDeepLinks(): Record<string, string> {
    return {
      quickAdd: 'unfocused://quick-add',
      addTask: 'unfocused://add-task',
      startFocus: 'unfocused://start-focus',
      energyCheck: 'unfocused://energy-check',
      openChat: 'unfocused://chat',
      viewTasks: 'unfocused://tasks',
    };
  }

  async handleDeepLink(url: string): Promise<{
    action: string;
    params?: Record<string, string>;
  } | null> {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== 'unfocused:') return null;

      const action = parsed.hostname;
      const params: Record<string, string> = {};

      parsed.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return { action, params };
    } catch (error) {
      console.error('Failed to parse deep link:', error);
      return null;
    }
  }

  generateDeepLink(action: string, params?: Record<string, string>): string {
    let url = `unfocused://${action}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  async openApp(action?: string): Promise<void> {
    const url = action
      ? this.generateDeepLink(action)
      : 'unfocused://';

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open app:', error);
    }
  }

  // ============ WIDGET TEMPLATES ============

  getAvailableWidgets(): Array<{
    type: WidgetType;
    name: string;
    description: string;
    supportedSizes: WidgetSize[];
  }> {
    return [
      {
        type: 'quick_add',
        name: 'Quick Add',
        description: 'Instantly capture tasks',
        supportedSizes: ['small', 'medium'],
      },
      {
        type: 'current_task',
        name: 'Current Task',
        description: 'See your current focus task',
        supportedSizes: ['small', 'medium', 'large'],
      },
      {
        type: 'energy_check',
        name: 'Energy Check',
        description: 'Quick energy level update',
        supportedSizes: ['small'],
      },
      {
        type: 'focus_timer',
        name: 'Focus Timer',
        description: 'Control your focus timer',
        supportedSizes: ['small', 'medium'],
      },
      {
        type: 'stats',
        name: 'Daily Stats',
        description: 'See today\'s progress',
        supportedSizes: ['medium', 'large'],
      },
    ];
  }

  // ============ STORAGE ============

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.WIDGET_CONFIG, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save widget config:', error);
    }
  }

  private async saveQuickTasks(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.QUICK_TASKS, JSON.stringify(this.quickTasks));
    } catch (error) {
      console.error('Failed to save quick tasks:', error);
    }
  }

  private async savePendingTasks(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_TASKS, JSON.stringify(this.pendingTasks));
    } catch (error) {
      console.error('Failed to save pending tasks:', error);
    }
  }
}

// Singleton instance
let serviceInstance: QuickAddWidgetService | null = null;

export function getQuickAddWidgetService(): QuickAddWidgetService {
  if (!serviceInstance) {
    serviceInstance = new QuickAddWidgetService();
  }
  return serviceInstance;
}

export async function initializeQuickAddWidgetService(): Promise<QuickAddWidgetService> {
  const service = getQuickAddWidgetService();
  await service.initialize();
  return service;
}
