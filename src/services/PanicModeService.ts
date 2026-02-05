/**
 * PanicModeService - Emergency mode for when overwhelmed
 *
 * One-tap activation that:
 * - Hides all tasks except the single most important one
 * - Shows calming visuals and breathing guidance
 * - Reduces cognitive load to absolute minimum
 * - Provides gentle re-entry when ready
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { Task, EnergyLevel } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_panic_mode_settings',
  HISTORY: 'nero_panic_mode_history',
};

export type PanicModePhase =
  | 'breathing'      // Initial calming phase
  | 'grounding'      // 5-4-3-2-1 grounding exercise
  | 'single_task'    // Show one task only
  | 'gentle_exit';   // Transition back to normal

export interface PanicModeSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  trigger?: string;
  phases: PanicModePhase[];
  selectedTaskId?: string;
  helpedRating?: number; // 1-5
}

export interface PanicModeSettings {
  enabled: boolean;
  autoDetectOverwhelm: boolean;
  preferredFirstPhase: PanicModePhase;
  breathingDuration: number; // seconds
  showGroundingExercise: boolean;
  calmingColor: string;
  hapticFeedback: boolean;
  autoSelectTask: boolean; // Auto-pick most important task
}

const DEFAULT_SETTINGS: PanicModeSettings = {
  enabled: true,
  autoDetectOverwhelm: false,
  preferredFirstPhase: 'breathing',
  breathingDuration: 60,
  showGroundingExercise: true,
  calmingColor: '#1a1a2e',
  hapticFeedback: true,
  autoSelectTask: true,
};

// Breathing patterns (inhale, hold, exhale, hold) in seconds
const BREATHING_PATTERNS = {
  box: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, name: 'Box Breathing' },
  calm: { inhale: 4, holdIn: 0, exhale: 6, holdOut: 2, name: '4-6 Calm' },
  quick: { inhale: 3, holdIn: 0, exhale: 3, holdOut: 0, name: 'Quick Calm' },
};

// Grounding prompts for 5-4-3-2-1 technique
const GROUNDING_PROMPTS = {
  see: ['5 things you can see', 'Look around. Name 5 things in your view.'],
  touch: ['4 things you can touch', 'Feel 4 different textures near you.'],
  hear: ['3 things you can hear', 'Listen for 3 sounds around you.'],
  smell: ['2 things you can smell', 'Notice 2 scents in your space.'],
  taste: ['1 thing you can taste', 'What taste is in your mouth right now?'],
};

// Calming affirmations
const AFFIRMATIONS = [
  "This feeling will pass.",
  "You don't have to figure everything out right now.",
  "One thing at a time.",
  "It's okay to feel overwhelmed.",
  "You've gotten through hard moments before.",
  "Right now, you only need to breathe.",
  "There's no rush. Take your time.",
  "You're doing better than you think.",
];

export class PanicModeService {
  private settings: PanicModeSettings = DEFAULT_SETTINGS;
  private sessions: PanicModeSession[] = [];
  private currentSession: PanicModeSession | null = null;
  private currentPhase: PanicModePhase | null = null;

  // Callbacks
  private onPhaseChange?: (phase: PanicModePhase) => void;
  private onSessionEnd?: (session: PanicModeSession) => void;

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
        this.sessions = JSON.parse(historyJson);
      }
    } catch (error) {
      console.error('Failed to initialize PanicModeService:', error);
    }
  }

  // ============ SESSION MANAGEMENT ============

  async startPanicMode(trigger?: string): Promise<PanicModeSession> {
    // Haptic feedback to acknowledge activation
    if (this.settings.hapticFeedback && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    this.currentSession = {
      id: `panic_${Date.now()}`,
      startedAt: new Date().toISOString(),
      trigger,
      phases: [],
    };

    // Start with preferred first phase
    await this.goToPhase(this.settings.preferredFirstPhase);

    return this.currentSession;
  }

  async endPanicMode(helpedRating?: number): Promise<PanicModeSession | null> {
    if (!this.currentSession) return null;

    this.currentSession.endedAt = new Date().toISOString();
    this.currentSession.helpedRating = helpedRating;

    this.sessions.push(this.currentSession);
    await this.saveHistory();

    const session = this.currentSession;
    this.currentSession = null;
    this.currentPhase = null;

    this.onSessionEnd?.(session);
    return session;
  }

  isActive(): boolean {
    return this.currentSession !== null;
  }

  getCurrentPhase(): PanicModePhase | null {
    return this.currentPhase;
  }

  getCurrentSession(): PanicModeSession | null {
    return this.currentSession;
  }

  // ============ PHASE NAVIGATION ============

  async goToPhase(phase: PanicModePhase): Promise<void> {
    if (!this.currentSession) return;

    this.currentPhase = phase;
    this.currentSession.phases.push(phase);

    // Gentle haptic on phase change
    if (this.settings.hapticFeedback && Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    this.onPhaseChange?.(phase);
  }

  async nextPhase(): Promise<PanicModePhase | null> {
    if (!this.currentPhase) return null;

    const phases: PanicModePhase[] = ['breathing', 'grounding', 'single_task', 'gentle_exit'];
    const currentIndex = phases.indexOf(this.currentPhase);

    if (currentIndex < phases.length - 1) {
      const nextPhase = phases[currentIndex + 1];

      // Skip grounding if disabled
      if (nextPhase === 'grounding' && !this.settings.showGroundingExercise) {
        await this.goToPhase('single_task');
        return 'single_task';
      }

      await this.goToPhase(nextPhase);
      return nextPhase;
    }

    return null;
  }

  // ============ BREATHING GUIDANCE ============

  getBreathingPattern(type: keyof typeof BREATHING_PATTERNS = 'box') {
    return BREATHING_PATTERNS[type];
  }

  getAllBreathingPatterns() {
    return Object.entries(BREATHING_PATTERNS).map(([key, value]) => ({
      id: key,
      ...value,
    }));
  }

  generateBreathingSequence(
    pattern: keyof typeof BREATHING_PATTERNS = 'box',
    cycles: number = 4
  ): Array<{ action: 'inhale' | 'holdIn' | 'exhale' | 'holdOut'; duration: number }> {
    const p = BREATHING_PATTERNS[pattern];
    const sequence: Array<{ action: 'inhale' | 'holdIn' | 'exhale' | 'holdOut'; duration: number }> = [];

    for (let i = 0; i < cycles; i++) {
      if (p.inhale > 0) sequence.push({ action: 'inhale', duration: p.inhale });
      if (p.holdIn > 0) sequence.push({ action: 'holdIn', duration: p.holdIn });
      if (p.exhale > 0) sequence.push({ action: 'exhale', duration: p.exhale });
      if (p.holdOut > 0) sequence.push({ action: 'holdOut', duration: p.holdOut });
    }

    return sequence;
  }

  // ============ GROUNDING EXERCISE ============

  getGroundingPrompts() {
    return GROUNDING_PROMPTS;
  }

  getGroundingSequence(): Array<{
    sense: string;
    count: number;
    prompt: string;
    detail: string;
  }> {
    return [
      { sense: 'see', count: 5, ...this.formatGrounding('see') },
      { sense: 'touch', count: 4, ...this.formatGrounding('touch') },
      { sense: 'hear', count: 3, ...this.formatGrounding('hear') },
      { sense: 'smell', count: 2, ...this.formatGrounding('smell') },
      { sense: 'taste', count: 1, ...this.formatGrounding('taste') },
    ];
  }

  private formatGrounding(sense: keyof typeof GROUNDING_PROMPTS) {
    const prompts = GROUNDING_PROMPTS[sense];
    return { prompt: prompts[0], detail: prompts[1] };
  }

  // ============ TASK SELECTION ============

  selectMostImportantTask(tasks: Task[]): Task | null {
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) return null;

    // Score tasks
    const scored = incompleteTasks.map(task => {
      let score = 0;

      // Overdue tasks get highest priority
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        if (dueDate < now) {
          score += 100;
        } else {
          const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursUntilDue < 24) score += 50;
          else if (hoursUntilDue < 72) score += 25;
        }
      }

      // Prefer low-energy tasks during panic mode (easier to accomplish)
      if (task.energy === 'low') score += 30;
      else if (task.energy === 'medium') score += 15;

      // Prefer micro-steps (smaller, more achievable)
      if (task.isMicroStep) score += 20;

      return { task, score };
    });

    // Sort by score and return highest
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.task || null;
  }

  async setSelectedTask(taskId: string): Promise<void> {
    if (this.currentSession) {
      this.currentSession.selectedTaskId = taskId;
    }
  }

  // ============ AFFIRMATIONS ============

  getRandomAffirmation(): string {
    return AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)];
  }

  getAllAffirmations(): string[] {
    return [...AFFIRMATIONS];
  }

  // ============ OVERWHELM DETECTION ============

  /**
   * Detect potential overwhelm based on user behavior patterns
   */
  detectOverwhelm(signals: {
    rapidTaskSwitching?: boolean;
    longInactivity?: boolean;
    repeatedAppOpens?: boolean;
    lowMoodRecent?: boolean;
    manyOverdueTasks?: boolean;
  }): { isOverwhelmed: boolean; confidence: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (signals.rapidTaskSwitching) {
      score += 25;
      reasons.push('Switching between tasks frequently');
    }
    if (signals.longInactivity) {
      score += 20;
      reasons.push('Long period of inactivity');
    }
    if (signals.repeatedAppOpens) {
      score += 15;
      reasons.push('Opening app repeatedly without action');
    }
    if (signals.lowMoodRecent) {
      score += 25;
      reasons.push('Recent low mood entries');
    }
    if (signals.manyOverdueTasks) {
      score += 15;
      reasons.push('Multiple overdue tasks');
    }

    return {
      isOverwhelmed: score >= 50,
      confidence: Math.min(score, 100),
      reasons,
    };
  }

  // ============ STATISTICS ============

  getStatistics(): {
    totalSessions: number;
    avgDuration: number;
    avgHelpedRating: number;
    mostUsedPhases: Record<PanicModePhase, number>;
    commonTriggers: string[];
  } {
    const completedSessions = this.sessions.filter(s => s.endedAt);

    // Calculate average duration
    const durations = completedSessions.map(s => {
      const start = new Date(s.startedAt).getTime();
      const end = new Date(s.endedAt!).getTime();
      return (end - start) / 1000 / 60; // minutes
    });
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Calculate average helped rating
    const ratings = completedSessions
      .filter(s => s.helpedRating !== undefined)
      .map(s => s.helpedRating!);
    const avgHelpedRating = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Count phase usage
    const phaseCount: Record<PanicModePhase, number> = {
      breathing: 0,
      grounding: 0,
      single_task: 0,
      gentle_exit: 0,
    };
    for (const session of this.sessions) {
      for (const phase of session.phases) {
        phaseCount[phase]++;
      }
    }

    // Find common triggers
    const triggerCounts = new Map<string, number>();
    for (const session of this.sessions) {
      if (session.trigger) {
        triggerCounts.set(session.trigger, (triggerCounts.get(session.trigger) || 0) + 1);
      }
    }
    const commonTriggers = Array.from(triggerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trigger]) => trigger);

    return {
      totalSessions: this.sessions.length,
      avgDuration: Math.round(avgDuration * 10) / 10,
      avgHelpedRating: Math.round(avgHelpedRating * 10) / 10,
      mostUsedPhases: phaseCount,
      commonTriggers,
    };
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<PanicModeSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): PanicModeSettings {
    return { ...this.settings };
  }

  // ============ CALLBACKS ============

  setOnPhaseChange(callback: (phase: PanicModePhase) => void): void {
    this.onPhaseChange = callback;
  }

  setOnSessionEnd(callback: (session: PanicModeSession) => void): void {
    this.onSessionEnd = callback;
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save panic mode settings:', error);
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      // Keep last 100 sessions
      const toSave = this.sessions.slice(-100);
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save panic mode history:', error);
    }
  }

  getSessions(limit?: number): PanicModeSession[] {
    const sorted = [...this.sessions].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }
}

// Singleton instance
let serviceInstance: PanicModeService | null = null;

export function getPanicModeService(): PanicModeService {
  if (!serviceInstance) {
    serviceInstance = new PanicModeService();
  }
  return serviceInstance;
}

export async function initializePanicModeService(): Promise<PanicModeService> {
  const service = getPanicModeService();
  await service.initialize();
  return service;
}
