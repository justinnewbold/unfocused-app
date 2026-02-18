/**
 * RecurringTaskService - Manages recurring/repeating tasks
 *
 * Features:
 * - Daily, weekly, monthly recurrence
 * - Custom intervals
 * - Specific days of week
 * - Auto-generation of next occurrence
 * - Completion tracking across occurrences
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  RecurrenceRule,
  RecurringTask,
  DayOfWeek,
  EnergyLevel,
  Task,
} from '../types';

const STORAGE_KEY = 'nero_recurring_tasks';

const DAY_MAP: Record<DayOfWeek, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const REVERSE_DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

export class RecurringTaskService {
  private recurringTasks: RecurringTask[] = [];

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.recurringTasks = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load recurring tasks:', error);
    }
  }

  // ============ TASK MANAGEMENT ============

  async createRecurringTask(
    title: string,
    energy: EnergyLevel,
    recurrence: RecurrenceRule
  ): Promise<RecurringTask> {
    const now = new Date().toISOString();
    const task: RecurringTask = {
      id: this.generateId(),
      title,
      energy,
      completed: false,
      isMicroStep: false,
      createdAt: now,
      recurrence,
      nextOccurrence: this.calculateNextOccurrence(recurrence, new Date()),
    };

    this.recurringTasks.push(task);
    await this.save();
    return task;
  }

  async updateRecurringTask(
    taskId: string,
    updates: Partial<Omit<RecurringTask, 'id' | 'createdAt'>>
  ): Promise<RecurringTask | null> {
    const index = this.recurringTasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    // If recurrence changed, recalculate next occurrence
    if (updates.recurrence) {
      updates.nextOccurrence = this.calculateNextOccurrence(updates.recurrence, new Date());
    }

    this.recurringTasks[index] = { ...this.recurringTasks[index], ...updates };
    await this.save();
    return this.recurringTasks[index];
  }

  async deleteRecurringTask(taskId: string): Promise<boolean> {
    const initialLength = this.recurringTasks.length;
    this.recurringTasks = this.recurringTasks.filter(t => t.id !== taskId);
    if (this.recurringTasks.length !== initialLength) {
      await this.save();
      return true;
    }
    return false;
  }

  getRecurringTasks(): RecurringTask[] {
    return [...this.recurringTasks];
  }

  getRecurringTask(taskId: string): RecurringTask | null {
    return this.recurringTasks.find(t => t.id === taskId) || null;
  }

  // ============ OCCURRENCE MANAGEMENT ============

  /**
   * Complete the current occurrence and schedule the next one
   */
  async completeOccurrence(taskId: string): Promise<RecurringTask | null> {
    const task = this.recurringTasks.find(t => t.id === taskId);
    if (!task) return null;

    const now = new Date();

    // Update occurrence count
    task.recurrence.occurrencesCompleted = (task.recurrence.occurrencesCompleted || 0) + 1;
    task.lastCompleted = now.toISOString();

    // Check if we've reached max occurrences
    if (task.recurrence.maxOccurrences &&
        task.recurrence.occurrencesCompleted >= task.recurrence.maxOccurrences) {
      task.completed = true;
      task.completedAt = now.toISOString();
    } else if (task.recurrence.endDate && new Date(task.recurrence.endDate) < now) {
      // Check if we've passed end date
      task.completed = true;
      task.completedAt = now.toISOString();
    } else {
      // Calculate next occurrence
      task.nextOccurrence = this.calculateNextOccurrence(task.recurrence, now);
    }

    await this.save();
    return task;
  }

  /**
   * Skip the current occurrence without completing
   */
  async skipOccurrence(taskId: string): Promise<RecurringTask | null> {
    const task = this.recurringTasks.find(t => t.id === taskId);
    if (!task) return null;

    task.nextOccurrence = this.calculateNextOccurrence(task.recurrence, new Date());
    await this.save();
    return task;
  }

  /**
   * Get tasks that are due today or overdue
   */
  getDueTasks(): RecurringTask[] {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return this.recurringTasks.filter(task => {
      if (task.completed) return false;
      if (!task.nextOccurrence) return false;
      return new Date(task.nextOccurrence) <= today;
    });
  }

  /**
   * Get tasks due within the next N days
   */
  getUpcomingTasks(days: number): RecurringTask[] {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    futureDate.setHours(23, 59, 59, 999);

    return this.recurringTasks.filter(task => {
      if (task.completed) return false;
      if (!task.nextOccurrence) return false;
      return new Date(task.nextOccurrence) <= futureDate;
    });
  }

  /**
   * Convert a recurring task to a regular task instance for the current occurrence
   */
  createTaskInstance(recurringTask: RecurringTask): Task {
    return {
      id: `${recurringTask.id}_${Date.now()}`,
      title: recurringTask.title,
      energy: recurringTask.energy,
      completed: false,
      isMicroStep: recurringTask.isMicroStep,
      parentId: recurringTask.id, // Link to recurring task
      createdAt: new Date().toISOString(),
      dueDate: recurringTask.nextOccurrence,
    };
  }

  // ============ RECURRENCE CALCULATION ============

  calculateNextOccurrence(rule: RecurrenceRule, fromDate: Date): string {
    const next = new Date(fromDate);
    next.setHours(9, 0, 0, 0); // Default to 9 AM

    switch (rule.frequency) {
      case 'daily':
        next.setDate(next.getDate() + rule.interval);
        break;

      case 'weekly':
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
          // Find next matching day of week
          const currentDay = fromDate.getDay();
          const targetDays = rule.daysOfWeek.map(d => DAY_MAP[d]).sort((a, b) => a - b);

          // Find next day that's after current day
          let nextDay = targetDays.find(d => d > currentDay);

          if (nextDay !== undefined) {
            next.setDate(next.getDate() + (nextDay - currentDay));
          } else {
            // No more days this week, go to first day next week(s)
            const daysUntilNextWeek = 7 - currentDay + targetDays[0];
            next.setDate(next.getDate() + daysUntilNextWeek + (rule.interval - 1) * 7);
          }
        } else {
          next.setDate(next.getDate() + rule.interval * 7);
        }
        break;

      case 'monthly':
        next.setMonth(next.getMonth() + rule.interval);
        if (rule.dayOfMonth) {
          // Handle months with fewer days
          const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
          next.setDate(Math.min(rule.dayOfMonth, lastDayOfMonth));
        }
        break;

      case 'custom':
        // Custom interval in days
        next.setDate(next.getDate() + rule.interval);
        break;
    }

    // Make sure it's in the future
    if (next <= fromDate) {
      // Advance by at least one day to prevent infinite recursion
      next.setDate(next.getDate() + 1);
      return this.calculateNextOccurrence(rule, next);
    }

    // Check end date
    if (rule.endDate && next > new Date(rule.endDate)) {
      return rule.endDate;
    }

    return next.toISOString();
  }

  // ============ PRESETS ============

  getRecurrencePresets(): Array<{ name: string; rule: RecurrenceRule }> {
    return [
      {
        name: 'Daily',
        rule: { frequency: 'daily', interval: 1 },
      },
      {
        name: 'Weekdays',
        rule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
        },
      },
      {
        name: 'Weekends',
        rule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['sat', 'sun'],
        },
      },
      {
        name: 'Weekly',
        rule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [REVERSE_DAY_MAP[new Date().getDay()]],
        },
      },
      {
        name: 'Every 2 weeks',
        rule: {
          frequency: 'weekly',
          interval: 2,
          daysOfWeek: [REVERSE_DAY_MAP[new Date().getDay()]],
        },
      },
      {
        name: 'Monthly',
        rule: {
          frequency: 'monthly',
          interval: 1,
          dayOfMonth: new Date().getDate(),
        },
      },
      {
        name: 'Every 3 days',
        rule: { frequency: 'custom', interval: 3 },
      },
    ];
  }

  // ============ HELPERS ============

  private generateId(): string {
    return `rec_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.recurringTasks));
    } catch (error) {
      console.error('Failed to save recurring tasks:', error);
    }
  }

  // ============ STATISTICS ============

  getStatistics(): {
    total: number;
    active: number;
    completionRate: number;
    byFrequency: Record<string, number>;
  } {
    const active = this.recurringTasks.filter(t => !t.completed);
    const totalOccurrences = this.recurringTasks.reduce(
      (sum, t) => sum + (t.recurrence.occurrencesCompleted || 0),
      0
    );

    const byFrequency: Record<string, number> = {};
    for (const task of active) {
      const freq = task.recurrence.frequency;
      byFrequency[freq] = (byFrequency[freq] || 0) + 1;
    }

    return {
      total: this.recurringTasks.length,
      active: active.length,
      completionRate: totalOccurrences,
      byFrequency,
    };
  }
}

// Singleton instance
let serviceInstance: RecurringTaskService | null = null;

export function getRecurringTaskService(): RecurringTaskService {
  if (!serviceInstance) {
    serviceInstance = new RecurringTaskService();
  }
  return serviceInstance;
}

export async function initializeRecurringTaskService(): Promise<RecurringTaskService> {
  const service = getRecurringTaskService();
  await service.initialize();
  return service;
}
