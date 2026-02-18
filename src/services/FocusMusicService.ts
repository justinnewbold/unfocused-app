/**
 * FocusMusicService - Focus music and ambient sounds integration
 *
 * Features:
 * - Built-in ambient sounds (white noise, brown noise, nature)
 * - Spotify integration
 * - Apple Music integration
 * - Auto-play on focus start
 * - Fade in/out
 * - Volume control
 */

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  MusicProvider,
  MusicCategory,
  MusicTrack,
  FocusPlaylist,
  MusicSettings,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_music_settings',
  PLAYLISTS: 'nero_music_playlists',
  HISTORY: 'nero_music_history',
};

const DEFAULT_SETTINGS: MusicSettings = {
  enabled: true,
  defaultCategory: 'lofi',
  volume: 0.5,
  autoPlayOnFocus: true,
  fadeInDuration: 3,
  fadeOutOnBreak: true,
  connectedProviders: ['local'],
};

// Built-in ambient sound URLs (using free sources)
const BUILT_IN_SOUNDS: Record<string, MusicTrack[]> = {
  white_noise: [
    { id: 'white_1', title: 'White Noise', category: 'white_noise', provider: 'local', duration: 3600 },
  ],
  brown_noise: [
    { id: 'brown_1', title: 'Brown Noise', category: 'brown_noise', provider: 'local', duration: 3600 },
  ],
  nature: [
    { id: 'rain_1', title: 'Rain Sounds', category: 'nature', provider: 'local', duration: 3600 },
    { id: 'forest_1', title: 'Forest Ambience', category: 'nature', provider: 'local', duration: 3600 },
    { id: 'ocean_1', title: 'Ocean Waves', category: 'nature', provider: 'local', duration: 3600 },
    { id: 'stream_1', title: 'Flowing Stream', category: 'nature', provider: 'local', duration: 3600 },
  ],
  binaural: [
    { id: 'focus_40hz', title: '40Hz Focus (Gamma)', category: 'binaural', provider: 'local', duration: 3600 },
    { id: 'relax_10hz', title: '10Hz Relaxation (Alpha)', category: 'binaural', provider: 'local', duration: 3600 },
  ],
};

