import { MoodEntry, MoodLevel, MoodPattern, EnergyLevel, CompletionRecord } from '../types';
import { genId } from '../constants';

// ============ MOOD TRACKING SERVICE ============
// Tracks mood over time and correlates with productivity patterns
export class MoodTrackingService {
  private moodHistory: MoodEntry[] = [];
  private completionHistory: CompletionRecord[] = [];

  setMoodHistory(history: MoodEntry[]) {
    this.moodHistory = history;
  }

  getMoodHistory(): MoodEntry[] {
    return this.moodHistory;
  }

  setCompletionHistory(history: CompletionRecord[]) {
    this.completionHistory = history;
  }

  recordMood(
    mood: MoodLevel,
    energy?: EnergyLevel,
    notes?: string,
    context?: 'morning' | 'afternoon' | 'evening' | 'task_completion' | 'checkin'
  ): MoodEntry {
    const entry: MoodEntry = {
      id: genId(),
      mood,
      timestamp: new Date().toISOString(),
      notes,
      energy,
      context,
    };
    this.moodHistory.push(entry);
    return entry;
  }

  getRecentMood(): MoodLevel | null {
    if (this.moodHistory.length === 0) return null;

    // Get mood from last 2 hours
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
    const recentMoods = this.moodHistory.filter(
      m => new Date(m.timestamp).getTime() > twoHoursAgo
    );

    if (recentMoods.length === 0) return null;
    return recentMoods[recentMoods.length - 1].mood;
  }

  getMoodValue(mood: MoodLevel): number {
    switch (mood) {
      case 'low': return 1;
      case 'neutral': return 2;
      case 'high': return 3;
      default: return 2;
    }
  }

