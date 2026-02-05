/**
 * TaskFreshnessService - Track task age and staleness
 *
 * Features:
 * - Visual indicators for task age
 * - Stale task detection
 * - Auto-suggest breaking down old tasks
 * - Task decay notifications
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from '../types';

const STORAGE_KEY = 'nero_task_freshness_settings';

export type FreshnessLevel = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface TaskFreshness {
  taskId: string;
  createdAt: string;
  lastInteraction: string;
  freshnessLevel: FreshnessLevel;
  daysSinceCreation: number;
  daysSinceInteraction: number;
  needsAttention: boolean;
  suggestedAction?: 'break_down' | 'reschedule' | 'delete' | 'review';
}

export interface FreshnessSettings {
  enabled: boolean;
  freshDays: number;      // 0-3 days
  agingDays: number;      // 3-7 days
  staleDays: number;      // 7-14 days
  ancientDays: number;    // 14+ days
  showVisualIndicators: boolean;
  notifyOnStale: boolean;
  autoSuggestBreakdown: boolean;
  excludeRecurring: boolean;
}

const DEFAULT_SETTINGS: FreshnessSettings = {
  enabled: true,
  freshDays: 3,
  agingDays: 7,
  staleDays: 14,
  ancientDays: 30,
  showVisualIndicators: true,
  notifyOnStale: true,
  autoSuggestBreakdown: true,
  excludeRecurring: true,
};

// Colors for freshness levels
const FRESHNESS_COLORS: Record<FreshnessLevel, string> = {
  fresh: '#00B894',    // Green
  aging: '#FDCB6E',    // Yellow
  stale: '#E17055',    // Orange
  ancient: '#D63031',  // Red
};

// Icons/emojis for freshness
const FRESHNESS_ICONS: Record<FreshnessLevel, string> = {
  fresh: '🌱',
  aging: '🍂',
  stale: '🥀',
  ancient: '💀',
};

export class TaskFreshnessService {
  private settings: FreshnessSettings = DEFAULT_SETTINGS;
  private interactionLog: Map<string, string> = new Map(); // taskId -> lastInteraction

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        this.interactionLog = new Map(parsed.interactions || []);
      }
    } catch (error) {
      console.error('Failed to initialize TaskFreshnessService:', error);
    }
  }

  // ============ FRESHNESS CALCULATION ============

  calculateFreshness(task: Task): TaskFreshness {
    const now = new Date();
    const createdAt = new Date(task.createdAt);
    const lastInteraction = this.interactionLog.get(task.id)
      ? new Date(this.interactionLog.get(task.id)!)
      : createdAt;

    const daysSinceCreation = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysSinceInteraction = Math.floor(
      (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine freshness level based on interaction, not creation
    const freshnessLevel = this.getFreshnessLevel(daysSinceInteraction);
    const needsAttention = freshnessLevel === 'stale' || freshnessLevel === 'ancient';

    // Suggest action based on staleness
    let suggestedAction: TaskFreshness['suggestedAction'] = undefined;
    if (needsAttention) {
      if (daysSinceCreation > this.settings.ancientDays) {
        suggestedAction = task.energy === 'high' ? 'break_down' : 'review';
      } else if (daysSinceInteraction > this.settings.staleDays) {
        suggestedAction = 'reschedule';
      }
    }

    return {
      taskId: task.id,
      createdAt: task.createdAt,
      lastInteraction: lastInteraction.toISOString(),
      freshnessLevel,
      daysSinceCreation,
      daysSinceInteraction,
      needsAttention,
      suggestedAction,
    };
  }

  private getFreshnessLevel(daysSinceInteraction: number): FreshnessLevel {
    if (daysSinceInteraction <= this.settings.freshDays) return 'fresh';
    if (daysSinceInteraction <= this.settings.agingDays) return 'aging';
    if (daysSinceInteraction <= this.settings.staleDays) return 'stale';
    return 'ancient';
  }

  // ============ BATCH ANALYSIS ============

  analyzeAllTasks(tasks: Task[]): {
    freshness: TaskFreshness[];
    summary: {
      fresh: number;
      aging: number;
      stale: number;
      ancient: number;
      needsAttention: number;
    };
    oldestTask: TaskFreshness | null;
    recommendations: string[];
  } {
    const incompleteTasks = tasks.filter(t => !t.completed);
    const freshnessList = incompleteTasks.map(t => this.calculateFreshness(t));

    const summary = {
      fresh: freshnessList.filter(f => f.freshnessLevel === 'fresh').length,
      aging: freshnessList.filter(f => f.freshnessLevel === 'aging').length,
      stale: freshnessList.filter(f => f.freshnessLevel === 'stale').length,
      ancient: freshnessList.filter(f => f.freshnessLevel === 'ancient').length,
      needsAttention: freshnessList.filter(f => f.needsAttention).length,
    };

    // Find oldest task
    const sortedByAge = [...freshnessList].sort(
      (a, b) => b.daysSinceCreation - a.daysSinceCreation
    );
    const oldestTask = sortedByAge[0] || null;

    // Generate recommendations
    const recommendations: string[] = [];

    if (summary.ancient > 0) {
      recommendations.push(
        `You have ${summary.ancient} ancient task${summary.ancient > 1 ? 's' : ''} that might need to be reconsidered`
      );
    }

    if (summary.stale > 3) {
      recommendations.push(
        'Consider doing a "task audit" to review stale items'
      );
    }

    const staleHighEnergy = freshnessList.filter(
      f => f.freshnessLevel === 'stale' || f.freshnessLevel === 'ancient'
    );
    if (staleHighEnergy.length > 0) {
      recommendations.push(
        'Some old tasks might be too big - try breaking them into smaller steps'
      );
    }

    if (summary.fresh < summary.stale + summary.ancient) {
      recommendations.push(
        'More tasks are getting old than staying fresh - you might be adding more than completing'
      );
    }

    return {
      freshness: freshnessList,
      summary,
      oldestTask,
      recommendations,
    };
  }

  // ============ TASK INTERACTION TRACKING ============

  async recordInteraction(taskId: string): Promise<void> {
    this.interactionLog.set(taskId, new Date().toISOString());
    await this.saveData();
  }

  async recordMultipleInteractions(taskIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (const id of taskIds) {
      this.interactionLog.set(id, now);
    }
    await this.saveData();
  }

  getLastInteraction(taskId: string): string | null {
    return this.interactionLog.get(taskId) || null;
  }

  // ============ VISUAL HELPERS ============

  getFreshnessColor(level: FreshnessLevel): string {
    return FRESHNESS_COLORS[level];
  }

  getFreshnessIcon(level: FreshnessLevel): string {
    return FRESHNESS_ICONS[level];
  }

  getFreshnessLabel(level: FreshnessLevel): string {
    const labels: Record<FreshnessLevel, string> = {
      fresh: 'Fresh',
      aging: 'Getting old',
      stale: 'Needs attention',
      ancient: 'Very old',
    };
    return labels[level];
  }

  getTimeAgoText(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return 'Last week';
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return 'Last month';
    return `${Math.floor(days / 30)} months ago`;
  }

  // ============ STALE TASK ACTIONS ============

  getStaleTaskActions(freshness: TaskFreshness): Array<{
    id: string;
    label: string;
    description: string;
    emoji: string;
  }> {
    const actions = [
      {
        id: 'do_now',
        label: 'Do it now',
        description: 'Start working on this task',
        emoji: '🎯',
      },
      {
        id: 'break_down',
        label: 'Break it down',
        description: 'Split into smaller steps',
        emoji: '✂️',
      },
      {
        id: 'reschedule',
        label: 'Reschedule',
        description: 'Set a new due date',
        emoji: '📅',
      },
      {
        id: 'delegate',
        label: 'Delegate',
        description: 'Assign to someone else',
        emoji: '👥',
      },
      {
        id: 'delete',
        label: 'Let it go',
        description: "It's okay to remove it",
        emoji: '🗑️',
      },
    ];

    // Prioritize suggested action
    if (freshness.suggestedAction) {
      const suggested = actions.find(a => a.id === freshness.suggestedAction);
      if (suggested) {
        return [suggested, ...actions.filter(a => a.id !== freshness.suggestedAction)];
      }
    }

    return actions;
  }

  // ============ NOTIFICATIONS ============

  getStaleTaskNotifications(tasks: Task[]): Array<{
    taskId: string;
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
  }> {
    if (!this.settings.notifyOnStale) return [];

    const notifications: Array<{
      taskId: string;
      title: string;
      message: string;
      priority: 'low' | 'medium' | 'high';
    }> = [];

    for (const task of tasks.filter(t => !t.completed)) {
      const freshness = this.calculateFreshness(task);

      if (freshness.freshnessLevel === 'ancient') {
        notifications.push({
          taskId: task.id,
          title: `"${task.title}" is getting very old`,
          message: `Created ${this.getTimeAgoText(freshness.daysSinceCreation)}. Time to review?`,
          priority: 'high',
        });
      } else if (freshness.freshnessLevel === 'stale') {
        notifications.push({
          taskId: task.id,
          title: `"${task.title}" needs attention`,
          message: `No activity for ${freshness.daysSinceInteraction} days`,
          priority: 'medium',
        });
      }
    }

    return notifications;
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<FreshnessSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveData();
  }

  getSettings(): FreshnessSettings {
    return { ...this.settings };
  }

  // ============ STORAGE ============

  private async saveData(): Promise<void> {
    try {
      const data = {
        settings: this.settings,
        interactions: Array.from(this.interactionLog.entries()),
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save task freshness data:', error);
    }
  }

  async clearOldInteractions(olderThanDays: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    let removed = 0;
    for (const [taskId, dateStr] of this.interactionLog.entries()) {
      if (new Date(dateStr) < cutoff) {
        this.interactionLog.delete(taskId);
        removed++;
      }
    }

    if (removed > 0) {
      await this.saveData();
    }

    return removed;
  }
}

// Singleton instance
let serviceInstance: TaskFreshnessService | null = null;

export function getTaskFreshnessService(): TaskFreshnessService {
  if (!serviceInstance) {
    serviceInstance = new TaskFreshnessService();
  }
  return serviceInstance;
}

export async function initializeTaskFreshnessService(): Promise<TaskFreshnessService> {
  const service = getTaskFreshnessService();
  await service.initialize();
  return service;
}