export class FocusMusicService {
  private settings: MusicSettings = DEFAULT_SETTINGS;
  private playlists: FocusPlaylist[] = [];
  private currentSound: Audio.Sound | null = null;
  private isPlaying: boolean = false;
  private currentTrack: MusicTrack | null = null;
  private fadeInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<void> {
    try {
      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Load settings
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }

      // Load playlists
      const playlistsJson = await AsyncStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (playlistsJson) {
        this.playlists = JSON.parse(playlistsJson);
      }

      // Initialize default playlists
      this.initializeDefaultPlaylists();
    } catch (error) {
      console.error('Failed to initialize FocusMusicService:', error);
    }
  }

  private initializeDefaultPlaylists(): void {
    const existingIds = new Set(this.playlists.map(p => p.id));

    const defaultPlaylists: FocusPlaylist[] = [
      {
        id: 'default_white_noise',
        name: 'White Noise',
        category: 'white_noise',
        tracks: BUILT_IN_SOUNDS.white_noise,
        provider: 'local',
        isDefault: true,
      },
      {
        id: 'default_brown_noise',
        name: 'Brown Noise',
        category: 'brown_noise',
        tracks: BUILT_IN_SOUNDS.brown_noise,
        provider: 'local',
        isDefault: true,
      },
      {
        id: 'default_nature',
        name: 'Nature Sounds',
        category: 'nature',
        tracks: BUILT_IN_SOUNDS.nature,
        provider: 'local',
        isDefault: true,
      },
      {
        id: 'default_binaural',
        name: 'Binaural Beats',
        category: 'binaural',
        tracks: BUILT_IN_SOUNDS.binaural,
        provider: 'local',
        isDefault: true,
      },
    ];

    for (const playlist of defaultPlaylists) {
      if (!existingIds.has(playlist.id)) {
        this.playlists.push(playlist);
      }
    }
  }

  // ============ PLAYBACK CONTROLS ============

  async play(track?: MusicTrack): Promise<boolean> {
    try {
      // Stop current playback
      await this.stop();

      const trackToPlay = track || this.getRandomTrack(this.settings.defaultCategory);
      if (!trackToPlay) {
        console.log('No track to play');
        return false;
      }

      this.currentTrack = trackToPlay;

      // For built-in sounds, we'll generate the sound
      // In a real app, these would be actual audio files
      if (trackToPlay.provider === 'local') {
        // Create a placeholder sound (in production, use real audio files)
        const { sound } = await Audio.Sound.createAsync(
          { uri: this.getLocalSoundUri(trackToPlay.id) },
          {
            isLooping: true,
            volume: this.settings.fadeInDuration > 0 ? 0 : this.settings.volume,
          }
        );

        this.currentSound = sound;
        await sound.playAsync();
        this.isPlaying = true;

        // Fade in if enabled
        if (this.settings.fadeInDuration > 0) {
          this.fadeIn(this.settings.fadeInDuration);
        }

        return true;
      }

      // Handle external providers (Spotify, Apple Music)
      if (trackToPlay.uri) {
        return this.playExternalTrack(trackToPlay);
      }

      return false;
    } catch (error) {
      console.error('Failed to play audio:', error);
      return false;
    }
  }

  private getLocalSoundUri(trackId: string): string {
    // In a real app, these would be bundled audio files
    // For now, return a placeholder
    const soundMap: Record<string, string> = {
      white_1: 'https://example.com/sounds/white-noise.mp3',
      brown_1: 'https://example.com/sounds/brown-noise.mp3',
      rain_1: 'https://example.com/sounds/rain.mp3',
      forest_1: 'https://example.com/sounds/forest.mp3',
      ocean_1: 'https://example.com/sounds/ocean.mp3',
      stream_1: 'https://example.com/sounds/stream.mp3',
      focus_40hz: 'https://example.com/sounds/binaural-40hz.mp3',
      relax_10hz: 'https://example.com/sounds/binaural-10hz.mp3',
    };
    return soundMap[trackId] || '';
  }

  private async playExternalTrack(track: MusicTrack): Promise<boolean> {
    // Handle Spotify/Apple Music playback
    // This would use their respective SDKs
    console.log(`Would play ${track.provider} track: ${track.uri}`);
    return false;
  }

  async pause(): Promise<void> {
    if (this.currentSound && this.isPlaying) {
      await this.currentSound.pauseAsync();
      this.isPlaying = false;
    }
  }

  async resume(): Promise<void> {
    if (this.currentSound && !this.isPlaying) {
      await this.currentSound.playAsync();
      this.isPlaying = true;
    }
  }

  async stop(): Promise<void> {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

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
    this.currentTrack = null;
  }

  async setVolume(volume: number): Promise<void> {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.settings.volume = clampedVolume;

    if (this.currentSound) {
      await this.currentSound.setVolumeAsync(clampedVolume);
    }

    await this.saveSettings();
  }

  // ============ FADE EFFECTS ============

  private fadeIn(durationSeconds: number): void {
    if (!this.currentSound) return;

    const targetVolume = this.settings.volume;
    const steps = durationSeconds * 10; // 10 steps per second
    const volumeIncrement = targetVolume / steps;
    let currentVolume = 0;

    this.fadeInterval = setInterval(async () => {
      currentVolume += volumeIncrement;
      if (currentVolume >= targetVolume) {
        currentVolume = targetVolume;
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
      }
      if (this.currentSound) {
        await this.currentSound.setVolumeAsync(currentVolume);
      }
    }, 100);
  }

  async fadeOut(durationSeconds: number): Promise<void> {
    if (!this.currentSound) return;

    return new Promise(resolve => {
      const startVolume = this.settings.volume;
      const steps = durationSeconds * 10;
      const volumeDecrement = startVolume / steps;
      let currentVolume = startVolume;

      this.fadeInterval = setInterval(async () => {
        currentVolume -= volumeDecrement;
        if (currentVolume <= 0) {
          currentVolume = 0;
          if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
          }
          await this.stop();
          resolve();
          return;
        }
        if (this.currentSound) {
          await this.currentSound.setVolumeAsync(currentVolume);
        }
      }, 100);
    });
  }

  // ============ FOCUS SESSION INTEGRATION ============

  async onFocusStart(): Promise<void> {
    if (this.settings.enabled && this.settings.autoPlayOnFocus) {
      await this.play();
    }
  }

  async onFocusEnd(): Promise<void> {
    if (this.isPlaying && this.settings.fadeOutOnBreak) {
      await this.fadeOut(2);
    }
  }

  async onBreakStart(): Promise<void> {
    // Optionally play different music during breaks
    // For now, just pause
    if (this.settings.fadeOutOnBreak) {
      await this.pause();
    }
  }

  async onBreakEnd(): Promise<void> {
    if (this.settings.autoPlayOnFocus) {
      await this.resume();
    }
  }

  // ============ PLAYLISTS ============

  getPlaylists(): FocusPlaylist[] {
    return [...this.playlists];
  }

  getPlaylistsByCategory(category: MusicCategory): FocusPlaylist[] {
    return this.playlists.filter(p => p.category === category);
  }

  getPlaylist(playlistId: string): FocusPlaylist | null {
    return this.playlists.find(p => p.id === playlistId) || null;
  }

  async createPlaylist(
    name: string,
    category: MusicCategory,
    tracks: MusicTrack[]
  ): Promise<FocusPlaylist> {
    const playlist: FocusPlaylist = {
      id: `playlist_${Date.now()}`,
      name,
      category,
      tracks,
      provider: tracks[0]?.provider || 'local',
    };

    this.playlists.push(playlist);
    await this.savePlaylists();
    return playlist;
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.isDefault) return false;

    this.playlists = this.playlists.filter(p => p.id !== playlistId);
    await this.savePlaylists();
    return true;
  }

  getRandomTrack(category?: MusicCategory): MusicTrack | null {
    let tracks: MusicTrack[] = [];

    if (category) {
      const categoryPlaylists = this.playlists.filter(p => p.category === category);
      for (const playlist of categoryPlaylists) {
        tracks.push(...playlist.tracks);
      }
    } else {
      for (const playlist of this.playlists) {
        tracks.push(...playlist.tracks);
      }
    }

    if (tracks.length === 0) return null;
    return tracks[Math.floor(Math.random() * tracks.length)];
  }

  // ============ SPOTIFY INTEGRATION ============

  async connectSpotify(accessToken: string): Promise<boolean> {
    try {
      // Verify token by fetching user profile
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      if (!this.settings.connectedProviders.includes('spotify')) {
        this.settings.connectedProviders.push('spotify');
        await this.saveSettings();
      }

      return true;
    } catch (error) {
      console.error('Failed to connect Spotify:', error);
      return false;
    }
  }

  async getSpotifyFocusPlaylists(accessToken: string): Promise<FocusPlaylist[]> {
    try {
      // Search for focus/study playlists
      const response = await fetch(
        'https://api.spotify.com/v1/search?q=focus%20study&type=playlist&limit=10',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch playlists');
      }

      const data = await response.json();

      return data.playlists.items.map((playlist: any) => ({
        id: `spotify_${playlist.id}`,
        name: playlist.name,
        category: 'focus' as MusicCategory,
        tracks: [], // Would need another API call to get tracks
        provider: 'spotify' as MusicProvider,
      }));
    } catch (error) {
      console.error('Failed to get Spotify playlists:', error);
      return [];
    }
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<MusicSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): MusicSettings {
    return { ...this.settings };
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  // ============ HELPERS ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save music settings:', error);
    }
  }

  private async savePlaylists(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(this.playlists));
    } catch (error) {
      console.error('Failed to save playlists:', error);
    }
  }

  getAvailableCategories(): MusicCategory[] {
    return ['focus', 'lofi', 'nature', 'white_noise', 'brown_noise', 'binaural', 'classical'];
  }

  getCategoryInfo(category: MusicCategory): { name: string; emoji: string; description: string } {
    const info: Record<MusicCategory, { name: string; emoji: string; description: string }> = {
      focus: { name: 'Focus', emoji: '🎯', description: 'Music for deep concentration' },
      lofi: { name: 'Lo-Fi', emoji: '🎵', description: 'Chill beats to study to' },
      nature: { name: 'Nature', emoji: '🌿', description: 'Rain, forests, and more' },
      white_noise: { name: 'White Noise', emoji: '📻', description: 'Blocks distractions' },
      brown_noise: { name: 'Brown Noise', emoji: '🟤', description: 'Deeper, warmer noise' },
      binaural: { name: 'Binaural', emoji: '🧠', description: 'Brain wave entrainment' },
      classical: { name: 'Classical', emoji: '🎻', description: 'Timeless compositions' },
    };
    return info[category];
  }

  // ============ CLEANUP ============

  async cleanup(): Promise<void> {
    await this.stop();
  }
}

// Singleton instance
let serviceInstance: FocusMusicService | null = null;

export function getFocusMusicService(): FocusMusicService {
  if (!serviceInstance) {
    serviceInstance = new FocusMusicService();
  }
  return serviceInstance;
}

export async function initializeFocusMusicService(): Promise<FocusMusicService> {
  const service = getFocusMusicService();
  await service.initialize();
  return service;
}
