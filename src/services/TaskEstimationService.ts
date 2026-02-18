/**
 * TaskEstimationService - Learn and improve task time estimates
 *
 * Features:
 * - Track estimated vs actual time
 * - Learn patterns by task category
 * - Energy level modifiers
 * - Suggest more accurate estimates
 * - Personal accuracy tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  TaskEstimate,
  EstimationPattern,
  EstimationLearning,
  EnergyLevel,
} from '../types';

const STORAGE_KEYS = {
  ESTIMATES: 'nero_task_estimates',
  PATTERNS: 'nero_estimation_patterns',
  LEARNING: 'nero_estimation_learning',
};

// Common task categories for pattern matching
const TASK_CATEGORIES = [
  'email', 'meeting', 'coding', 'writing', 'reading',
  'planning', 'admin', 'creative', 'exercise', 'chores',
  'errands', 'calls', 'review', 'research', 'other',
];

export class TaskEstimationService {
  private estimates: TaskEstimate[] = [];
  private patterns: EstimationPattern[] = [];
  private learning: EstimationLearning = {
    patterns: [],
    overallAccuracy: 50,
    tendencyToOverestimate: true,
    suggestedMultiplier: 1.5,
  };

  async initialize(): Promise<void> {
    try {
      const [estimatesJson, patternsJson, learningJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ESTIMATES),
        AsyncStorage.getItem(STORAGE_KEYS.PATTERNS),
        AsyncStorage.getItem(STORAGE_KEYS.LEARNING),
      ]);

      if (estimatesJson) {
        this.estimates = JSON.parse(estimatesJson);
      }
      if (patternsJson) {
        this.patterns = JSON.parse(patternsJson);
      }
      if (learningJson) {
        this.learning = JSON.parse(learningJson);
      }

      // Initial analysis if we have data
      if (this.estimates.length > 10) {
        this.analyzePatterns();
      }
    } catch (error) {
      console.error('Failed to initialize TaskEstimationService:', error);
    }
  }

  // ============ ESTIMATE TRACKING ============

  async recordEstimate(
    taskId: string,
    estimatedMinutes: number,
    energy: EnergyLevel,
    category?: string
  ): Promise<TaskEstimate> {
    const estimate: TaskEstimate = {
      taskId,
      estimatedMinutes,
      energy,
      category: category || this.inferCategory(taskId),
    };

    // Check if we already have an estimate for this task
    const existingIndex = this.estimates.findIndex(e => e.taskId === taskId);
    if (existingIndex >= 0) {
      this.estimates[existingIndex] = { ...this.estimates[existingIndex], ...estimate };
    } else {
      this.estimates.push(estimate);
    }

    await this.saveEstimates();
    return estimate;
  }

  async recordCompletion(
    taskId: string,
    actualMinutes: number
  ): Promise<TaskEstimate | null> {
    const estimate = this.estimates.find(e => e.taskId === taskId);
    if (!estimate) return null;

    estimate.actualMinutes = actualMinutes;
    estimate.completedAt = new Date().toISOString();

    await this.saveEstimates();

    // Re-analyze patterns when we have new data
    if (this.getCompletedEstimates().length % 5 === 0) {
      this.analyzePatterns();
    }

    return estimate;
  }

  // ============ SMART SUGGESTIONS ============

  suggestEstimate(
    taskTitle: string,
    energy: EnergyLevel,
    userEstimate?: number
  ): {
    suggested: number;
    confidence: number;
    reasoning: string;
    range: { min: number; max: number };
  } {
    const category = this.inferCategory(taskTitle);
    const pattern = this.patterns.find(p => p.category === category);

    let suggested: number;
    let confidence: number;
    let reasoning: string;

    if (pattern && pattern.sampleSize >= 3) {
      // Use learned pattern
      const energyModifier = pattern.energyModifiers[energy] || 1;
      suggested = Math.round(pattern.avgActual * energyModifier);
      confidence = Math.min(pattern.accuracy, pattern.sampleSize * 10);
      reasoning = `Based on ${pattern.sampleSize} similar ${category} tasks`;
    } else if (userEstimate) {
      // Adjust user estimate based on overall tendency
      suggested = Math.round(userEstimate * this.learning.suggestedMultiplier);
      confidence = 40;
      reasoning = this.learning.tendencyToOverestimate
        ? `You tend to overestimate by ${Math.round((1 - this.learning.suggestedMultiplier) * 100)}%`
        : `You tend to underestimate by ${Math.round((this.learning.suggestedMultiplier - 1) * 100)}%`;
    } else {
      // Default suggestion based on energy
      const baseMinutes = energy === 'high' ? 45 : energy === 'medium' ? 25 : 15;
      suggested = baseMinutes;
      confidence = 20;
      reasoning = 'Default estimate based on energy level';
    }

    // Calculate range (±30% for low confidence, ±15% for high)
    const variance = confidence > 60 ? 0.15 : 0.30;
    const range = {
      min: Math.round(suggested * (1 - variance)),
      max: Math.round(suggested * (1 + variance)),
    };

    return { suggested, confidence, reasoning, range };
  }

  // ============ PATTERN ANALYSIS ============

  private analyzePatterns(): void {
    const completedEstimates = this.getCompletedEstimates();
    if (completedEstimates.length < 5) return;

    // Group by category
    const byCategory = new Map<string, TaskEstimate[]>();
    for (const estimate of completedEstimates) {
      const category = estimate.category || 'other';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(estimate);
    }

    // Calculate patterns for each category
    this.patterns = [];
    for (const [category, estimates] of byCategory) {
      if (estimates.length < 2) continue;

      const avgEstimate = this.average(estimates.map(e => e.estimatedMinutes));
      const avgActual = this.average(estimates.map(e => e.actualMinutes!));

      // Calculate accuracy (100% means estimates match actual)
      const accuracies = estimates.map(e => {
        const diff = Math.abs(e.estimatedMinutes - e.actualMinutes!);
        const maxTime = Math.max(e.estimatedMinutes, e.actualMinutes!);
        return 100 - (diff / maxTime) * 100;
      });
      const accuracy = this.average(accuracies);

      // Calculate energy modifiers
      const energyModifiers: Record<EnergyLevel, number> = {
        low: 1,
        medium: 1,
        high: 1,
      };

      for (const level of ['low', 'medium', 'high'] as EnergyLevel[]) {
        const levelEstimates = estimates.filter(e => e.energy === level);
        if (levelEstimates.length >= 2) {
          const levelAvgActual = this.average(levelEstimates.map(e => e.actualMinutes!));
          energyModifiers[level] = levelAvgActual / avgActual;
        }
      }

      this.patterns.push({
        category,
        avgEstimate,
        avgActual,
        accuracy,
        sampleSize: estimates.length,
        energyModifiers,
      });
    }

    // Calculate overall learning metrics
    const allAccuracies = completedEstimates.map(e => {
      const diff = Math.abs(e.estimatedMinutes - e.actualMinutes!);
      const maxTime = Math.max(e.estimatedMinutes, e.actualMinutes!);
      return 100 - (diff / maxTime) * 100;
    });

    const totalEstimated = completedEstimates.reduce((sum, e) => sum + e.estimatedMinutes, 0);
    const totalActual = completedEstimates.reduce((sum, e) => sum + e.actualMinutes!, 0);

    this.learning = {
      patterns: this.patterns,
      overallAccuracy: this.average(allAccuracies),
      tendencyToOverestimate: totalEstimated > totalActual,
      suggestedMultiplier: totalActual / totalEstimated,
    };

    this.savePatterns();
    this.saveLearning();
  }

  private getCompletedEstimates(): TaskEstimate[] {
    return this.estimates.filter(e => e.actualMinutes !== undefined);
  }

  // ============ CATEGORY INFERENCE ============

  private inferCategory(taskTitle: string): string {
    const title = taskTitle.toLowerCase();

    // Keywords for each category
    const categoryKeywords: Record<string, string[]> = {
      email: ['email', 'inbox', 'mail', 'reply', 'respond'],
      meeting: ['meeting', 'call', 'zoom', 'standup', 'sync'],
      coding: ['code', 'bug', 'feature', 'implement', 'debug', 'fix', 'develop'],
      writing: ['write', 'draft', 'document', 'blog', 'article', 'content'],
      reading: ['read', 'review', 'article', 'book', 'documentation'],
      planning: ['plan', 'organize', 'schedule', 'strategy', 'roadmap'],
      admin: ['admin', 'paperwork', 'forms', 'invoice', 'expense'],
      creative: ['design', 'brainstorm', 'creative', 'ideate', 'concept'],
      exercise: ['exercise', 'workout', 'gym', 'run', 'yoga', 'walk'],
      chores: ['clean', 'laundry', 'dishes', 'tidy', 'organize home'],
      errands: ['errand', 'shop', 'buy', 'pickup', 'groceries', 'store'],
      calls: ['call', 'phone', 'talk'],
      research: ['research', 'investigate', 'explore', 'learn', 'study'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => title.includes(keyword))) {
        return category;
      }
    }

    return 'other';
  }

  // ============ INSIGHTS ============

  getInsights(): string[] {
    const insights: string[] = [];
    const completed = this.getCompletedEstimates();

    if (completed.length < 5) {
      return ['Complete more tasks to get personalized insights!'];
    }

    // Overall accuracy insight
    if (this.learning.overallAccuracy > 80) {
      insights.push(`🎯 Your estimates are ${Math.round(this.learning.overallAccuracy)}% accurate. Excellent!`);
    } else if (this.learning.overallAccuracy > 60) {
      insights.push(`📊 Your estimates are ${Math.round(this.learning.overallAccuracy)}% accurate. Good, but room to improve!`);
    } else {
      insights.push(`💡 Your estimates are ${Math.round(this.learning.overallAccuracy)}% accurate. Try using my suggestions!`);
    }

    // Tendency insight
    if (this.learning.tendencyToOverestimate) {
      const percent = Math.round((1 - this.learning.suggestedMultiplier) * 100);
      insights.push(`⏰ You tend to overestimate by about ${percent}%`);
    } else {
      const percent = Math.round((this.learning.suggestedMultiplier - 1) * 100);
      insights.push(`⏰ You tend to underestimate by about ${percent}%`);
    }

    // Energy insights
    for (const pattern of this.patterns) {
      if (pattern.energyModifiers.low > 1.3 && pattern.sampleSize >= 3) {
        insights.push(`🌙 ${pattern.category} tasks take ${Math.round((pattern.energyModifiers.low - 1) * 100)}% longer on low energy`);
        break;
      }
    }

    // Category-specific insights
    const sortedPatterns = [...this.patterns].sort((a, b) => b.sampleSize - a.sampleSize);
    for (const pattern of sortedPatterns.slice(0, 2)) {
      if (pattern.accuracy > 75) {
        insights.push(`✨ Great at estimating ${pattern.category} tasks (${Math.round(pattern.accuracy)}% accurate)`);
      } else if (pattern.accuracy < 50) {
        insights.push(`📈 ${pattern.category} tasks often take ${Math.round(pattern.avgActual / pattern.avgEstimate * 100 - 100)}% longer than expected`);
      }
    }

    return insights;
  }

  getStatistics(): {
    totalTracked: number;
    avgAccuracy: number;
    mostAccurateCategory: string | null;
    leastAccurateCategory: string | null;
    totalTimeEstimated: number;
    totalTimeActual: number;
  } {
    const completed = this.getCompletedEstimates();

    if (completed.length === 0) {
      return {
        totalTracked: 0,
        avgAccuracy: 0,
        mostAccurateCategory: null,
        leastAccurateCategory: null,
        totalTimeEstimated: 0,
        totalTimeActual: 0,
      };
    }

    const sortedPatterns = [...this.patterns].sort((a, b) => b.accuracy - a.accuracy);

    return {
      totalTracked: completed.length,
      avgAccuracy: this.learning.overallAccuracy,
      mostAccurateCategory: sortedPatterns[0]?.category || null,
      leastAccurateCategory: sortedPatterns[sortedPatterns.length - 1]?.category || null,
      totalTimeEstimated: completed.reduce((sum, e) => sum + e.estimatedMinutes, 0),
      totalTimeActual: completed.reduce((sum, e) => sum + (e.actualMinutes || 0), 0),
    };
  }

  // ============ HELPERS ============

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private async saveEstimates(): Promise<void> {
    try {
      // Keep last 500 estimates
      const toSave = this.estimates.slice(-500);
      await AsyncStorage.setItem(STORAGE_KEYS.ESTIMATES, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save estimates:', error);
    }
  }

  private async savePatterns(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(this.patterns));
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }

  private async saveLearning(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LEARNING, JSON.stringify(this.learning));
    } catch (error) {
      console.error('Failed to save learning:', error);
    }
  }

  getPatterns(): EstimationPattern[] {
    return [...this.patterns];
  }

  getLearning(): EstimationLearning {
    return { ...this.learning };
  }
}

// Singleton instance
let serviceInstance: TaskEstimationService | null = null;

export function getTaskEstimationService(): TaskEstimationService {
  if (!serviceInstance) {
    serviceInstance = new TaskEstimationService();
  }
  return serviceInstance;
}

export async function initializeTaskEstimationService(): Promise<TaskEstimationService> {
  const service = getTaskEstimationService();
  await service.initialize();
  return service;
}
