import {
  Task,
  TaskSuggestion,
  SuggestionContext,
  EnergyLevel,
  MoodLevel,
  CompletionRecord,
  CalendarEvent
} from '../types';
import { genId } from '../constants';

// ============ CONTEXT-AWARE SUGGESTION SERVICE ============
// Suggests the best task to work on based on current context
export class ContextAwareSuggestionService {
  private completionHistory: CompletionRecord[] = [];
  private peakHours: number[] = [9, 10, 11];
  private calendarEvents: CalendarEvent[] = [];
  private lastActivityTime: string = new Date().toISOString();

  setCompletionHistory(history: CompletionRecord[]) {
    this.completionHistory = history;
    this.analyzePeakHours();
  }

  setCalendarEvents(events: CalendarEvent[]) {
    this.calendarEvents = events;
  }

  recordActivity() {
    this.lastActivityTime = new Date().toISOString();
  }

  private analyzePeakHours() {
    const hourlyCompletions: Record<number, number> = {};

    this.completionHistory.forEach(c => {
      const hour = new Date(c.completedAt).getHours();
      hourlyCompletions[hour] = (hourlyCompletions[hour] || 0) + 1;
    });

    const sorted = Object.entries(hourlyCompletions)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    this.peakHours = sorted.slice(0, 3).map(h => h.hour);
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private getRecentActivity(): 'high' | 'medium' | 'low' {
    const lastActivity = new Date(this.lastActivityTime).getTime();
    const minutesSince = (Date.now() - lastActivity) / (1000 * 60);

    if (minutesSince < 15) return 'high';
    if (minutesSince < 60) return 'medium';
    return 'low';
  }

  private getCalendarContext(): 'free' | 'busy_soon' | 'just_finished' {
    const now = Date.now();

    for (const event of this.calendarEvents) {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();

      // Just finished an event (within last 30 min)
      if (eventEnd < now && now - eventEnd < 30 * 60 * 1000) {
        return 'just_finished';
      }

      // Event starting soon (within next 30 min)
      if (eventStart > now && eventStart - now < 30 * 60 * 1000) {
        return 'busy_soon';
      }
    }

    return 'free';
  }

  buildContext(energy: EnergyLevel | null, mood: MoodLevel | null): SuggestionContext {
    return {
      timeOfDay: this.getTimeOfDay(),
      currentEnergy: energy,
      currentMood: mood,
      isPeakHour: this.peakHours.includes(new Date().getHours()),
      recentActivity: this.getRecentActivity(),
      calendarContext: this.getCalendarContext(),
    };
  }

  scoreTask(task: Task, context: SuggestionContext): number {
    let score = 50; // Base score

    // Energy matching (most important)
    if (context.currentEnergy) {
      if (task.energy === context.currentEnergy) {
        score += 30;
      } else if (
        (context.currentEnergy === 'high' && task.energy === 'medium') ||
        (context.currentEnergy === 'medium' && task.energy === 'low')
      ) {
        score += 10;
      } else if (
        (context.currentEnergy === 'low' && task.energy === 'high')
      ) {
        score -= 20;
      }
    }

    // Peak hour bonus for high-energy tasks
    if (context.isPeakHour && task.energy === 'high') {
      score += 20;
    }

    // Low mood = prefer easy wins
    if (context.currentMood === 'low') {
      if (task.energy === 'low' || task.isMicroStep) {
        score += 25;
      } else if (task.energy === 'high') {
        score -= 15;
      }
    }

    // High mood = can handle more
    if (context.currentMood === 'high' && task.energy === 'high') {
      score += 15;
    }

    // Time of day adjustments
    if (context.timeOfDay === 'morning' && task.energy === 'high') {
      score += 10;
    }
    if (context.timeOfDay === 'evening' && task.energy === 'low') {
      score += 10;
    }
    if (context.timeOfDay === 'night') {
      score -= task.energy === 'high' ? 20 : 0;
    }

    // Calendar context
    if (context.calendarContext === 'busy_soon') {
      // Prefer quick tasks
      if (task.isMicroStep || task.energy === 'low') {
        score += 15;
      } else {
        score -= 10;
      }
    }
    if (context.calendarContext === 'free') {
      // Good time for bigger tasks
      if (task.energy === 'high') {
        score += 10;
      }
    }

    // Recent activity - after a break, suggest easier tasks
    if (context.recentActivity === 'low' && task.isMicroStep) {
      score += 20;
    }

    // Micro-steps get a bonus for task initiation
    if (task.isMicroStep) {
      score += 10;
    }

    // Older uncompleted tasks get slight priority
    const ageInDays = (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 2) {
      score += Math.min(ageInDays * 2, 10);
    }

    return Math.max(0, Math.min(100, score));
  }

  generateReason(task: Task, context: SuggestionContext, score: number): string {
    const reasons: string[] = [];

    if (context.isPeakHour && task.energy === 'high') {
      reasons.push("It's your peak productivity hour");
    }

    if (context.currentEnergy === task.energy) {
      reasons.push(`Matches your ${task.energy} energy level`);
    }

    if (context.currentMood === 'low' && (task.energy === 'low' || task.isMicroStep)) {
      reasons.push("Easy win for when energy is low");
    }

    if (context.calendarContext === 'busy_soon' && (task.isMicroStep || task.energy === 'low')) {
      reasons.push("Quick task before your next event");
    }

    if (context.calendarContext === 'free' && task.energy === 'high') {
      reasons.push("You have a clear window for focused work");
    }

    if (task.isMicroStep) {
      reasons.push("Small step to build momentum");
    }

    const ageInDays = (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 3) {
      reasons.push("Been waiting for attention");
    }

    if (context.timeOfDay === 'morning' && task.energy === 'high') {
      reasons.push("Morning is great for challenging tasks");
    }

    if (reasons.length === 0) {
      reasons.push("Solid choice for right now");
    }

    return reasons[0];
  }

  getSuggestions(
    tasks: Task[],
    energy: EnergyLevel | null,
    mood: MoodLevel | null,
    limit: number = 3
  ): TaskSuggestion[] {
    const pendingTasks = tasks.filter(t => !t.completed);
    if (pendingTasks.length === 0) return [];

    const context = this.buildContext(energy, mood);

    const scoredTasks = pendingTasks.map(task => ({
      task,
      score: this.scoreTask(task, context),
    }));

    scoredTasks.sort((a, b) => b.score - a.score);

    return scoredTasks.slice(0, limit).map(({ task, score }) => ({
      id: genId(),
      taskId: task.id,
      reason: this.generateReason(task, context, score),
      confidence: score / 100,
      context,
    }));
  }

  getTopSuggestion(
    tasks: Task[],
    energy: EnergyLevel | null,
    mood: MoodLevel | null
  ): TaskSuggestion | null {
    const suggestions = this.getSuggestions(tasks, energy, mood, 1);
    return suggestions.length > 0 ? suggestions[0] : null;
  }

  explainSuggestion(suggestion: TaskSuggestion, task: Task): string {
    const ctx = suggestion.context;
    const parts: string[] = [];

    if (ctx.isPeakHour) {
      parts.push("📈 You're in a peak productivity window");
    }

    if (ctx.currentEnergy === task.energy) {
      parts.push(`⚡ Perfect match for your ${task.energy} energy`);
    }

    if (ctx.currentMood === 'low' && task.energy === 'low') {
      parts.push("💙 Gentle task for when things feel heavy");
    }

    if (ctx.calendarContext === 'free') {
      parts.push("📅 Your calendar is clear - great for focused work");
    }

    if (ctx.calendarContext === 'busy_soon') {
      parts.push("⏰ Quick win before your next commitment");
    }

    if (task.isMicroStep) {
      parts.push("✨ Tiny step to get you started");
    }

    if (parts.length === 0) {
      parts.push("🎯 Solid choice based on your patterns");
    }

    return parts.join('\n');
  }
}