  getAverageMoodByHour(): Record<number, number> {
    const hourlyMoods: Record<number, { sum: number; count: number }> = {};

    for (let h = 0; h < 24; h++) {
      hourlyMoods[h] = { sum: 0, count: 0 };
    }

    this.moodHistory.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourlyMoods[hour].sum += this.getMoodValue(entry.mood);
      hourlyMoods[hour].count++;
    });

    const result: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      result[h] = hourlyMoods[h].count > 0
        ? hourlyMoods[h].sum / hourlyMoods[h].count
        : 2; // Default to neutral
    }
    return result;
  }

  getAverageMoodByDay(): Record<number, number> {
    const dailyMoods: Record<number, { sum: number; count: number }> = {};

    for (let d = 0; d < 7; d++) {
      dailyMoods[d] = { sum: 0, count: 0 };
    }

    this.moodHistory.forEach(entry => {
      const day = new Date(entry.timestamp).getDay();
      dailyMoods[day].sum += this.getMoodValue(entry.mood);
      dailyMoods[day].count++;
    });

    const result: Record<number, number> = {};
    for (let d = 0; d < 7; d++) {
      result[d] = dailyMoods[d].count > 0
        ? dailyMoods[d].sum / dailyMoods[d].count
        : 2;
    }
    return result;
  }

  calculateMoodEnergyCorrelation(): number {
    const entriesWithEnergy = this.moodHistory.filter(e => e.energy);
    if (entriesWithEnergy.length < 5) return 0;

    const moodValues = entriesWithEnergy.map(e => this.getMoodValue(e.mood));
    const energyValues = entriesWithEnergy.map(e => {
      switch (e.energy) {
        case 'low': return 1;
        case 'medium': return 2;
        case 'high': return 3;
        default: return 2;
      }
    });

    return this.calculateCorrelation(moodValues, energyValues);
  }

  calculateMoodProductivityCorrelation(): number {
    // Match mood entries with completions that happened within 2 hours after mood check
    const correlationPairs: { mood: number; completions: number }[] = [];

    this.moodHistory.forEach(moodEntry => {
      const moodTime = new Date(moodEntry.timestamp).getTime();
      const twoHoursLater = moodTime + (2 * 60 * 60 * 1000);

      const completionsAfterMood = this.completionHistory.filter(c => {
        const completionTime = new Date(c.completedAt).getTime();
        return completionTime >= moodTime && completionTime <= twoHoursLater;
      }).length;

      correlationPairs.push({
        mood: this.getMoodValue(moodEntry.mood),
        completions: completionsAfterMood,
      });
    });

    if (correlationPairs.length < 5) return 0;

    const moodValues = correlationPairs.map(p => p.mood);
    const completionValues = correlationPairs.map(p => p.completions);

    return this.calculateCorrelation(moodValues, completionValues);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  }

  identifyLowMoodTriggers(): string[] {
    const triggers: string[] = [];

    // Analyze times when mood tends to be low
    const hourlyMoods = this.getAverageMoodByHour();
    const lowMoodHours = Object.entries(hourlyMoods)
      .filter(([_, avg]) => avg < 1.5)
      .map(([hour]) => parseInt(hour));

    if (lowMoodHours.length > 0) {
      const hourStrings = lowMoodHours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}${ampm}`;
      });
      triggers.push(`Low mood common around: ${hourStrings.join(', ')}`);
    }

    // Check for patterns after long gaps without activity
    const lowMoodAfterInactivity = this.moodHistory.filter((entry, index) => {
      if (index === 0 || entry.mood !== 'low') return false;
      const prevEntry = this.moodHistory[index - 1];
      const gap = new Date(entry.timestamp).getTime() - new Date(prevEntry.timestamp).getTime();
      return gap > 4 * 60 * 60 * 1000; // 4+ hour gap
    });

    if (lowMoodAfterInactivity.length > 2) {
      triggers.push('Mood often drops after long periods of inactivity');
    }

    return triggers;
  }

  identifyHighMoodTriggers(): string[] {
    const triggers: string[] = [];

    // Check mood after task completions
    const moodAfterCompletions = this.moodHistory.filter(entry => {
      if (entry.mood !== 'high') return false;
      const entryTime = new Date(entry.timestamp).getTime();

      // Check if there was a completion in the hour before this mood entry
      return this.completionHistory.some(c => {
        const completionTime = new Date(c.completedAt).getTime();
        return completionTime > entryTime - 60 * 60 * 1000 && completionTime < entryTime;
      });
    });

    if (moodAfterCompletions.length > 3) {
      triggers.push('Mood improves after completing tasks');
    }

    // Peak mood hours
    const hourlyMoods = this.getAverageMoodByHour();
    const highMoodHours = Object.entries(hourlyMoods)
      .filter(([_, avg]) => avg > 2.5)
      .map(([hour]) => parseInt(hour));

    if (highMoodHours.length > 0) {
      const hourStrings = highMoodHours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}${ampm}`;
      });
      triggers.push(`Best mood hours: ${hourStrings.join(', ')}`);
    }

    return triggers;
  }

  getPatternData(): MoodPattern {
    return {
      averageMoodByHour: this.getAverageMoodByHour(),
      averageMoodByDay: this.getAverageMoodByDay(),
      moodEnergyCorrelation: this.calculateMoodEnergyCorrelation(),
      moodProductivityCorrelation: this.calculateMoodProductivityCorrelation(),
      lowMoodTriggers: this.identifyLowMoodTriggers(),
      highMoodTriggers: this.identifyHighMoodTriggers(),
    };
  }

  getMoodInsight(): string {
    const pattern = this.getPatternData();
    const insights: string[] = [];

    // Correlation insights
    if (pattern.moodProductivityCorrelation > 0.5) {
      insights.push("Your mood and productivity are strongly connected - completing tasks boosts your mood!");
    } else if (pattern.moodProductivityCorrelation < -0.3) {
      insights.push("Interestingly, you're productive even when mood is lower. You're resilient!");
    }

    if (pattern.moodEnergyCorrelation > 0.5) {
      insights.push("Your mood tracks closely with energy - taking care of physical energy helps mental state.");
    }

    // Trigger insights
    if (pattern.highMoodTriggers.length > 0) {
      insights.push(pattern.highMoodTriggers[0]);
    }

    if (insights.length === 0) {
      insights.push("Keep tracking your mood to discover patterns! More data = better insights.");
    }

    return insights[Math.floor(Math.random() * insights.length)];
  }

  getDaysTracked(): number {
    if (this.moodHistory.length === 0) return 0;

    const uniqueDays = new Set(
      this.moodHistory.map(e => new Date(e.timestamp).toDateString())
    );
    return uniqueDays.size;
  }
}
