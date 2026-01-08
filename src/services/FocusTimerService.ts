import { FocusSession, FocusTimerSettings, FocusTimerStatus, MoodLevel } from '../types';
import { genId, DEFAULT_FOCUS_TIMER_SETTINGS } from '../constants';

// ============ FOCUS TIMER SERVICE ============
// Pomodoro-style timer with ADHD-friendly adaptations
export class FocusTimerService {
  private currentSession: FocusSession | null = null;
  private settings: FocusTimerSettings = DEFAULT_FOCUS_TIMER_SETTINGS;
  private timerInterval: NodeJS.Timeout | null = null;
  private remainingSeconds: number = 0;
  private onTick: ((remaining: number) => void) | null = null;
  private onComplete: ((session: FocusSession) => void) | null = null;
  private onBreakStart: (() => void) | null = null;
  private sessionHistory: FocusSession[] = [];

  setSettings(settings: Partial<FocusTimerSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  getSettings(): FocusTimerSettings {
    return this.settings;
  }

  setCallbacks(callbacks: {
    onTick?: (remaining: number) => void;
    onComplete?: (session: FocusSession) => void;
    onBreakStart?: () => void;
  }) {
    if (callbacks.onTick) this.onTick = callbacks.onTick;
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
    if (callbacks.onBreakStart) this.onBreakStart = callbacks.onBreakStart;
  }

  startFocusSession(taskId?: string, mood?: MoodLevel): FocusSession {
    // Clear any existing timer
    this.stopTimer();

    const session: FocusSession = {
      id: genId(),
      taskId,
      startTime: new Date().toISOString(),
      duration: this.settings.focusDuration * 60,
      breakDuration: 0,
      status: 'running',
      completedPomodoros: 0,
      mood,
    };

    this.currentSession = session;
    this.remainingSeconds = this.settings.focusDuration * 60;
    this.startTimer();

    return session;
  }

  private startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        if (this.onTick) {
          this.onTick(this.remainingSeconds);
        }
      } else {
        this.handleTimerComplete();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleTimerComplete() {
    this.stopTimer();

    if (!this.currentSession) return;

    if (this.currentSession.status === 'running') {
      // Focus session completed - start break
      this.currentSession.completedPomodoros++;

      const isLongBreak = this.currentSession.completedPomodoros % this.settings.pomodorosUntilLongBreak === 0;
      const breakDuration = isLongBreak
        ? this.settings.longBreakDuration
        : this.settings.shortBreakDuration;

      if (this.settings.autoStartBreaks) {
        this.currentSession.status = 'break';
        this.remainingSeconds = breakDuration * 60;
        this.currentSession.breakDuration = breakDuration * 60;
        this.startTimer();
        if (this.onBreakStart) {
          this.onBreakStart();
        }
      } else {
        this.currentSession.status = 'paused';
        if (this.onComplete) {
          this.onComplete(this.currentSession);
        }
      }
    } else if (this.currentSession.status === 'break') {
      // Break completed
      if (this.settings.autoStartNextPomodoro) {
        this.currentSession.status = 'running';
        this.remainingSeconds = this.settings.focusDuration * 60;
        this.startTimer();
      } else {
        this.currentSession.status = 'completed';
        this.currentSession.endTime = new Date().toISOString();
        this.sessionHistory.push(this.currentSession);
        if (this.onComplete) {
          this.onComplete(this.currentSession);
        }
      }
    }
  }

  pause(): void {
    if (this.currentSession?.status === 'running' || this.currentSession?.status === 'break') {
      this.stopTimer();
      this.currentSession.status = 'paused';
    }
  }

  resume(): void {
    if (this.currentSession?.status === 'paused') {
      this.currentSession.status = 'running';
      this.startTimer();
    }
  }

  startBreak(isLong: boolean = false): void {
    if (!this.currentSession) return;

    this.stopTimer();
    this.currentSession.status = 'break';
    const breakDuration = isLong ? this.settings.longBreakDuration : this.settings.shortBreakDuration;
    this.remainingSeconds = breakDuration * 60;
    this.currentSession.breakDuration = breakDuration * 60;
    this.startTimer();
    if (this.onBreakStart) {
      this.onBreakStart();
    }
  }

  skipBreak(): void {
    if (this.currentSession?.status === 'break') {
      this.stopTimer();
      this.currentSession.status = 'running';
      this.remainingSeconds = this.settings.focusDuration * 60;
      this.startTimer();
    }
  }

  stop(): FocusSession | null {
    this.stopTimer();
    if (this.currentSession) {
      this.currentSession.status = 'completed';
      this.currentSession.endTime = new Date().toISOString();
      const session = this.currentSession;
      this.sessionHistory.push(session);
      this.currentSession = null;
      return session;
    }
    return null;
  }

  getCurrentSession(): FocusSession | null {
    return this.currentSession;
  }

  getRemainingSeconds(): number {
    return this.remainingSeconds;
  }

  getSessionHistory(): FocusSession[] {
    return this.sessionHistory;
  }

  setSessionHistory(history: FocusSession[]) {
    this.sessionHistory = history;
  }

  getTotalFocusMinutes(): number {
    return this.sessionHistory.reduce((total, session) => {
      return total + Math.floor(session.duration / 60);
    }, 0);
  }

  getTotalPomodoros(): number {
    return this.sessionHistory.reduce((total, session) => {
      return total + session.completedPomodoros;
    }, 0);
  }

  getAverageSessionLength(): number {
    if (this.sessionHistory.length === 0) return 0;
    const totalMinutes = this.getTotalFocusMinutes();
    return Math.round(totalMinutes / this.sessionHistory.length);
  }

  // ADHD-friendly adaptive timing
  suggestOptimalDuration(energy: 'low' | 'medium' | 'high'): number {
    // Shorter sessions for lower energy
    switch (energy) {
      case 'low':
        return 10; // 10 minutes is more achievable
      case 'medium':
        return 20; // 20 minutes
      case 'high':
        return 25; // Standard pomodoro
      default:
        return 25;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}
