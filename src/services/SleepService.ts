/**
 * SleepService - Sleep tracking and energy correlation
 *
 * Features:
 * - Manual sleep logging
 * - Apple Health/Google Fit integration
 * - Sleep quality correlation with productivity
 * - Sleep debt tracking
 * - Bedtime reminders
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  SleepEntry,
  SleepEnergyCorrelation,
  SleepSettings,
  SleepDataSource,
  EnergyLevel,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_sleep_settings',
  ENTRIES: 'nero_sleep_entries',
  CORRELATION: 'nero_sleep_correlation',
};

const DEFAULT_SETTINGS: SleepSettings = {
  enabled: false,
  dataSource: 'manual',
  idealSleepMinutes: 480, // 8 hours
  trackSleepDebt: true,
  showSleepInsights: true,
  bedtimeReminder: false,
  bedtimeReminderTime: '22:00',
};

export class SleepService {
  private settings: SleepSettings = DEFAULT_SETTINGS;
  private entries: SleepEntry[] = [];
  private correlation: SleepEnergyCorrelation | null = null;

  async initialize(): Promise<void> {
    try {
      const [settingsJson, entriesJson, corrJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.ENTRIES),
        AsyncStorage.getItem(STORAGE_KEYS.CORRELATION),
      ]);

      if (settingsJson) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      if (entriesJson) this.entries = JSON.parse(entriesJson);
      if (corrJson) this.correlation = JSON.parse(corrJson);
    } catch (error) {
      console.error('Failed to initialize SleepService:', error);
    }
  }

  // ============ SLEEP LOGGING ============

  async logSleep(
    date: string,
    bedTime: string,
    wakeTime: string,
    options?: {
      sleepQuality?: number;
      notes?: string;
      deepSleepMinutes?: number;
      remSleepMinutes?: number;
      lightSleepMinutes?: number;
      awakeMinutes?: number;
    }
  ): Promise<SleepEntry> {
    // Calculate total sleep
    const bedDate = new Date(`${date}T${bedTime}`);
    const wakeDate = new Date(`${date}T${wakeTime}`);

    // If wake time is before bed time, wake is next day
    if (wakeDate <= bedDate) {
      wakeDate.setDate(wakeDate.getDate() + 1);
    }

    const totalMinutes = Math.round((wakeDate.getTime() - bedDate.getTime()) / (1000 * 60));

    const entry: SleepEntry = {
      id: `sleep_${Date.now()}`,
      source: 'manual',
      date,
      bedTime,
      wakeTime,
      totalMinutes,
      sleepQuality: options?.sleepQuality,
      notes: options?.notes,
      deepSleepMinutes: options?.deepSleepMinutes,
      remSleepMinutes: options?.remSleepMinutes,
      lightSleepMinutes: options?.lightSleepMinutes,
      awakeMinutes: options?.awakeMinutes,
    };

    // Update or add entry for date
    const existingIndex = this.entries.findIndex(e => e.date === date);
    if (existingIndex >= 0) {
      this.entries[existingIndex] = entry;
    } else {
      this.entries.push(entry);
    }

    await this.saveEntries();
    return entry;
  }

  async quickLogSleep(
    totalHours: number,
    sleepQuality?: number
  ): Promise<SleepEntry> {
    const today = new Date();
    const date = today.toISOString().split('T')[0];

    // Estimate bed and wake times
    const wakeTime = today.toTimeString().slice(0, 5);
    const bedDate = new Date(today.getTime() - totalHours * 60 * 60 * 1000);
    const bedTime = bedDate.toTimeString().slice(0, 5);

    return this.logSleep(date, bedTime, wakeTime, { sleepQuality });
  }

  getEntryForDate(date: string): SleepEntry | null {
    return this.entries.find(e => e.date === date) || null;
  }

  getRecentEntries(days: number = 7): SleepEntry[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return this.entries
      .filter(e => e.date >= cutoffStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ============ SLEEP DEBT ============

  calculateSleepDebt(days: number = 7): {
    totalDebt: number;
    avgSleep: number;
    ideal: number;
    entries: SleepEntry[];
  } {
    const recentEntries = this.getRecentEntries(days);

    const totalSleep = recentEntries.reduce((sum, e) => sum + e.totalMinutes, 0);
    const avgSleep = recentEntries.length > 0 ? totalSleep / recentEntries.length : 0;

    const idealTotal = this.settings.idealSleepMinutes * recentEntries.length;
    const totalDebt = Math.max(0, idealTotal - totalSleep);

    return {
      totalDebt,
      avgSleep: Math.round(avgSleep),
      ideal: this.settings.idealSleepMinutes,
      entries: recentEntries,
    };
  }

  getSleepDebtStatus(): 'well_rested' | 'mild_debt' | 'significant_debt' {
    const { totalDebt, entries } = this.calculateSleepDebt(7);

    if (entries.length < 3) {
      return 'well_rested'; // Not enough data
    }

    const avgDebtPerDay = totalDebt / entries.length;

    if (avgDebtPerDay <= 30) return 'well_rested';
    if (avgDebtPerDay <= 90) return 'mild_debt';
    return 'significant_debt';
  }

  // ============ HEALTH INTEGRATION ============

  async connectAppleHealth(): Promise<boolean> {
    // In a real app, this would use expo-health or similar
    console.log('Apple Health integration would be implemented here');
    this.settings.dataSource = 'apple_health';
    await this.saveSettings();
    return true;
  }

  async connectGoogleFit(): Promise<boolean> {
    // In a real app, this would use Google Fit API
    console.log('Google Fit integration would be implemented here');
    this.settings.dataSource = 'google_fit';
    await this.saveSettings();
    return true;
  }

  async syncFromHealthSource(): Promise<SleepEntry[]> {
    // In a real app, this would fetch from the connected health source
    console.log(`Would sync from ${this.settings.dataSource}`);
    return [];
  }

  // ============ CORRELATION ANALYSIS ============

  async analyzeCorrelation(
    energyLogs: Array<{ date: string; level: EnergyLevel }>
  ): Promise<SleepEnergyCorrelation> {
    const energyValues: Record<EnergyLevel, number> = {
      low: 1,
      medium: 2,
      high: 3,
    };

    // Group energy by date
    const energyByDate = new Map<string, number>();
    for (const log of energyLogs) {
      if (!energyByDate.has(log.date)) {
        energyByDate.set(log.date, energyValues[log.level]);
      } else {
        // Average multiple logs per day
        const current = energyByDate.get(log.date)!;
        energyByDate.set(log.date, (current + energyValues[log.level]) / 2);
      }
    }

    // Calculate averages for high/low energy days
    let sleepForHighEnergy = 0;
    let highEnergyCount = 0;
    let sleepForLowEnergy = 0;
    let lowEnergyCount = 0;

    const sleepEnergyPairs: Array<{ sleep: number; energy: number }> = [];

    for (const entry of this.entries) {
      const energy = energyByDate.get(entry.date);
      if (energy !== undefined) {
        sleepEnergyPairs.push({ sleep: entry.totalMinutes, energy });

        if (energy >= 2.5) {
          sleepForHighEnergy += entry.totalMinutes;
          highEnergyCount++;
        } else {
          sleepForLowEnergy += entry.totalMinutes;
          lowEnergyCount++;
        }
      }
    }

    const avgSleepForHighEnergy = highEnergyCount > 0
      ? sleepForHighEnergy / highEnergyCount
      : this.settings.idealSleepMinutes;

    const avgSleepForLowEnergy = lowEnergyCount > 0
      ? sleepForLowEnergy / lowEnergyCount
      : this.settings.idealSleepMinutes - 60;

    // Calculate optimal range
    const allSleeps = this.entries.map(e => e.totalMinutes);
    const avgSleep = allSleeps.length > 0
      ? allSleeps.reduce((a, b) => a + b, 0) / allSleeps.length
      : this.settings.idealSleepMinutes;

    const optimalRange = {
      min: Math.round(avgSleepForHighEnergy - 30),
      max: Math.round(avgSleepForHighEnergy + 30),
    };

    // Calculate correlation coefficient (simplified)
    let correlation = 0;
    if (sleepEnergyPairs.length >= 5) {
      const avgSleepPairs = sleepEnergyPairs.reduce((s, p) => s + p.sleep, 0) / sleepEnergyPairs.length;
      const avgEnergyPairs = sleepEnergyPairs.reduce((s, p) => s + p.energy, 0) / sleepEnergyPairs.length;

      let numerator = 0;
      let denomSleep = 0;
      let denomEnergy = 0;

      for (const pair of sleepEnergyPairs) {
        const sleepDiff = pair.sleep - avgSleepPairs;
        const energyDiff = pair.energy - avgEnergyPairs;
        numerator += sleepDiff * energyDiff;
        denomSleep += sleepDiff * sleepDiff;
        denomEnergy += energyDiff * energyDiff;
      }

      const denom = Math.sqrt(denomSleep * denomEnergy);
      correlation = denom > 0 ? numerator / denom : 0;
    }

    this.correlation = {
      avgSleepForHighEnergy: Math.round(avgSleepForHighEnergy),
      avgSleepForLowEnergy: Math.round(avgSleepForLowEnergy),
      optimalSleepRange: optimalRange,
      sleepDebtImpact: Math.round(correlation * 100) / 100,
    };

    await this.saveCorrelation();
    return this.correlation;
  }

  getCorrelation(): SleepEnergyCorrelation | null {
    return this.correlation;
  }

  // ============ INSIGHTS ============

  predictTomorrowEnergy(): {
    prediction: EnergyLevel;
    confidence: number;
    reason: string;
  } {
    const lastNight = this.getRecentEntries(1)[0];

    if (!lastNight) {
      return {
        prediction: 'medium',
        confidence: 20,
        reason: 'No sleep data available',
      };
    }

    const debtStatus = this.getSleepDebtStatus();
    const correlation = this.correlation;

    if (correlation && lastNight.totalMinutes >= correlation.optimalSleepRange.min) {
      return {
        prediction: 'high',
        confidence: 70,
        reason: `You got ${Math.round(lastNight.totalMinutes / 60)}h of sleep, within your optimal range`,
      };
    } else if (lastNight.totalMinutes < this.settings.idealSleepMinutes - 90) {
      return {
        prediction: 'low',
        confidence: 75,
        reason: `Only ${Math.round(lastNight.totalMinutes / 60)}h of sleep might affect your energy`,
      };
    } else {
      return {
        prediction: 'medium',
        confidence: 50,
        reason: `${Math.round(lastNight.totalMinutes / 60)}h of sleep should be adequate`,
      };
    }
  }

  getInsights(): string[] {
    const insights: string[] = [];

    const recentEntries = this.getRecentEntries(7);

    if (recentEntries.length >= 3) {
      const avgSleep = recentEntries.reduce((s, e) => s + e.totalMinutes, 0) / recentEntries.length;
      const avgHours = Math.round(avgSleep / 60 * 10) / 10;

      insights.push(`😴 Average sleep this week: ${avgHours} hours`);

      const debtStatus = this.getSleepDebtStatus();
      if (debtStatus === 'well_rested') {
        insights.push('✨ You\'re well rested!');
      } else if (debtStatus === 'mild_debt') {
        insights.push('💤 Mild sleep debt - try an earlier bedtime tonight');
      } else {
        insights.push('⚠️ Significant sleep debt - prioritize rest');
      }

      if (this.correlation) {
        if (this.correlation.sleepDebtImpact > 0.3) {
          insights.push('📊 Your energy strongly correlates with sleep');
        }
        insights.push(`🎯 Your optimal sleep: ${Math.round(this.correlation.optimalSleepRange.min / 60)}-${Math.round(this.correlation.optimalSleepRange.max / 60)}h`);
      }
    } else {
      insights.push('💤 Log more sleep to see insights');
    }

    return insights;
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<SleepSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): SleepSettings {
    return { ...this.settings };
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save sleep settings:', error);
    }
  }

  private async saveEntries(): Promise<void> {
    try {
      // Keep last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const toSave = this.entries.filter(e => e.date >= cutoffStr);
      await AsyncStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save sleep entries:', error);
    }
  }

  private async saveCorrelation(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CORRELATION, JSON.stringify(this.correlation));
    } catch (error) {
      console.error('Failed to save sleep correlation:', error);
    }
  }
}

// Singleton instance
let serviceInstance: SleepService | null = null;

export function getSleepService(): SleepService {
  if (!serviceInstance) {
    serviceInstance = new SleepService();
  }
  return serviceInstance;
}

export async function initializeSleepService(): Promise<SleepService> {
  const service = getSleepService();
  await service.initialize();
  return service;
}
