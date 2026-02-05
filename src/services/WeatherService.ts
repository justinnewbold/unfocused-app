/**
 * WeatherService - Weather tracking and productivity correlation
 *
 * Features:
 * - Fetch current weather
 * - Correlate weather with productivity/mood
 * - Weather-based suggestions
 * - Location-based or manual entry
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type {
  WeatherData,
  WeatherCorrelation,
  WeatherSettings,
  EnergyLevel,
  MoodLevel,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_weather_settings',
  HISTORY: 'nero_weather_history',
  CORRELATIONS: 'nero_weather_correlations',
};

const DEFAULT_SETTINGS: WeatherSettings = {
  enabled: false,
  useLocation: false,
  showWeatherInsights: true,
  adjustSuggestionsForWeather: true,
};

export class WeatherService {
  private settings: WeatherSettings = DEFAULT_SETTINGS;
  private history: WeatherData[] = [];
  private correlations: WeatherCorrelation[] = [];

  async initialize(): Promise<void> {
    try {
      const [settingsJson, historyJson, corrJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
        AsyncStorage.getItem(STORAGE_KEYS.CORRELATIONS),
      ]);

      if (settingsJson) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      if (historyJson) this.history = JSON.parse(historyJson);
      if (corrJson) this.correlations = JSON.parse(corrJson);
    } catch (error) {
      console.error('Failed to initialize WeatherService:', error);
    }
  }

  // ============ WEATHER FETCHING ============

  async fetchCurrentWeather(): Promise<WeatherData | null> {
    try {
      let location: string | undefined;

      if (this.settings.useLocation) {
        const coords = await this.getCurrentLocation();
        if (coords) {
          location = `${coords.latitude},${coords.longitude}`;
        }
      }

      if (!location && this.settings.manualLocation) {
        location = this.settings.manualLocation;
      }

      if (!location) {
        console.log('No location available for weather');
        return null;
      }

      // In a real app, this would call a weather API
      // For demo, return simulated weather
      const weather = this.simulateWeather(location);

      // Store in history
      const existingIndex = this.history.findIndex(w => w.date === weather.date);
      if (existingIndex >= 0) {
        this.history[existingIndex] = weather;
      } else {
        this.history.push(weather);
      }

      await this.saveHistory();
      return weather;
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      return null;
    }
  }

  private async getCurrentLocation(): Promise<{
    latitude: number;
    longitude: number;
  } | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Failed to get location:', error);
      return null;
    }
  }

  private simulateWeather(location: string): WeatherData {
    const conditions: WeatherData['condition'][] = [
      'sunny', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy',
    ];

    // Generate somewhat realistic weather
    const now = new Date();
    const month = now.getMonth();

    // Weight conditions by season (northern hemisphere assumption)
    let conditionWeights: number[];
    if (month >= 5 && month <= 8) {
      // Summer
      conditionWeights = [40, 30, 15, 10, 0, 5]; // More sunny
    } else if (month >= 11 || month <= 2) {
      // Winter
      conditionWeights = [15, 25, 20, 5, 25, 10]; // More snow/cloud
    } else {
      // Spring/Fall
      conditionWeights = [25, 30, 25, 10, 5, 5]; // Mix
    }

    const totalWeight = conditionWeights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    let condition: WeatherData['condition'] = 'cloudy';

    for (let i = 0; i < conditions.length; i++) {
      random -= conditionWeights[i];
      if (random <= 0) {
        condition = conditions[i];
        break;
      }
    }

    // Temperature based on condition and season
    let baseTemp = 20; // Celsius
    if (month >= 5 && month <= 8) baseTemp = 25;
    if (month >= 11 || month <= 2) baseTemp = 5;

    if (condition === 'sunny') baseTemp += 5;
    if (condition === 'rainy' || condition === 'stormy') baseTemp -= 5;
    if (condition === 'snowy') baseTemp = Math.min(baseTemp, 0);

    return {
      date: now.toISOString().split('T')[0],
      location,
      temperature: baseTemp + Math.round((Math.random() - 0.5) * 10),
      humidity: Math.round(40 + Math.random() * 40),
      condition,
      uvIndex: condition === 'sunny' ? Math.round(3 + Math.random() * 7) : Math.round(Math.random() * 3),
      barometricPressure: Math.round(1000 + Math.random() * 30),
    };
  }

  getWeatherForDate(date: string): WeatherData | null {
    return this.history.find(w => w.date === date) || null;
  }

  getTodaysWeather(): WeatherData | null {
    const today = new Date().toISOString().split('T')[0];
    return this.getWeatherForDate(today);
  }

  // ============ MANUAL ENTRY ============

  async logWeather(
    condition: WeatherData['condition'],
    options?: {
      temperature?: number;
      humidity?: number;
    }
  ): Promise<WeatherData> {
    const weather: WeatherData = {
      date: new Date().toISOString().split('T')[0],
      condition,
      temperature: options?.temperature ?? 20,
      humidity: options?.humidity ?? 50,
    };

    const existingIndex = this.history.findIndex(w => w.date === weather.date);
    if (existingIndex >= 0) {
      this.history[existingIndex] = weather;
    } else {
      this.history.push(weather);
    }

    await this.saveHistory();
    return weather;
  }

  // ============ CORRELATIONS ============

  async analyzeCorrelations(
    productivityData: Array<{ date: string; score: number }>,
    energyData: Array<{ date: string; level: EnergyLevel }>,
    moodData: Array<{ date: string; mood: MoodLevel }>
  ): Promise<WeatherCorrelation[]> {
    const energyValues: Record<EnergyLevel, number> = { low: 1, medium: 2, high: 3 };
    const moodValues: Record<MoodLevel, number> = { low: 1, neutral: 2, high: 3 };

    // Group data by date
    const dataByDate = new Map<string, {
      productivity: number;
      energy: number;
      mood: number;
    }>();

    for (const p of productivityData) {
      if (!dataByDate.has(p.date)) {
        dataByDate.set(p.date, { productivity: 0, energy: 0, mood: 0 });
      }
      dataByDate.get(p.date)!.productivity = p.score;
    }

    for (const e of energyData) {
      if (dataByDate.has(e.date)) {
        dataByDate.get(e.date)!.energy = energyValues[e.level];
      }
    }

    for (const m of moodData) {
      if (dataByDate.has(m.date)) {
        dataByDate.get(m.date)!.mood = moodValues[m.mood];
      }
    }

    // Calculate correlations by weather condition
    const conditionData = new Map<string, {
      productivity: number[];
      energy: number[];
      mood: number[];
    }>();

    for (const weather of this.history) {
      const dayData = dataByDate.get(weather.date);
      if (!dayData) continue;

      if (!conditionData.has(weather.condition)) {
        conditionData.set(weather.condition, {
          productivity: [],
          energy: [],
          mood: [],
        });
      }

      const cond = conditionData.get(weather.condition)!;
      if (dayData.productivity > 0) cond.productivity.push(dayData.productivity);
      if (dayData.energy > 0) cond.energy.push(dayData.energy);
      if (dayData.mood > 0) cond.mood.push(dayData.mood);
    }

    // Calculate averages
    this.correlations = [];

    for (const [condition, data] of conditionData) {
      if (data.productivity.length < 2) continue;

      const avgProductivity = data.productivity.reduce((a, b) => a + b, 0) / data.productivity.length;
      const avgEnergy = data.energy.reduce((a, b) => a + b, 0) / data.energy.length;
      const avgMood = data.mood.reduce((a, b) => a + b, 0) / data.mood.length;

      this.correlations.push({
        condition,
        avgProductivity: Math.round(avgProductivity * 100) / 100,
        avgEnergy: Math.round(avgEnergy * 100) / 100,
        avgMood: Math.round(avgMood * 100) / 100,
        sampleSize: data.productivity.length,
      });
    }

    await this.saveCorrelations();
    return this.correlations;
  }

  getCorrelations(): WeatherCorrelation[] {
    return [...this.correlations];
  }

  getCorrelationForCondition(condition: WeatherData['condition']): WeatherCorrelation | null {
    return this.correlations.find(c => c.condition === condition) || null;
  }

  // ============ SUGGESTIONS ============

  getSuggestionsForWeather(weather?: WeatherData): string[] {
    const currentWeather = weather || this.getTodaysWeather();
    if (!currentWeather) {
      return ['Enable weather tracking for personalized suggestions'];
    }

    const suggestions: string[] = [];
    const correlation = this.getCorrelationForCondition(currentWeather.condition);

    switch (currentWeather.condition) {
      case 'sunny':
        suggestions.push('☀️ Great day for high-energy tasks!');
        if (currentWeather.uvIndex && currentWeather.uvIndex > 6) {
          suggestions.push('🧴 UV is high - take breaks indoors');
        }
        break;

      case 'cloudy':
        suggestions.push('☁️ Good day for focused indoor work');
        break;

      case 'rainy':
        suggestions.push('🌧️ Perfect weather for cozy focused work');
        suggestions.push('☕ Great day for warm drinks and deep focus');
        break;

      case 'stormy':
        suggestions.push('⛈️ Stay safe! Focus on indoor tasks');
        if (correlation && correlation.avgEnergy < 2) {
          suggestions.push('💡 Stormy days might affect your energy - plan accordingly');
        }
        break;

      case 'snowy':
        suggestions.push('❄️ Snowy day - warm up before starting work');
        break;

      case 'foggy':
        suggestions.push('🌫️ Foggy days can feel slow - start with easy wins');
        break;
    }

    // Add correlation-based insights
    if (correlation && correlation.sampleSize >= 5) {
      if (correlation.avgProductivity > 7) {
        suggestions.push(`📈 You tend to be more productive on ${currentWeather.condition} days`);
      } else if (correlation.avgProductivity < 5) {
        suggestions.push(`💙 ${currentWeather.condition} days can be harder - be gentle with yourself`);
      }
    }

    return suggestions;
  }

  // ============ INSIGHTS ============

  getInsights(): string[] {
    const insights: string[] = [];

    if (this.correlations.length === 0) {
      return ['📊 Track more days to see weather insights'];
    }

    // Find best and worst weather for productivity
    const sorted = [...this.correlations]
      .filter(c => c.sampleSize >= 3)
      .sort((a, b) => b.avgProductivity - a.avgProductivity);

    if (sorted.length >= 2) {
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      const conditionEmoji: Record<string, string> = {
        sunny: '☀️',
        cloudy: '☁️',
        rainy: '🌧️',
        stormy: '⛈️',
        snowy: '❄️',
        foggy: '🌫️',
      };

      insights.push(`${conditionEmoji[best.condition]} You're most productive on ${best.condition} days`);

      if (worst.avgProductivity < best.avgProductivity - 1) {
        insights.push(`${conditionEmoji[worst.condition]} ${worst.condition} days tend to be harder for you`);
      }
    }

    // Check for barometric pressure sensitivity (if data available)
    const withPressure = this.history.filter(w => w.barometricPressure !== undefined);
    if (withPressure.length >= 10) {
      insights.push('🌡️ Barometric pressure data is being tracked');
    }

    return insights;
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<WeatherSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): WeatherSettings {
    return { ...this.settings };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.saveSettings();
  }

  async setManualLocation(location: string): Promise<void> {
    this.settings.manualLocation = location;
    this.settings.useLocation = false;
    await this.saveSettings();
  }

  async enableLocationTracking(): Promise<boolean> {
    const coords = await this.getCurrentLocation();
    if (coords) {
      this.settings.useLocation = true;
      await this.saveSettings();
      return true;
    }
    return false;
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save weather settings:', error);
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      // Keep last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const toSave = this.history.filter(w => w.date >= cutoffStr);
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save weather history:', error);
    }
  }

  private async saveCorrelations(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CORRELATIONS, JSON.stringify(this.correlations));
    } catch (error) {
      console.error('Failed to save weather correlations:', error);
    }
  }
}

// Singleton instance
let serviceInstance: WeatherService | null = null;

export function getWeatherService(): WeatherService {
  if (!serviceInstance) {
    serviceInstance = new WeatherService();
  }
  return serviceInstance;
}

export async function initializeWeatherService(): Promise<WeatherService> {
  const service = getWeatherService();
  await service.initialize();
  return service;
}
