/**
 * ConversationalTaskService - Natural language task creation
 *
 * Features:
 * - Parse natural language into tasks
 * - Extract due dates from text
 * - Infer energy levels
 * - Detect recurring patterns
 * - Support voice input transcriptions
 */

import type {
  Task,
  EnergyLevel,
  RecurrenceRule,
  DayOfWeek,
} from '../types';

// Regex patterns for date/time extraction
const DATE_PATTERNS = {
  today: /\b(today)\b/i,
  tomorrow: /\b(tomorrow)\b/i,
  nextWeek: /\b(next week)\b/i,
  dayOfWeek: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  inDays: /\bin (\d+) days?\b/i,
  inWeeks: /\bin (\d+) weeks?\b/i,
  inMonths: /\bin (\d+) months?\b/i,
  specificDate: /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/,
  time12h: /\bat (\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  time24h: /\bat (\d{1,2}):(\d{2})\b/,
  morning: /\b(morning|am)\b/i,
  afternoon: /\b(afternoon)\b/i,
  evening: /\b(evening|tonight)\b/i,
  endOfDay: /\b(end of day|eod)\b/i,
};

// Patterns for recurring tasks
const RECURRENCE_PATTERNS = {
  daily: /\b(every day|daily)\b/i,
  weekly: /\b(every week|weekly)\b/i,
  monthly: /\b(every month|monthly)\b/i,
  weekdays: /\b(every weekday|weekdays)\b/i,
  weekends: /\b(every weekend|weekends)\b/i,
  everyOther: /\bevery other (day|week|month)\b/i,
  specificDays: /\bevery (monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:(?:,?\s*(?:and\s+)?)(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*\b/i,
};

// Keywords for energy inference
const ENERGY_KEYWORDS = {
  high: ['important', 'urgent', 'complex', 'difficult', 'challenging', 'big', 'major', 'critical', 'deep work'],
  low: ['quick', 'simple', 'easy', 'small', 'minor', 'routine', 'basic', 'straightforward'],
  medium: ['normal', 'regular', 'standard', 'moderate'],
};

export interface ParsedTask {
  title: string;
  originalText: string;
  dueDate?: Date;
  scheduledTime?: string;
  energy: EnergyLevel;
  recurrence?: RecurrenceRule;
  confidence: number;
  extractedInfo: {
    dateText?: string;
    timeText?: string;
    recurrenceText?: string;
    energyKeywords?: string[];
  };
}

export class ConversationalTaskService {
  /**
   * Parse natural language into a structured task
   */
  parseTaskFromText(text: string): ParsedTask {
    const result: ParsedTask = {
      title: text,
      originalText: text,
      energy: 'medium',
      confidence: 0.5,
      extractedInfo: {},
    };

    // Extract date/time
    const dateResult = this.extractDateTime(text);
    if (dateResult) {
      result.dueDate = dateResult.date;
      result.scheduledTime = dateResult.time;
      result.extractedInfo.dateText = dateResult.matchedText;
      result.extractedInfo.timeText = dateResult.timeText;
      result.confidence += 0.1;

      // Remove date/time from title
      result.title = this.removeFromText(result.title, dateResult.matchedText);
      if (dateResult.timeText) {
        result.title = this.removeFromText(result.title, dateResult.timeText);
      }
    }

    // Extract recurrence
    const recurrenceResult = this.extractRecurrence(text);
    if (recurrenceResult) {
      result.recurrence = recurrenceResult.rule;
      result.extractedInfo.recurrenceText = recurrenceResult.matchedText;
      result.confidence += 0.1;

      // Remove recurrence from title
      result.title = this.removeFromText(result.title, recurrenceResult.matchedText);
    }

    // Infer energy level
    const energyResult = this.inferEnergy(text);
    result.energy = energyResult.level;
    result.extractedInfo.energyKeywords = energyResult.keywords;
    if (energyResult.keywords.length > 0) {
      result.confidence += 0.1;
    }

    // Clean up title
    result.title = this.cleanTitle(result.title);

    // Boost confidence based on title quality
    if (result.title.length > 10 && result.title.length < 100) {
      result.confidence += 0.1;
    }

    // Cap confidence at 1
    result.confidence = Math.min(result.confidence, 1);

    return result;
  }

  /**
   * Extract date and time from text
   */
  private extractDateTime(text: string): {
    date: Date;
    time?: string;
    matchedText: string;
    timeText?: string;
  } | null {
    const now = new Date();
    let date: Date | null = null;
    let matchedText = '';
    let timeText: string | undefined;
    let time: string | undefined;

    // Check for "today"
    let match = text.match(DATE_PATTERNS.today);
    if (match) {
      date = new Date(now);
      matchedText = match[0];
    }

    // Check for "tomorrow"
    if (!date) {
      match = text.match(DATE_PATTERNS.tomorrow);
      if (match) {
        date = new Date(now);
        date.setDate(date.getDate() + 1);
        matchedText = match[0];
      }
    }

    // Check for "next week"
    if (!date) {
      match = text.match(DATE_PATTERNS.nextWeek);
      if (match) {
        date = new Date(now);
        date.setDate(date.getDate() + 7);
        matchedText = match[0];
      }
    }

    // Check for day of week
    if (!date) {
      match = text.match(DATE_PATTERNS.dayOfWeek);
      if (match) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = dayNames.indexOf(match[1].toLowerCase());
        date = new Date(now);
        const currentDay = date.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7; // Move to next week if day has passed
        date.setDate(date.getDate() + daysUntil);
        matchedText = match[0];
      }
    }

    // Check for "in X days"
    if (!date) {
      match = text.match(DATE_PATTERNS.inDays);
      if (match) {
        date = new Date(now);
        date.setDate(date.getDate() + parseInt(match[1], 10));
        matchedText = match[0];
      }
    }

    // Check for "in X weeks"
    if (!date) {
      match = text.match(DATE_PATTERNS.inWeeks);
      if (match) {
        date = new Date(now);
        date.setDate(date.getDate() + parseInt(match[1], 10) * 7);
        matchedText = match[0];
      }
    }

    // Check for specific date (MM/DD or MM/DD/YYYY)
    if (!date) {
      match = text.match(DATE_PATTERNS.specificDate);
      if (match) {
        const month = parseInt(match[1], 10) - 1;
        const day = parseInt(match[2], 10);
        const year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10)) : now.getFullYear();
        date = new Date(year, month, day);
        matchedText = match[0];
      }
    }

    // If no date found, check for time-only references
    if (!date) {
      if (DATE_PATTERNS.morning.test(text) || DATE_PATTERNS.afternoon.test(text) ||
          DATE_PATTERNS.evening.test(text) || DATE_PATTERNS.endOfDay.test(text)) {
        date = new Date(now);
      }
    }

    if (!date) return null;

    // Extract time
    let timeMatch = text.match(DATE_PATTERNS.time12h);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const period = timeMatch[3].toLowerCase();

      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      timeText = timeMatch[0];
    }

    if (!time) {
      timeMatch = text.match(DATE_PATTERNS.time24h);
      if (timeMatch) {
        time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
        timeText = timeMatch[0];
      }
    }

    // Check for general time of day
    if (!time) {
      if (DATE_PATTERNS.morning.test(text)) {
        time = '09:00';
        timeText = text.match(DATE_PATTERNS.morning)?.[0];
      } else if (DATE_PATTERNS.afternoon.test(text)) {
        time = '14:00';
        timeText = text.match(DATE_PATTERNS.afternoon)?.[0];
      } else if (DATE_PATTERNS.evening.test(text)) {
        time = '18:00';
        timeText = text.match(DATE_PATTERNS.evening)?.[0];
      } else if (DATE_PATTERNS.endOfDay.test(text)) {
        time = '17:00';
        timeText = text.match(DATE_PATTERNS.endOfDay)?.[0];
      }
    }

    // Apply time to date
    if (time) {
      const [hours, minutes] = time.split(':').map(n => parseInt(n, 10));
      date.setHours(hours, minutes, 0, 0);
    } else {
      // Default to 9 AM
      date.setHours(9, 0, 0, 0);
    }

    return { date, time, matchedText, timeText };
  }

  /**
   * Extract recurrence pattern from text
   */
  private extractRecurrence(text: string): {
    rule: RecurrenceRule;
    matchedText: string;
  } | null {
    // Check for daily
    let match = text.match(RECURRENCE_PATTERNS.daily);
    if (match) {
      return {
        rule: { frequency: 'daily', interval: 1 },
        matchedText: match[0],
      };
    }

    // Check for weekly
    match = text.match(RECURRENCE_PATTERNS.weekly);
    if (match) {
      return {
        rule: { frequency: 'weekly', interval: 1 },
        matchedText: match[0],
      };
    }

    // Check for monthly
    match = text.match(RECURRENCE_PATTERNS.monthly);
    if (match) {
      return {
        rule: { frequency: 'monthly', interval: 1 },
        matchedText: match[0],
      };
    }

    // Check for weekdays
    match = text.match(RECURRENCE_PATTERNS.weekdays);
    if (match) {
      return {
        rule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
        },
        matchedText: match[0],
      };
    }

    // Check for weekends
    match = text.match(RECURRENCE_PATTERNS.weekends);
    if (match) {
      return {
        rule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: ['sat', 'sun'],
        },
        matchedText: match[0],
      };
    }

    // Check for every other
    match = text.match(RECURRENCE_PATTERNS.everyOther);
    if (match) {
      const unit = match[1].toLowerCase();
      return {
        rule: {
          frequency: unit as 'daily' | 'weekly' | 'monthly',
          interval: 2,
        },
        matchedText: match[0],
      };
    }

    // Check for specific days
    match = text.match(RECURRENCE_PATTERNS.specificDays);
    if (match) {
      const dayMap: Record<string, DayOfWeek> = {
        monday: 'mon',
        tuesday: 'tue',
        wednesday: 'wed',
        thursday: 'thu',
        friday: 'fri',
        saturday: 'sat',
        sunday: 'sun',
      };

      const days: DayOfWeek[] = [];
      const daysRegex = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
      let dayMatch;
      while ((dayMatch = daysRegex.exec(match[0])) !== null) {
        const day = dayMap[dayMatch[1].toLowerCase()];
        if (day && !days.includes(day)) {
          days.push(day);
        }
      }

      if (days.length > 0) {
        return {
          rule: {
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: days,
          },
          matchedText: match[0],
        };
      }
    }

    return null;
  }

  /**
   * Infer energy level from text
   */
  private inferEnergy(text: string): {
    level: EnergyLevel;
    keywords: string[];
  } {
    const lowerText = text.toLowerCase();
    const foundKeywords: { level: EnergyLevel; keyword: string }[] = [];

    for (const [level, keywords] of Object.entries(ENERGY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          foundKeywords.push({ level: level as EnergyLevel, keyword });
        }
      }
    }

    if (foundKeywords.length === 0) {
      return { level: 'medium', keywords: [] };
    }

    // Count keywords per level
    const counts: Record<EnergyLevel, number> = { high: 0, medium: 0, low: 0 };
    for (const { level } of foundKeywords) {
      counts[level]++;
    }

    // Return level with most keywords
    let maxLevel: EnergyLevel = 'medium';
    let maxCount = 0;
    for (const [level, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxLevel = level as EnergyLevel;
      }
    }

    return {
      level: maxLevel,
      keywords: foundKeywords
        .filter(f => f.level === maxLevel)
        .map(f => f.keyword),
    };
  }

  /**
   * Remove matched text from input
   */
  private removeFromText(text: string, toRemove: string): string {
    return text.replace(new RegExp(toRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }

  /**
   * Clean up the title
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/^\s*[-–—]\s*/, '') // Remove leading dashes
      .replace(/\s*[-–—]\s*$/, '') // Remove trailing dashes
      .replace(/^(i need to|i have to|i should|i want to|need to|have to|should|want to|gotta|gonna)\s+/i, '') // Remove common prefixes
      .replace(/^(remind me to|remember to|don't forget to)\s+/i, '') // Remove reminder prefixes
      .trim();
  }

  /**
   * Convert parsed task to Task object
   */
  toTask(parsed: ParsedTask): Omit<Task, 'id' | 'createdAt'> {
    return {
      title: parsed.title,
      energy: parsed.energy,
      completed: false,
      isMicroStep: false,
      dueDate: parsed.dueDate?.toISOString(),
      scheduledTime: parsed.scheduledTime,
    };
  }

  /**
   * Get example phrases for help/onboarding
   */
  getExamplePhrases(): string[] {
    return [
      'Call mom tomorrow at 2pm',
      'Finish report by end of day',
      'Quick email check every morning',
      'Important meeting prep for Monday',
      'Review documents next week',
      'Exercise every weekday',
      'Take medicine every day at 9am',
      'Deep work on project in 3 days',
      'Simple task: water plants',
      'Urgent: submit application today',
    ];
  }
}

// Singleton instance
let serviceInstance: ConversationalTaskService | null = null;

export function getConversationalTaskService(): ConversationalTaskService {
  if (!serviceInstance) {
    serviceInstance = new ConversationalTaskService();
  }
  return serviceInstance;
}
