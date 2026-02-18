/**
 * TransitionService - Helps with task transitions
 *
 * Task transitions are a major challenge for ADHD - switching between
 * tasks or from break to work requires significant executive function.
 *
 * Features:
 * - Transition prompts between tasks
 * - Break-to-work transitions
 * - Context switching support
 * - Optional breathing exercises
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type {
  TransitionType,
  TransitionPrompt,
  TransitionSettings,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_transition_settings',
  HISTORY: 'nero_transition_history',
};

interface TransitionRecord {
  id: string;
  type: TransitionType;
  timestamp: string;
  fromTask?: string;
  toTask?: string;
  duration: number; // seconds taken for transition
  completedBreathing: boolean;
  skipped: boolean;
}

const DEFAULT_PROMPTS: TransitionPrompt[] = [
  // Task to task
  {
    id: 't2t_1',
    type: 'task_to_task',
    message: 'Before switching, take a breath and acknowledge what you just did.',
    action: 'Breathe and reflect',
    duration: 10,
  },
  {
    id: 't2t_2',
    type: 'task_to_task',
    message: 'Pause. What do you need to remember before moving on?',
    action: 'Make a note',
    duration: 15,
  },
  {
    id: 't2t_3',
    type: 'task_to_task',
    message: 'You completed something! Take a moment to celebrate.',
    action: 'Mini celebration',
    duration: 5,
  },

  // Break to work
  {
    id: 'b2w_1',
    type: 'break_to_work',
    message: 'Break time is ending. What\'s your ONE focus for the next session?',
    action: 'Set intention',
    duration: 15,
  },
  {
    id: 'b2w_2',
    type: 'break_to_work',
    message: 'Returning to work. Three deep breaths first.',
    action: 'Breathe',
    duration: 20,
  },
  {
    id: 'b2w_3',
    type: 'break_to_work',
    message: 'Time to refocus. Close unnecessary tabs/apps.',
    action: 'Clear distractions',
    duration: 30,
  },

  // Work to break
  {
    id: 'w2b_1',
    type: 'work_to_break',
    message: 'Great work! Step away from the screen.',
    action: 'Stand and stretch',
    duration: 10,
  },
  {
    id: 'w2b_2',
    type: 'work_to_break',
    message: 'Break time. What will actually help you recharge?',
    action: 'Choose wisely',
    duration: 10,
  },

  // Context switch
  {
    id: 'cs_1',
    type: 'context_switch',
    message: 'Major context switch detected. Your brain needs a moment.',
    action: 'Take 30 seconds',
    duration: 30,
  },
  {
    id: 'cs_2',
    type: 'context_switch',
    message: 'Switching contexts is hard. Be patient with yourself.',
    action: 'Ground yourself',
    duration: 20,
  },
];

const DEFAULT_SETTINGS: TransitionSettings = {
  enabled: true,
  showBetweenTasks: true,
  showBreakTransitions: true,
  includeBreathingExercise: true,
  transitionDuration: 15,
  customPrompts: [],
};

export class TransitionService {
  private settings: TransitionSettings = DEFAULT_SETTINGS;
  private history: TransitionRecord[] = [];
  private prompts: TransitionPrompt[] = [...DEFAULT_PROMPTS];
  private currentTransition: {
    type: TransitionType;
    startTime: number;
    fromTask?: string;
    toTask?: string;
  } | null = null;

  async initialize(): Promise<void> {
    try {
      const [settingsJson, historyJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
      ]);

      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }

      if (historyJson) {
        this.history = JSON.parse(historyJson);
      }

      // Add custom prompts
      this.prompts = [...DEFAULT_PROMPTS, ...this.settings.customPrompts];
    } catch (error) {
      console.error('Failed to initialize TransitionService:', error);
    }
  }

  // ============ TRANSITION MANAGEMENT ============

  shouldShowTransition(type: TransitionType): boolean {
    if (!this.settings.enabled) return false;

    switch (type) {
      case 'task_to_task':
        return this.settings.showBetweenTasks;
      case 'break_to_work':
      case 'work_to_break':
        return this.settings.showBreakTransitions;
      case 'context_switch':
        return true; // Always show for major context switches
      default:
        return true;
    }
  }

  startTransition(
    type: TransitionType,
    options?: {
      fromTask?: string;
      toTask?: string;
    }
  ): TransitionPrompt | null {
    if (!this.shouldShowTransition(type)) {
      return null;
    }

    this.currentTransition = {
      type,
      startTime: Date.now(),
      fromTask: options?.fromTask,
      toTask: options?.toTask,
    };

    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    return this.getRandomPrompt(type);
  }

  async completeTransition(completedBreathing: boolean = false): Promise<void> {
    if (!this.currentTransition) return;

    const duration = Math.round((Date.now() - this.currentTransition.startTime) / 1000);

    const record: TransitionRecord = {
      id: `trans_${Date.now()}`,
      type: this.currentTransition.type,
      timestamp: new Date().toISOString(),
      fromTask: this.currentTransition.fromTask,
      toTask: this.currentTransition.toTask,
      duration,
      completedBreathing,
      skipped: false,
    };

    this.history.push(record);
    await this.saveHistory();

    this.currentTransition = null;
  }

  async skipTransition(): Promise<void> {
    if (!this.currentTransition) return;

    const duration = Math.round((Date.now() - this.currentTransition.startTime) / 1000);

    const record: TransitionRecord = {
      id: `trans_${Date.now()}`,
      type: this.currentTransition.type,
      timestamp: new Date().toISOString(),
      fromTask: this.currentTransition.fromTask,
      toTask: this.currentTransition.toTask,
      duration,
      completedBreathing: false,
      skipped: true,
    };

    this.history.push(record);
    await this.saveHistory();

    this.currentTransition = null;
  }

  isInTransition(): boolean {
    return this.currentTransition !== null;
  }

  // ============ PROMPTS ============

  getRandomPrompt(type: TransitionType): TransitionPrompt {
    const typePrompts = this.prompts.filter(p => p.type === type);
    if (typePrompts.length === 0) {
      // Fallback
      return {
        id: 'fallback',
        type,
        message: 'Take a moment before continuing.',
        duration: 10,
      };
    }
    return typePrompts[Math.floor(Math.random() * typePrompts.length)];
  }

  getPromptsForType(type: TransitionType): TransitionPrompt[] {
    return this.prompts.filter(p => p.type === type);
  }

  getAllPrompts(): TransitionPrompt[] {
    return [...this.prompts];
  }

  // ============ CUSTOM PROMPTS ============

  async addCustomPrompt(
    type: TransitionType,
    message: string,
    options?: {
      action?: string;
      duration?: number;
    }
  ): Promise<TransitionPrompt> {
    const prompt: TransitionPrompt = {
      id: `custom_${Date.now()}`,
      type,
      message,
      action: options?.action,
      duration: options?.duration || this.settings.transitionDuration,
    };

    this.prompts.push(prompt);
    this.settings.customPrompts.push(prompt);
    await this.saveSettings();

    return prompt;
  }

  async removeCustomPrompt(promptId: string): Promise<boolean> {
    if (!promptId.startsWith('custom_')) return false;

    this.prompts = this.prompts.filter(p => p.id !== promptId);
    this.settings.customPrompts = this.settings.customPrompts.filter(p => p.id !== promptId);
    await this.saveSettings();

    return true;
  }

  // ============ BREATHING EXERCISE ============

  getBreathingExercise(): {
    steps: Array<{
      instruction: string;
      duration: number; // seconds
    }>;
    totalDuration: number;
  } {
    // 4-7-8 breathing technique
    const steps = [
      { instruction: 'Breathe in through your nose', duration: 4 },
      { instruction: 'Hold your breath', duration: 7 },
      { instruction: 'Exhale slowly through your mouth', duration: 8 },
    ];

    // Repeat 3 times
    const fullSteps = [...steps, ...steps, ...steps];

    return {
      steps: fullSteps,
      totalDuration: fullSteps.reduce((sum, s) => sum + s.duration, 0),
    };
  }

  getQuickBreathingExercise(): {
    steps: Array<{
      instruction: string;
      duration: number;
    }>;
    totalDuration: number;
  } {
    // Simple 3-3-3 breathing
    const steps = [
      { instruction: 'Breathe in', duration: 3 },
      { instruction: 'Hold', duration: 3 },
      { instruction: 'Breathe out', duration: 3 },
    ];

    // Repeat 2 times
    const fullSteps = [...steps, ...steps];

    return {
      steps: fullSteps,
      totalDuration: fullSteps.reduce((sum, s) => sum + s.duration, 0),
    };
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<TransitionSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): TransitionSettings {
    return { ...this.settings };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.saveSettings();
  }

  // ============ STATISTICS ============

  getStatistics(): {
    totalTransitions: number;
    completedTransitions: number;
    skippedTransitions: number;
    avgDuration: number;
    breathingCompletionRate: number;
    byType: Record<TransitionType, number>;
  } {
    const totalTransitions = this.history.length;
    const completedTransitions = this.history.filter(r => !r.skipped).length;
    const skippedTransitions = this.history.filter(r => r.skipped).length;

    const totalDuration = this.history
      .filter(r => !r.skipped)
      .reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = completedTransitions > 0
      ? totalDuration / completedTransitions
      : 0;

    const withBreathing = this.history.filter(r => r.completedBreathing).length;
    const breathingCompletionRate = completedTransitions > 0
      ? (withBreathing / completedTransitions) * 100
      : 0;

    const byType: Record<TransitionType, number> = {
      task_to_task: 0,
      break_to_work: 0,
      work_to_break: 0,
      context_switch: 0,
    };

    for (const record of this.history) {
      byType[record.type]++;
    }

    return {
      totalTransitions,
      completedTransitions,
      skippedTransitions,
      avgDuration: Math.round(avgDuration),
      breathingCompletionRate: Math.round(breathingCompletionRate),
      byType,
    };
  }

  getInsights(): string[] {
    const insights: string[] = [];
    const stats = this.getStatistics();

    if (stats.totalTransitions > 0) {
      const completionRate = Math.round(
        (stats.completedTransitions / stats.totalTransitions) * 100
      );

      if (completionRate >= 80) {
        insights.push(`🌟 Great job! You complete ${completionRate}% of transitions`);
      } else if (completionRate >= 50) {
        insights.push(`📊 You complete about half your transitions - every bit helps!`);
      } else {
        insights.push(`💡 Try using more transitions - they help your brain reset`);
      }

      if (stats.breathingCompletionRate >= 50) {
        insights.push(`🧘 You include breathing ${Math.round(stats.breathingCompletionRate)}% of the time - excellent!`);
      }

      // Most common transition type
      const maxType = Object.entries(stats.byType)
        .sort((a, b) => b[1] - a[1])[0];

      if (maxType && maxType[1] > 5) {
        const typeLabels: Record<TransitionType, string> = {
          task_to_task: 'task switches',
          break_to_work: 'returning from breaks',
          work_to_break: 'starting breaks',
          context_switch: 'context switches',
        };
        insights.push(`🔄 Most common: ${typeLabels[maxType[0] as TransitionType]}`);
      }
    } else {
      insights.push('💭 Transitions help your brain switch modes smoothly');
      insights.push('🧘 Even 10 seconds between tasks can improve focus');
    }

    return insights;
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save transition settings:', error);
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      // Keep last 200 records
      this.history = this.history.slice(-200);
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Failed to save transition history:', error);
    }
  }
}

// Singleton instance
let serviceInstance: TransitionService | null = null;

export function getTransitionService(): TransitionService {
  if (!serviceInstance) {
    serviceInstance = new TransitionService();
  }
  return serviceInstance;
}

export async function initializeTransitionService(): Promise<TransitionService> {
  const service = getTransitionService();
  await service.initialize();
  return service;
}
