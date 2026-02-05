/**
 * BodyDoublingService - Virtual body doubling for focus
 *
 * Body doubling is an ADHD strategy where having another person present
 * (physically or virtually) helps with task completion.
 *
 * Features:
 * - Ambient presence sounds
 * - Virtual co-working timer
 * - Session tracking
 * - Audio environments
 */

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  BodyDoublingMode,
  BodyDoublingSession,
  BodyDoublingSettings,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_body_doubling_settings',
  SESSIONS: 'nero_body_doubling_sessions',
  STATS: 'nero_body_doubling_stats',
};

interface AmbientSound {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'cafe' | 'office' | 'library' | 'nature' | 'home';
}

interface BodyDoublingStats {
  totalSessions: number;
  totalMinutes: number;
  favoriteMode: BodyDoublingMode | null;
  longestSession: number;
  avgSessionLength: number;
}

const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'cafe_busy', name: 'Busy Café', description: 'Murmured conversations, coffee machines', emoji: '☕', category: 'cafe' },
  { id: 'cafe_quiet', name: 'Quiet Café', description: 'Soft chatter, gentle clinking', emoji: '🍵', category: 'cafe' },
  { id: 'office_typing', name: 'Office Typing', description: 'Keyboards clicking, productive energy', emoji: '⌨️', category: 'office' },
  { id: 'office_busy', name: 'Busy Office', description: 'Open office background', emoji: '🏢', category: 'office' },
  { id: 'library', name: 'Library', description: 'Pages turning, soft footsteps', emoji: '📚', category: 'library' },
  { id: 'study_room', name: 'Study Room', description: 'Pen scratching, quiet focus', emoji: '✏️', category: 'library' },
  { id: 'rain_window', name: 'Rain on Window', description: 'Gentle rain, cozy indoors', emoji: '🌧️', category: 'nature' },
  { id: 'fireplace', name: 'Fireplace', description: 'Crackling fire, warm ambience', emoji: '🔥', category: 'home' },
  { id: 'fan_white', name: 'Fan/AC', description: 'Steady white noise', emoji: '💨', category: 'home' },
];

const DEFAULT_SETTINGS: BodyDoublingSettings = {
  preferredMode: 'ambient',
  ambientSounds: ['cafe_quiet'],
  autoStartWithFocus: false,
  showAvatars: true,
  muteByDefault: false,
};

export class BodyDoublingService {
  private settings: BodyDoublingSettings = DEFAULT_SETTINGS;
  private sessions: BodyDoublingSession[] = [];
  private stats: BodyDoublingStats = {
    totalSessions: 0,
    totalMinutes: 0,
    favoriteMode: null,
    longestSession: 0,
    avgSessionLength: 0,
  };

