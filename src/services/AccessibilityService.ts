/**
 * AccessibilityService - Accessibility features for the app
 *
 * Features:
 * - Color themes (dark, light, high contrast, colorblind)
 * - Font size options
 * - Reduced motion mode
 * - Haptic feedback control
 * - Screen reader optimization
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform, AccessibilityInfo, PixelRatio } from 'react-native';
import type {
  ColorTheme,
  FontSize,
  HapticSettings,
  AccessibilitySettings,
} from '../types';

const STORAGE_KEY = 'nero_accessibility_settings';

// ============ THEME DEFINITIONS ============

interface ThemeColors {
  primary: string;
  primaryLight: string;
  bg: string;
  card: string;
  surface: string;
  text: string;
  textSec: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  border: string;
}

const THEMES: Record<ColorTheme, ThemeColors> = {
  dark: {
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    bg: '#0F0F1A',
    card: '#252542',
    surface: '#1A1A2E',
    text: '#FFFFFF',
    textSec: '#B8B8D1',
    textMuted: '#6C6C8A',
    success: '#00B894',
    warning: '#FDCB6E',
    error: '#FF7675',
    border: '#3D3D5C',
  },
  light: {
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    bg: '#F5F6FA',
    card: '#FFFFFF',
    surface: '#F0F1F5',
    text: '#2D3436',
    textSec: '#636E72',
    textMuted: '#B2BEC3',
    success: '#00B894',
    warning: '#FDCB6E',
    error: '#E74C3C',
    border: '#DFE6E9',
  },
  high_contrast: {
    primary: '#FFFF00',
    primaryLight: '#FFFF99',
    bg: '#000000',
    card: '#1A1A1A',
    surface: '#0D0D0D',
    text: '#FFFFFF',
    textSec: '#FFFFFF',
    textMuted: '#CCCCCC',
    success: '#00FF00',
    warning: '#FFFF00',
    error: '#FF0000',
    border: '#FFFFFF',
  },
  colorblind_deuteranopia: {
    // Optimized for red-green colorblindness (most common)
    primary: '#0077BB',
    primaryLight: '#33BBEE',
    bg: '#0F0F1A',
    card: '#252542',
    surface: '#1A1A2E',
    text: '#FFFFFF',
    textSec: '#B8B8D1',
    textMuted: '#6C6C8A',
    success: '#009E73', // Blue-green
    warning: '#F0E442', // Yellow
    error: '#D55E00', // Orange-red
    border: '#3D3D5C',
  },
  colorblind_protanopia: {
    // Optimized for red-weak colorblindness
    primary: '#0077BB',
    primaryLight: '#33BBEE',
    bg: '#0F0F1A',
    card: '#252542',
    surface: '#1A1A2E',
    text: '#FFFFFF',
    textSec: '#B8B8D1',
    textMuted: '#6C6C8A',
    success: '#009E73',
    warning: '#F0E442',
    error: '#CC79A7', // Pink
    border: '#3D3D5C',
  },
  colorblind_tritanopia: {
    // Optimized for blue-yellow colorblindness
    primary: '#E69F00', // Orange
    primaryLight: '#F0C05A',
    bg: '#0F0F1A',
    card: '#252542',
    surface: '#1A1A2E',
    text: '#FFFFFF',
    textSec: '#B8B8D1',
    textMuted: '#6C6C8A',
    success: '#009E73', // Teal
    warning: '#E69F00', // Orange
    error: '#D55E00', // Red-orange
    border: '#3D3D5C',
  },
};

// ============ FONT SIZE DEFINITIONS ============

const FONT_SIZES: Record<FontSize, {
  base: number;
  small: number;
  large: number;
  xlarge: number;
  title: number;
}> = {
  small: {
    base: 14,
    small: 12,
    large: 16,
    xlarge: 20,
    title: 24,
  },
  medium: {
    base: 16,
    small: 14,
    large: 18,
    xlarge: 24,
    title: 28,
  },
  large: {
    base: 18,
    small: 16,
    large: 20,
    xlarge: 28,
    title: 32,
  },
  extra_large: {
    base: 22,
    small: 18,
    large: 24,
    xlarge: 32,
    title: 40,
  },
};

const DEFAULT_SETTINGS: AccessibilitySettings = {
  colorTheme: 'dark',
  fontSize: 'medium',
  reducedMotion: false,
  haptics: {
    enabled: true,
    taskCompletion: true,
    notifications: true,
    timerAlerts: true,
    intensity: 'medium',
  },
  screenReaderOptimized: false,
  highContrastText: false,
  buttonSize: 'normal',
  lineSpacing: 1.4,
};

export class AccessibilityService {
  private settings: AccessibilitySettings = DEFAULT_SETTINGS;
  private systemReducedMotion: boolean = false;
  private systemScreenReader: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Load saved settings
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEY);
      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }

      // Check system accessibility settings
      if (Platform.OS !== 'web') {
        this.systemReducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
        this.systemScreenReader = await AccessibilityInfo.isScreenReaderEnabled();

        // Listen for changes
        AccessibilityInfo.addEventListener(
          'reduceMotionChanged',
          (isEnabled) => {
            this.systemReducedMotion = isEnabled;
          }
        );

        AccessibilityInfo.addEventListener(
          'screenReaderChanged',
          (isEnabled) => {
            this.systemScreenReader = isEnabled;
          }
        );
      }

      // Auto-enable screen reader optimization if detected
      if (this.systemScreenReader && !this.settings.screenReaderOptimized) {
        this.settings.screenReaderOptimized = true;
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to initialize AccessibilityService:', error);
    }
  }

  // ============ THEME ============

  getTheme(): ThemeColors {
    return THEMES[this.settings.colorTheme];
  }

  getThemeByName(theme: ColorTheme): ThemeColors {
    return THEMES[theme];
  }

  getAvailableThemes(): Array<{
    id: ColorTheme;
    name: string;
    description: string;
  }> {
    return [
      { id: 'dark', name: 'Dark', description: 'Dark theme with purple accents' },
      { id: 'light', name: 'Light', description: 'Light theme for bright environments' },
      { id: 'high_contrast', name: 'High Contrast', description: 'Maximum contrast for visibility' },
      { id: 'colorblind_deuteranopia', name: 'Colorblind (Red-Green)', description: 'Optimized for deuteranopia' },
      { id: 'colorblind_protanopia', name: 'Colorblind (Red-Weak)', description: 'Optimized for protanopia' },
      { id: 'colorblind_tritanopia', name: 'Colorblind (Blue-Yellow)', description: 'Optimized for tritanopia' },
    ];
  }

  async setTheme(theme: ColorTheme): Promise<void> {
    this.settings.colorTheme = theme;
    await this.saveSettings();
  }

  // ============ FONT SIZE ============

  getFontSizes(): {
    base: number;
    small: number;
    large: number;
    xlarge: number;
    title: number;
  } {
    const sizes = FONT_SIZES[this.settings.fontSize];

    // Adjust for system font scaling
    const fontScale = PixelRatio.getFontScale();
    if (fontScale > 1.2) {
      // System has large text - respect it
      return {
        base: Math.round(sizes.base * fontScale * 0.9),
        small: Math.round(sizes.small * fontScale * 0.9),
        large: Math.round(sizes.large * fontScale * 0.9),
        xlarge: Math.round(sizes.xlarge * fontScale * 0.9),
        title: Math.round(sizes.title * fontScale * 0.9),
      };
    }

    return sizes;
  }

  getAvailableFontSizes(): Array<{
    id: FontSize;
    name: string;
    preview: number;
  }> {
    return [
      { id: 'small', name: 'Small', preview: 14 },
      { id: 'medium', name: 'Medium', preview: 16 },
      { id: 'large', name: 'Large', preview: 18 },
      { id: 'extra_large', name: 'Extra Large', preview: 22 },
    ];
  }

  async setFontSize(size: FontSize): Promise<void> {
    this.settings.fontSize = size;
    await this.saveSettings();
  }

  // ============ MOTION ============

  shouldReduceMotion(): boolean {
    return this.settings.reducedMotion || this.systemReducedMotion;
  }

  async setReducedMotion(enabled: boolean): Promise<void> {
    this.settings.reducedMotion = enabled;
    await this.saveSettings();
  }

  getAnimationDuration(normalDuration: number): number {
    if (this.shouldReduceMotion()) {
      return 0; // No animation
    }
    return normalDuration;
  }

  // ============ HAPTICS ============

  async triggerHaptic(
    type: 'taskCompletion' | 'notifications' | 'timerAlerts' | 'general'
  ): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!this.settings.haptics.enabled) return;

    // Check specific type
    if (type === 'taskCompletion' && !this.settings.haptics.taskCompletion) return;
    if (type === 'notifications' && !this.settings.haptics.notifications) return;
    if (type === 'timerAlerts' && !this.settings.haptics.timerAlerts) return;

    // Map intensity to haptic style
    const style = this.settings.haptics.intensity === 'light'
      ? Haptics.ImpactFeedbackStyle.Light
      : this.settings.haptics.intensity === 'strong'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium;

    try {
      await Haptics.impactAsync(style);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async triggerSuccessHaptic(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!this.settings.haptics.enabled) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async triggerWarningHaptic(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!this.settings.haptics.enabled) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptics not available:', error);
    }
  }

  async updateHapticSettings(updates: Partial<HapticSettings>): Promise<void> {
    this.settings.haptics = { ...this.settings.haptics, ...updates };
    await this.saveSettings();
  }

  // ============ SCREEN READER ============

  isScreenReaderActive(): boolean {
    return this.systemScreenReader;
  }

  isScreenReaderOptimized(): boolean {
    return this.settings.screenReaderOptimized;
  }

  async setScreenReaderOptimized(enabled: boolean): Promise<void> {
    this.settings.screenReaderOptimized = enabled;
    await this.saveSettings();
  }

  // Screen reader announcement helper
  announceForAccessibility(message: string): void {
    if (Platform.OS !== 'web') {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }

  // ============ BUTTON SIZE ============

  getButtonSize(): { minHeight: number; minWidth: number; padding: number } {
    if (this.settings.buttonSize === 'large') {
      return { minHeight: 56, minWidth: 56, padding: 16 };
    }
    return { minHeight: 44, minWidth: 44, padding: 12 };
  }

  async setButtonSize(size: 'normal' | 'large'): Promise<void> {
    this.settings.buttonSize = size;
    await this.saveSettings();
  }

  // ============ LINE SPACING ============

  getLineHeight(fontSize: number): number {
    return Math.round(fontSize * this.settings.lineSpacing);
  }

  async setLineSpacing(spacing: number): Promise<void> {
    this.settings.lineSpacing = Math.max(1, Math.min(2, spacing));
    await this.saveSettings();
  }

  // ============ HIGH CONTRAST TEXT ============

  shouldUseHighContrastText(): boolean {
    return this.settings.highContrastText ||
      this.settings.colorTheme === 'high_contrast';
  }

  async setHighContrastText(enabled: boolean): Promise<void> {
    this.settings.highContrastText = enabled;
    await this.saveSettings();
  }

  // ============ FULL SETTINGS ============

  async updateSettings(updates: Partial<AccessibilitySettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): AccessibilitySettings {
    return { ...this.settings };
  }

  async resetToDefaults(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }

  // ============ PRESETS ============

  getPresets(): Array<{
    id: string;
    name: string;
    description: string;
    settings: Partial<AccessibilitySettings>;
  }> {
    return [
      {
        id: 'default',
        name: 'Default',
        description: 'Standard settings',
        settings: DEFAULT_SETTINGS,
      },
      {
        id: 'low_vision',
        name: 'Low Vision',
        description: 'Large text, high contrast',
        settings: {
          colorTheme: 'high_contrast',
          fontSize: 'extra_large',
          highContrastText: true,
          buttonSize: 'large',
          lineSpacing: 1.6,
        },
      },
      {
        id: 'reduced_stimulation',
        name: 'Reduced Stimulation',
        description: 'Minimal animations and haptics',
        settings: {
          reducedMotion: true,
          haptics: { ...DEFAULT_SETTINGS.haptics, enabled: false },
        },
      },
      {
        id: 'colorblind',
        name: 'Colorblind Friendly',
        description: 'Optimized color palette',
        settings: {
          colorTheme: 'colorblind_deuteranopia',
        },
      },
    ];
  }

  async applyPreset(presetId: string): Promise<void> {
    const preset = this.getPresets().find(p => p.id === presetId);
    if (preset) {
      this.settings = { ...this.settings, ...preset.settings };
      await this.saveSettings();
    }
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save accessibility settings:', error);
    }
  }
}

// Singleton instance
let serviceInstance: AccessibilityService | null = null;

export function getAccessibilityService(): AccessibilityService {
  if (!serviceInstance) {
    serviceInstance = new AccessibilityService();
  }
  return serviceInstance;
}

export async function initializeAccessibilityService(): Promise<AccessibilityService> {
  const service = getAccessibilityService();
  await service.initialize();
  return service;
}
