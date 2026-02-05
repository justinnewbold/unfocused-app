/**
 * DailyPlanningService - Morning planning and evening reflection
 *
 * Features:
 * - Guided morning planning routine
 * - Energy prediction based on patterns
 * - Task prioritization assistance
 * - End-of-day reflection prompts
 * - Progress tracking over time
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DailyPlan,
  DailyReflection,
  MoodLevel,
  EnergyLevel,
  Task,
} from '../types';

const STORAGE_KEYS = {
  PLANS: 'nero_daily_plans',
  REFLECTIONS: 'nero_daily_reflections',
  STREAKS: 'nero_planning_streaks',
};

interface PlanningStreak {
  currentPlanningStreak: number;
  currentReflectionStreak: number;
  longestPlanningStreak: number;
  longestReflectionStreak: number;
  totalDaysPlanned: number;
  totalDaysReflected: number;
}

export class DailyPlanningService {
  private plans: DailyPlan[] = [];
  private reflections: DailyReflection[] = [];
  private streaks: PlanningStreak = {
    currentPlanningStreak: 0,
    currentReflectionStreak: 0,
    longestPlanningStreak: 0,
    longestReflectionStreak: 0,
    totalDaysPlanned: 0,
    totalDaysReflected: 0,
  };

  async initialize(): Promise<void> {
    try {
      const [plansJson, reflectionsJson, streaksJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.PLANS),
        AsyncStorage.getItem(STORAGE_KEYS.REFLECTIONS),
        AsyncStorage.getItem(STORAGE_KEYS.STREAKS),
      ]);

      if (plansJson) this.plans = JSON.parse(plansJson);
      if (reflectionsJson) this.reflections = JSON.parse(reflectionsJson);
      if (streaksJson) this.streaks = JSON.parse(streaksJson);

      // Update streaks
      this.updateStreaks();
    } catch (error) {
      console.error('Failed to initialize DailyPlanningService:', error);
    }
  }

  // ============ DAILY PLANNING ============

  async createDailyPlan(
    topPriority?: string,
    plannedTasks?: string[],
    intentions?: string[]
  ): Promise<DailyPlan> {
    const today = this.getDateString(new Date());

    // Check if we already have a plan for today
    const existingPlan = this.plans.find(p => p.date === today);
    if (existingPlan) {
      return this.updateDailyPlan(existingPlan.id, {
        topPriority,
        plannedTasks,
        intentions,
      });
    }

    const plan: DailyPlan = {
      id: `plan_${Date.now()}`,
      date: today,
      topPriority,
      plannedTasks: plannedTasks || [],
      energyPrediction: this.predictTodayEnergy(),
      intentions: intentions || [],
      createdAt: new Date().toISOString(),
    };

    this.plans.push(plan);
    await this.savePlans();

    // Update streaks
    this.streaks.currentPlanningStreak++;
    this.streaks.totalDaysPlanned++;
    if (this.streaks.currentPlanningStreak > this.streaks.longestPlanningStreak) {
      this.streaks.longestPlanningStreak = this.streaks.currentPlanningStreak;
    }
    await this.saveStreaks();

    return plan;
  }

  async updateDailyPlan(
    planId: string,
    updates: Partial<Omit<DailyPlan, 'id' | 'date' | 'createdAt'>>
  ): Promise<DailyPlan> {
    const plan = this.plans.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    Object.assign(plan, updates);
    await this.savePlans();
    return plan;
  }

  getTodaysPlan(): DailyPlan | null {
    const today = this.getDateString(new Date());
    return this.plans.find(p => p.date === today) || null;
  }

  hasPlannedToday(): boolean {
    return this.getTodaysPlan() !== null;
  }

  // ============ DAILY REFLECTION ============

  async createDailyReflection(
    accomplishments: string[],
    challenges: string[],
    mood: MoodLevel,
    energyRating: number,
    productivityRating: number,
    options?: {
      gratitude?: string;
      tomorrowFocus?: string;
    }
  ): Promise<DailyReflection> {
    const today = this.getDateString(new Date());
    const todaysPlan = this.getTodaysPlan();

    // Check if we already reflected today
    const existingReflection = this.reflections.find(r => r.date === today);
    if (existingReflection) {
      return this.updateDailyReflection(existingReflection.id, {
        accomplishments,
        challenges,
        mood,
        energyRating,
        productivityRating,
        ...options,
      });
    }

    const reflection: DailyReflection = {
      id: `reflection_${Date.now()}`,
      date: today,
      planId: todaysPlan?.id,
      accomplishments,
      challenges,
      gratitude: options?.gratitude,
      tomorrowFocus: options?.tomorrowFocus,
      mood,
      energyRating,
      productivityRating,
      createdAt: new Date().toISOString(),
    };

    this.reflections.push(reflection);
    await this.saveReflections();

    // Mark plan as reflected
    if (todaysPlan) {
      todaysPlan.reflectionCompleted = true;
      await this.savePlans();
    }

    // Update streaks
    this.streaks.currentReflectionStreak++;
    this.streaks.totalDaysReflected++;
    if (this.streaks.currentReflectionStreak > this.streaks.longestReflectionStreak) {
      this.streaks.longestReflectionStreak = this.streaks.currentReflectionStreak;
    }
    await this.saveStreaks();

    return reflection;
  }

  async updateDailyReflection(
    reflectionId: string,
    updates: Partial<Omit<DailyReflection, 'id' | 'date' | 'createdAt'>>
  ): Promise<DailyReflection> {
    const reflection = this.reflections.find(r => r.id === reflectionId);
    if (!reflection) {
      throw new Error('Reflection not found');
    }

    Object.assign(reflection, updates);
    await this.saveReflections();
    return reflection;
  }

  getTodaysReflection(): DailyReflection | null {
    const today = this.getDateString(new Date());
    return this.reflections.find(r => r.date === today) || null;
  }

  hasReflectedToday(): boolean {
    return this.getTodaysReflection() !== null;
  }

  // ============ ENERGY PREDICTION ============

  predictTodayEnergy(): EnergyLevel {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const recentReflections = this.reflections
      .filter(r => {
        const reflectionDate = new Date(r.date);
        const daysDiff = (now.getTime() - reflectionDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 14 && reflectionDate.getDay() === dayOfWeek;
      });

    if (recentReflections.length < 2) {
      // Not enough data, return medium
      return 'medium';
    }

    const avgEnergy = recentReflections.reduce((sum, r) => sum + r.energyRating, 0) / recentReflections.length;

    if (avgEnergy >= 4) return 'high';
    if (avgEnergy >= 2.5) return 'medium';
    return 'low';
  }

  // ============ PLANNING PROMPTS ============

  getPlanningPrompts(): string[] {
    const prompts = [
      'What\'s the ONE thing that would make today a success?',
      'What\'s been on your mind that you want to tackle?',
      'Is there anything you\'ve been avoiding?',
      'What would future you thank you for doing today?',
    ];

    const energyPrediction = this.predictTodayEnergy();
    if (energyPrediction === 'low') {
      prompts.push('It might be a lower energy day. What\'s one manageable thing you can do?');
    } else if (energyPrediction === 'high') {
      prompts.push('You tend to have good energy on days like this. Ready for a challenge?');
    }

    return prompts;
  }

  getReflectionPrompts(): string[] {
    return [
      'What went well today?',
      'What was challenging?',
      'What did you learn?',
      'What are you grateful for?',
      'What would you do differently?',
      'What\'s one thing you want to focus on tomorrow?',
    ];
  }

  // ============ TASK SUGGESTIONS FOR PLANNING ============

  suggestTasksForToday(
    allTasks: Task[],
    currentEnergy: EnergyLevel
  ): Task[] {
    const incompleteTasks = allTasks.filter(t => !t.completed);

    // Score tasks based on various factors
    const scoredTasks = incompleteTasks.map(task => {
      let score = 0;

      // Due date urgency
      if (task.dueDate) {
        const daysUntilDue = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilDue < 0) score += 50; // Overdue
        else if (daysUntilDue < 1) score += 40; // Due today
        else if (daysUntilDue < 3) score += 20; // Due soon
      }

      // Energy match
      if (task.energy === currentEnergy) {
        score += 30;
      } else if (
        (currentEnergy === 'high' && task.energy === 'medium') ||
        (currentEnergy === 'medium' && task.energy !== currentEnergy) ||
        (currentEnergy === 'low' && task.energy === 'medium')
      ) {
        score += 15;
      }

      // Micro-steps get slight priority (easy wins)
      if (task.isMicroStep) {
        score += 10;
      }

      return { task, score };
    });

    // Sort by score and return top suggestions
    return scoredTasks
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(st => st.task);
  }

  // ============ INSIGHTS ============

  getInsights(): string[] {
    const insights: string[] = [];

    // Streak insights
    if (this.streaks.currentPlanningStreak >= 7) {
      insights.push(`🔥 ${this.streaks.currentPlanningStreak} day planning streak!`);
    }
    if (this.streaks.currentReflectionStreak >= 7) {
      insights.push(`✨ ${this.streaks.currentReflectionStreak} day reflection streak!`);
    }

    // Mood/energy patterns
    const recentReflections = this.reflections.slice(-14);
    if (recentReflections.length >= 7) {
      const avgMood = this.calculateAverageMood(recentReflections);
      const avgEnergy = recentReflections.reduce((sum, r) => sum + r.energyRating, 0) / recentReflections.length;

      if (avgEnergy >= 4) {
        insights.push('🚀 Your energy has been great lately!');
      } else if (avgEnergy <= 2) {
        insights.push('💙 Energy has been lower - remember to be gentle with yourself');
      }

      // Check for improvements
      if (recentReflections.length >= 14) {
        const firstHalf = recentReflections.slice(0, 7);
        const secondHalf = recentReflections.slice(7);
        const firstAvg = firstHalf.reduce((sum, r) => sum + r.productivityRating, 0) / 7;
        const secondAvg = secondHalf.reduce((sum, r) => sum + r.productivityRating, 0) / 7;

        if (secondAvg > firstAvg + 0.5) {
          insights.push('📈 Your productivity has been improving!');
        }
      }
    }

    // Common accomplishments
    const accomplishments = this.reflections.slice(-30).flatMap(r => r.accomplishments);
    if (accomplishments.length > 0) {
      insights.push(`🎯 ${accomplishments.length} accomplishments in the last month!`);
    }

    return insights;
  }

  private calculateAverageMood(reflections: DailyReflection[]): number {
    const moodValues: Record<MoodLevel, number> = { low: 1, neutral: 2, high: 3 };
    const sum = reflections.reduce((s, r) => s + moodValues[r.mood], 0);
    return sum / reflections.length;
  }

  getStatistics(): {
    totalPlans: number;
    totalReflections: number;
    streaks: PlanningStreak;
    avgProductivity: number;
    avgEnergy: number;
    completionRate: number;
  } {
    const recentReflections = this.reflections.slice(-30);

    const avgProductivity = recentReflections.length > 0
      ? recentReflections.reduce((sum, r) => sum + r.productivityRating, 0) / recentReflections.length
      : 0;

    const avgEnergy = recentReflections.length > 0
      ? recentReflections.reduce((sum, r) => sum + r.energyRating, 0) / recentReflections.length
      : 0;

    const plansWithReflections = this.plans.filter(p => p.reflectionCompleted).length;
    const completionRate = this.plans.length > 0
      ? (plansWithReflections / this.plans.length) * 100
      : 0;

    return {
      totalPlans: this.plans.length,
      totalReflections: this.reflections.length,
      streaks: { ...this.streaks },
      avgProductivity,
      avgEnergy,
      completionRate,
    };
  }

  // ============ HELPERS ============

  private getDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private updateStreaks(): void {
    // Check if yesterday was planned/reflected
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = this.getDateString(yesterday);

    const plannedYesterday = this.plans.some(p => p.date === yesterdayStr);
    const reflectedYesterday = this.reflections.some(r => r.date === yesterdayStr);

    if (!plannedYesterday) {
      this.streaks.currentPlanningStreak = 0;
    }
    if (!reflectedYesterday) {
      this.streaks.currentReflectionStreak = 0;
    }
  }

  private async savePlans(): Promise<void> {
    try {
      // Keep last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = this.getDateString(cutoff);

      const toSave = this.plans.filter(p => p.date >= cutoffStr);
      await AsyncStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save plans:', error);
    }
  }

  private async saveReflections(): Promise<void> {
    try {
      // Keep last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cutoffStr = this.getDateString(cutoff);

      const toSave = this.reflections.filter(r => r.date >= cutoffStr);
      await AsyncStorage.setItem(STORAGE_KEYS.REFLECTIONS, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save reflections:', error);
    }
  }

  private async saveStreaks(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STREAKS, JSON.stringify(this.streaks));
    } catch (error) {
      console.error('Failed to save streaks:', error);
    }
  }

  getPlans(limit?: number): DailyPlan[] {
    const sorted = [...this.plans].sort((a, b) => b.date.localeCompare(a.date));
    return limit ? sorted.slice(0, limit) : sorted;
  }

  getReflections(limit?: number): DailyReflection[] {
    const sorted = [...this.reflections].sort((a, b) => b.date.localeCompare(a.date));
    return limit ? sorted.slice(0, limit) : sorted;
  }
}

// Singleton instance
let serviceInstance: DailyPlanningService | null = null;

export function getDailyPlanningService(): DailyPlanningService {
  if (!serviceInstance) {
    serviceInstance = new DailyPlanningService();
  }
  return serviceInstance;
}

export async function initializeDailyPlanningService(): Promise<DailyPlanningService> {
  const service = getDailyPlanningService();
  await service.initialize();
  return service;
}