  private currentSession: BodyDoublingSession | null = null;
  private currentSound: Audio.Sound | null = null;
  private isPlaying: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Configure audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const [settingsJson, sessionsJson, statsJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.SESSIONS),
        AsyncStorage.getItem(STORAGE_KEYS.STATS),
      ]);

      if (settingsJson) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      if (sessionsJson) this.sessions = JSON.parse(sessionsJson);
      if (statsJson) this.stats = JSON.parse(statsJson);
    } catch (error) {
      console.error('Failed to initialize BodyDoublingService:', error);
    }
  }

  // ============ SESSION MANAGEMENT ============

  async startSession(mode?: BodyDoublingMode): Promise<BodyDoublingSession> {
    // End any existing session
    if (this.currentSession) {
      await this.endSession();
    }

    const session: BodyDoublingSession = {
      id: `bd_${Date.now()}`,
      mode: mode || this.settings.preferredMode,
      startTime: new Date().toISOString(),
      ambientSoundId: this.settings.ambientSounds[0],
    };

    this.currentSession = session;

    // Start ambient sound if applicable
    if (session.mode === 'ambient' || session.mode === 'focus_sounds') {
      await this.playAmbientSound(session.ambientSoundId);
    }

    return session;
  }

  async endSession(): Promise<BodyDoublingSession | null> {
    if (!this.currentSession) return null;

    // Stop any playing sound
    await this.stopSound();

    // Calculate duration
    const startTime = new Date(this.currentSession.startTime);
    const duration = Math.round((Date.now() - startTime.getTime()) / (1000 * 60)); // minutes

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.duration = duration;

    // Save session
    this.sessions.push(this.currentSession);
    await this.saveSessions();

    // Update stats
    this.stats.totalSessions++;
    this.stats.totalMinutes += duration;
    if (duration > this.stats.longestSession) {
      this.stats.longestSession = duration;
    }
    this.stats.avgSessionLength = this.stats.totalMinutes / this.stats.totalSessions;
    this.updateFavoriteMode();
    await this.saveStats();

    const completedSession = this.currentSession;
    this.currentSession = null;
    return completedSession;
  }

  getCurrentSession(): BodyDoublingSession | null {
    return this.currentSession;
  }

  isInSession(): boolean {
    return this.currentSession !== null;
  }

  // ============ AMBIENT SOUNDS ============

  getAvailableSounds(): AmbientSound[] {
    return [...AMBIENT_SOUNDS];
  }

  getSoundsByCategory(category: AmbientSound['category']): AmbientSound[] {
    return AMBIENT_SOUNDS.filter(s => s.category === category);
  }

  async playAmbientSound(soundId?: string): Promise<boolean> {
    const id = soundId || this.settings.ambientSounds[0] || 'cafe_quiet';
    const sound = AMBIENT_SOUNDS.find(s => s.id === id);

    if (!sound) {
      console.log('Sound not found:', id);
      return false;
    }

    try {
      // Stop current sound
      await this.stopSound();

      // In a real app, these would be actual audio files
      // For now, we'll create a placeholder
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: this.getSoundUri(id) },
        {
          isLooping: true,
          volume: this.settings.muteByDefault ? 0 : 0.5,
        }
      );

      this.currentSound = audioSound;
      await audioSound.playAsync();
      this.isPlaying = true;

      // Update current session if active
      if (this.currentSession) {
        this.currentSession.ambientSoundId = id;
      }

      return true;
    } catch (error) {
      console.error('Failed to play ambient sound:', error);
      return false;
    }
  }

  private getSoundUri(soundId: string): string {
    // Map sound IDs to actual audio files
    // In production, these would be real URLs or bundled assets
    const soundMap: Record<string, string> = {
      cafe_busy: 'https://example.com/sounds/cafe-busy.mp3',
      cafe_quiet: 'https://example.com/sounds/cafe-quiet.mp3',
      office_typing: 'https://example.com/sounds/office-typing.mp3',
      office_busy: 'https://example.com/sounds/office-busy.mp3',
      library: 'https://example.com/sounds/library.mp3',
      study_room: 'https://example.com/sounds/study-room.mp3',
      rain_window: 'https://example.com/sounds/rain-window.mp3',
      fireplace: 'https://example.com/sounds/fireplace.mp3',
      fan_white: 'https://example.com/sounds/fan-white.mp3',
    };
    return soundMap[soundId] || '';
  }

  async stopSound(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      } catch (error) {
        // Sound may already be unloaded
      }
      this.currentSound = null;
    }
    this.isPlaying = false;
  }

  async setVolume(volume: number): Promise<void> {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (this.currentSound) {
      await this.currentSound.setVolumeAsync(clampedVolume);
    }
  }

  async toggleMute(): Promise<boolean> {
    if (this.currentSound) {
      const status = await this.currentSound.getStatusAsync();
      if (status.isLoaded) {
        const newVolume = status.volume === 0 ? 0.5 : 0;
        await this.currentSound.setVolumeAsync(newVolume);
        return newVolume === 0;
      }
    }
    return false;
  }

  isSoundPlaying(): boolean {
    return this.isPlaying;
  }

  // ============ MODES ============

  getModes(): Array<{
    mode: BodyDoublingMode;
    name: string;
    description: string;
    emoji: string;
  }> {
    return [
      {
        mode: 'ambient',
        name: 'Ambient Presence',
        description: 'Background sounds that simulate having others nearby',
        emoji: '🎧',
      },
      {
        mode: 'virtual_coworking',
        name: 'Virtual Coworking',
        description: 'Join a virtual room with others working silently',
        emoji: '👥',
      },
      {
        mode: 'study_stream',
        name: 'Study Stream',
        description: 'Watch or listen to someone else working',
        emoji: '📹',
      },
      {
        mode: 'focus_sounds',
        name: 'Focus Sounds',
        description: 'Combination of ambient sounds for deep focus',
        emoji: '🔊',
      },
    ];
  }

  async setMode(mode: BodyDoublingMode): Promise<void> {
    if (this.currentSession) {
      this.currentSession.mode = mode;
    }

    // Adjust audio based on mode
    if (mode === 'ambient' || mode === 'focus_sounds') {
      if (!this.isPlaying) {
        await this.playAmbientSound();
      }
    } else {
      await this.stopSound();
    }
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<BodyDoublingSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): BodyDoublingSettings {
    return { ...this.settings };
  }

  // ============ STATS & HISTORY ============

  getStats(): BodyDoublingStats {
    return { ...this.stats };
  }

  getRecentSessions(limit: number = 10): BodyDoublingSession[] {
    return [...this.sessions]
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }

  private updateFavoriteMode(): void {
    const modeCounts: Record<BodyDoublingMode, number> = {
      ambient: 0,
      virtual_coworking: 0,
      study_stream: 0,
      focus_sounds: 0,
    };

    for (const session of this.sessions) {
      modeCounts[session.mode]++;
    }

    let maxCount = 0;
    let favorite: BodyDoublingMode | null = null;
    for (const [mode, count] of Object.entries(modeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        favorite = mode as BodyDoublingMode;
      }
    }

    this.stats.favoriteMode = favorite;
  }

  getInsights(): string[] {
    const insights: string[] = [];

    if (this.stats.totalSessions > 0) {
      insights.push(`📊 ${this.stats.totalSessions} body doubling sessions completed`);
      insights.push(`⏱️ ${this.stats.totalMinutes} total minutes with virtual presence`);

      if (this.stats.favoriteMode) {
        const modeInfo = this.getModes().find(m => m.mode === this.stats.favoriteMode);
        if (modeInfo) {
          insights.push(`${modeInfo.emoji} Your favorite: ${modeInfo.name}`);
        }
      }

      if (this.stats.longestSession > 30) {
        insights.push(`🏆 Longest session: ${this.stats.longestSession} minutes!`);
      }
    } else {
      insights.push('💡 Try body doubling to help with focus');
      insights.push('🎧 Ambient sounds can make you feel less alone while working');
    }

    return insights;
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save body doubling settings:', error);
    }
  }

  private async saveSessions(): Promise<void> {
    try {
      // Keep last 100 sessions
      const toSave = this.sessions.slice(-100);
      await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save body doubling sessions:', error);
    }
  }

  private async saveStats(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(this.stats));
    } catch (error) {
      console.error('Failed to save body doubling stats:', error);
    }
  }

  // ============ CLEANUP ============

  async cleanup(): Promise<void> {
    if (this.currentSession) {
      await this.endSession();
    }
    await this.stopSound();
  }
}

// Singleton instance
let serviceInstance: BodyDoublingService | null = null;

export function getBodyDoublingService(): BodyDoublingService {
  if (!serviceInstance) {
    serviceInstance = new BodyDoublingService();
  }
  return serviceInstance;
}

export async function initializeBodyDoublingService(): Promise<BodyDoublingService> {
  const service = getBodyDoublingService();
  await service.initialize();
  return service;
}
