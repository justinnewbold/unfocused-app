import {
  Task,
  EnergyLevel,
  CompletionRecord,
  HourlyProductivity,
  PatternData,
  WeeklyInsight,
  UserProfile,
  MoodLevel
} from '../types';
import { genId, PERSONALITIES } from '../constants';

// ============ PATTERN ANALYSIS SERVICE ============
export class PatternAnalysisService {
  private completionHistory: CompletionRecord[] = [];

  setHistory(history: CompletionRecord[]) {
    this.completionHistory = history;
  }

  getHistory(): CompletionRecord[] {
    return this.completionHistory;
  }

  recordCompletion(task: Task, mood?: MoodLevel): CompletionRecord {
    const now = new Date();
    const record: CompletionRecord = {
      id: genId(),
      taskId: task.id,
      taskTitle: task.title,
      energy: task.energy,
      completedAt: now.toISOString(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      completionTimeMs: task.completionTimeMs,
      mood,
    };
    this.completionHistory.push(record);
    return record;
  }

  getHourlyStats(): HourlyProductivity[] {
    const hourlyData: Record<number, { completions: number; energySum: number; count: number }> = {};

    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { completions: 0, energySum: 0, count: 0 };
    }

    // Aggregate completions by hour
    this.completionHistory.forEach(record => {
      const energyValue = record.energy === 'high' ? 3 : record.energy === 'medium' ? 2 : 1;
      hourlyData[record.hour].completions++;
      hourlyData[record.hour].energySum += energyValue;
      hourlyData[record.hour].count++;
    });

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      completions: data.completions,
      avgEnergy: data.count > 0 ? data.energySum / data.count : 0,
      successRate: data.completions > 0 ? 1 : 0,
    }));
  }

  getPeakHours(): number[] {
    const hourlyStats = this.getHourlyStats();
    const maxCompletions = Math.max(...hourlyStats.map(h => h.completions));
    if (maxCompletions === 0) return [9, 10, 11]; // Default morning hours

    const threshold = maxCompletions * 0.7;
    return hourlyStats
      .filter(h => h.completions >= threshold)
      .map(h => h.hour)
      .slice(0, 3);
  }

  getBestDays(): number[] {
    const dayData: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    this.completionHistory.forEach(r => { dayData[r.dayOfWeek]++; });

    const sorted = Object.entries(dayData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    return sorted.length > 0 ? sorted : [1, 2, 3]; // Default to weekdays
  }

  getWeeklyTrend(): 'improving' | 'stable' | 'declining' {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const thisWeek = this.completionHistory.filter(r =>
      new Date(r.completedAt).getTime() > oneWeekAgo
    ).length;

    const lastWeek = this.completionHistory.filter(r => {
      const time = new Date(r.completedAt).getTime();
      return time > twoWeeksAgo && time <= oneWeekAgo;
    }).length;

    if (thisWeek > lastWeek * 1.2) return 'improving';
    if (thisWeek < lastWeek * 0.8) return 'declining';
    return 'stable';
  }

  getPatternData(): PatternData {
    const avgByEnergy: Record<EnergyLevel, number> = { low: 0, medium: 0, high: 0 };
    const countByEnergy: Record<EnergyLevel, number> = { low: 0, medium: 0, high: 0 };

    this.completionHistory.forEach(r => {
      countByEnergy[r.energy]++;
    });

    return {
      hourlyStats: this.getHourlyStats(),
      peakHours: this.getPeakHours(),
      bestDays: this.getBestDays(),
      avgCompletionsByEnergy: countByEnergy,
      totalCompletions: this.completionHistory.length,
      weeklyTrend: this.getWeeklyTrend(),
    };
  }

  generateInsights(profile: UserProfile, energy: EnergyLevel | null, tasks: Task[], mood?: MoodLevel): WeeklyInsight[] {
    const patterns = this.getPatternData();
    const insights: WeeklyInsight[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Peak hours insight
    if (patterns.peakHours.length > 0) {
      const peakTimes = patterns.peakHours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}${ampm}`;
      }).join(', ');

      insights.push({
        id: genId(),
        type: 'peak_hours',
        title: 'Your Peak Hours',
        message: `You're most productive around ${peakTimes}. Try scheduling important tasks during these times!`,
        emoji: '⚡',
        generatedAt: new Date().toISOString(),
        priority: 1,
      });
    }

    // Best days insight
    if (patterns.bestDays.length > 0) {
      const bestDayNames = patterns.bestDays.map(d => dayNames[d]).join(' & ');
      insights.push({
        id: genId(),
        type: 'energy_pattern',
        title: 'Best Days',
        message: `${bestDayNames} tend to be your most productive days. Plan challenging tasks for these days!`,
        emoji: '📅',
        generatedAt: new Date().toISOString(),
        priority: 2,
      });
    }

    // Weekly trend insight
    const trendEmoji = patterns.weeklyTrend === 'improving' ? '📈' : patterns.weeklyTrend === 'declining' ? '📉' : '➡️';
    const trendMsg = patterns.weeklyTrend === 'improving'
      ? "You're completing more tasks than last week! Keep up the momentum!"
      : patterns.weeklyTrend === 'declining'
        ? "This week's been slower - that's okay! Be gentle with yourself."
        : "You're maintaining a steady pace. Consistency is key!";

    insights.push({
      id: genId(),
      type: 'achievement',
      title: 'Weekly Trend',
      message: trendMsg,
      emoji: trendEmoji,
      generatedAt: new Date().toISOString(),
      priority: 3,
    });

    // Energy-based suggestion
    if (energy === 'low' && tasks.filter(t => !t.completed && t.energy === 'low').length > 0) {
      insights.push({
        id: genId(),
        type: 'suggestion',
        title: 'Low Energy Mode',
        message: "I see you're low energy. I've got some easy wins queued up for you - small victories still count!",
        emoji: '🌙',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    // Mood-based insight
    if (mood === 'low') {
      insights.push({
        id: genId(),
        type: 'mood_correlation',
        title: 'Feeling Down?',
        message: "Low days happen. One tiny task can shift momentum. What's the smallest thing you could do?",
        emoji: '💙',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    // Completion milestone
    if (patterns.totalCompletions > 0 && patterns.totalCompletions % 10 === 0) {
      insights.push({
        id: genId(),
        type: 'achievement',
        title: 'Milestone!',
        message: `You've completed ${patterns.totalCompletions} tasks total! That's amazing progress! 🎉`,
        emoji: '🏆',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    // Optimal scheduling suggestion
    const currentHour = new Date().getHours();
    if (patterns.peakHours.includes(currentHour)) {
      insights.push({
        id: genId(),
        type: 'suggestion',
        title: 'Peak Time Now!',
        message: "Right now is one of your peak productivity hours! Perfect time for that challenging task.",
        emoji: '🎯',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    return insights.sort((a, b) => a.priority - b.priority);
  }

  async generateAIInsights(apiKey: string, patterns: PatternData, profile: UserProfile): Promise<string> {
    if (!apiKey) {
      return this.generateLocalInsight(patterns);
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: `You are Nero, an AI companion helping someone with ADHD understand their productivity patterns. Be warm, encouraging, and specific. Keep it under 50 words. Never guilt or shame.`,
          messages: [{
            role: 'user',
            content: `Based on my productivity data:
- Peak hours: ${patterns.peakHours.map(h => `${h}:00`).join(', ')}
- Total completions: ${patterns.totalCompletions}
- Weekly trend: ${patterns.weeklyTrend}
- Best for high energy tasks: ${patterns.avgCompletionsByEnergy.high} completions
- Best for low energy tasks: ${patterns.avgCompletionsByEnergy.low} completions

Give me ONE specific, actionable insight about my ADHD productivity patterns.`
          }],
        }),
      });

      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      return data.content[0]?.text || this.generateLocalInsight(patterns);
    } catch {
      return this.generateLocalInsight(patterns);
    }
  }

  private generateLocalInsight(patterns: PatternData): string {
    const insights = [
      `Your brain loves ${patterns.peakHours[0] || 10}:00 - that's your superpower hour! ⚡`,
      `You've crushed ${patterns.totalCompletions} tasks! Every single one counts. 🎯`,
      `${patterns.weeklyTrend === 'improving' ? 'You\'re on fire this week!' : 'Steady progress is still progress!'} 💪`,
      `Low energy? Your data shows you still get things done - just differently. 🌙`,
    ];
    return insights[Math.floor(Math.random() * insights.length)];
  }

  // Get energy-completion correlation
  getEnergyPatterns(): { energy: EnergyLevel; successRate: number; bestHour: number }[] {
    const energyData: Record<EnergyLevel, { completions: number; hours: Record<number, number> }> = {
      low: { completions: 0, hours: {} },
      medium: { completions: 0, hours: {} },
      high: { completions: 0, hours: {} },
    };

    this.completionHistory.forEach(r => {
      energyData[r.energy].completions++;
      energyData[r.energy].hours[r.hour] = (energyData[r.energy].hours[r.hour] || 0) + 1;
    });

    return (['low', 'medium', 'high'] as EnergyLevel[]).map(energy => {
      const data = energyData[energy];
      const total = data.completions;
      const hours = Object.entries(data.hours);
      const bestHour = hours.length > 0
        ? hours.reduce((best, [h, c]) => c > best.count ? { hour: parseInt(h), count: c } : best, { hour: 9, count: 0 }).hour
        : 9;

      return {
        energy,
        successRate: total / (this.completionHistory.length || 1),
        bestHour,
      };
    });
  }
}
