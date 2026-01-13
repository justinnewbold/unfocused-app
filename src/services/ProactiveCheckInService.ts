import {
  ProactiveCheckIn,
  EnergyLevel,
  MoodLevel,
  CompletionRecord,
  HourlyProductivity,
  UserProfile
} from '../types';
import { genId, PROACTIVE_CHECKIN_MESSAGES } from '../constants';

// ============ PROACTIVE CHECK-IN SERVICE ============
// Intelligently schedules check-ins based on user patterns
export class ProactiveCheckInService {
  private checkInHistory: ProactiveCheckIn[] = [];
  private peakHours: number[] = [9, 10, 11];
  private lowEnergyHours: number[] = [14, 15];
  private lastActivityTime: string = new Date().toISOString();
  private completionHistory: CompletionRecord[] = [];
  private hourlyStats: HourlyProductivity[] = [];

  setCompletionHistory(history: CompletionRecord[]) {
    this.completionHistory = history;
    this.analyzePatterns();
  }

  setHourlyStats(stats: HourlyProductivity[]) {
    this.hourlyStats = stats;
    this.analyzePatterns();
  }

  recordActivity() {
    this.lastActivityTime = new Date().toISOString();
  }

  getCheckInHistory(): ProactiveCheckIn[] {
    return this.checkInHistory;
  }

  setCheckInHistory(history: ProactiveCheckIn[]) {
    this.checkInHistory = history;
  }

  private analyzePatterns() {
    if (this.hourlyStats.length === 0) return;

    // Find peak hours (top 3 by completions)
    const sortedByCompletions = [...this.hourlyStats]
      .filter(h => h.completions > 0)
      .sort((a, b) => b.completions - a.completions);

    this.peakHours = sortedByCompletions.slice(0, 3).map(h => h.hour);

    // Find low energy hours (hours with lowest activity, typically afternoon)
    const workingHours = this.hourlyStats.filter(h => h.hour >= 6 && h.hour <= 22);
    const sortedByLowest = [...workingHours].sort((a, b) => a.completions - b.completions);
    this.lowEnergyHours = sortedByLowest.slice(0, 2).map(h => h.hour);
  }

  shouldCheckIn(
    currentEnergy: EnergyLevel | null,
    currentMood: MoodLevel | null,
    profile: UserProfile
  ): ProactiveCheckIn | null {
    if (!profile.proactiveCheckinsEnabled) return null;

    const now = new Date();
    const currentHour = now.getHours();
    const lastActivityMs = new Date(this.lastActivityTime).getTime();
    const inactivityMinutes = (Date.now() - lastActivityMs) / (1000 * 60);

    // Check for recent check-in to avoid spamming
    const recentCheckIn = this.checkInHistory.find(c => {
      const checkInTime = new Date(c.scheduledTime).getTime();
      return Date.now() - checkInTime < 30 * 60 * 1000; // 30 minutes
    });
    if (recentCheckIn && !recentCheckIn.responded) return null;

    // Priority 1: Long inactivity (>90 minutes during waking hours)
    if (inactivityMinutes > 90 && currentHour >= 8 && currentHour <= 22) {
      return this.createCheckIn('long_inactivity');
    }

    // Priority 2: Peak hour approaching and no recent activity
    if (this.peakHours.includes(currentHour) && inactivityMinutes > 30) {
      return this.createCheckIn('peak_time');
    }

    // Priority 3: Energy dip time (based on patterns)
    if (this.lowEnergyHours.includes(currentHour)) {
      return this.createCheckIn('energy_dip');
    }

    // Priority 4: Low mood detected
    if (currentMood === 'low' && inactivityMinutes > 20) {
      return this.createCheckIn('mood_based');
    }

    // Priority 5: Pattern-based (historically productive time)
    const historicalCompletions = this.completionHistory.filter(c => {
      const completionHour = new Date(c.completedAt).getHours();
      return completionHour === currentHour;
    }).length;

    if (historicalCompletions > 5 && inactivityMinutes > 45) {
      return this.createCheckIn('pattern_based');
    }

    return null;
  }

  private createCheckIn(type: ProactiveCheckIn['type']): ProactiveCheckIn {
    const messages = PROACTIVE_CHECKIN_MESSAGES[type];
    const message = messages[Math.floor(Math.random() * messages.length)];

    const checkIn: ProactiveCheckIn = {
      id: genId(),
      type,
      message,
      scheduledTime: new Date().toISOString(),
      delivered: true,
      responded: false,
    };

    this.checkInHistory.push(checkIn);
    return checkIn;
  }

  respondToCheckIn(checkInId: string, response: string) {
    const checkIn = this.checkInHistory.find(c => c.id === checkInId);
    if (checkIn) {
      checkIn.responded = true;
      checkIn.response = response;
      this.recordActivity();
    }
  }

  getScheduledCheckIns(): { type: string; time: Date; message: string }[] {
    const schedule: { type: string; time: Date; message: string }[] = [];
    const now = new Date();

    // Schedule morning check-in at 9 AM
    if (now.getHours() < 9) {
      const morningTime = new Date(now);
      morningTime.setHours(9, 0, 0, 0);
      schedule.push({
        type: 'scheduled',
        time: morningTime,
        message: PROACTIVE_CHECKIN_MESSAGES.scheduled[0],
      });
    }

    // Schedule afternoon check-in around typical energy dip
    if (now.getHours() < 14) {
      const afternoonTime = new Date(now);
      afternoonTime.setHours(14, 30, 0, 0);
      schedule.push({
        type: 'energy_dip',
        time: afternoonTime,
        message: PROACTIVE_CHECKIN_MESSAGES.energy_dip[0],
      });
    }

    // Schedule peak hour reminder
    for (const peakHour of this.peakHours) {
      if (now.getHours() < peakHour) {
        const peakTime = new Date(now);
        peakTime.setHours(peakHour, 0, 0, 0);
        schedule.push({
          type: 'peak_time',
          time: peakTime,
          message: PROACTIVE_CHECKIN_MESSAGES.peak_time[0],
        });
        break; // Only add next upcoming peak
      }
    }

    return schedule.sort((a, b) => a.time.getTime() - b.time.getTime());
  }

  getCheckInStats(): {
    totalCheckIns: number;
    responseRate: number;
    mostEffectiveType: string;
  } {
    const total = this.checkInHistory.length;
    const responded = this.checkInHistory.filter(c => c.responded).length;

    // Count which check-in types lead to subsequent activity
    const typeEffectiveness: Record<string, { checkins: number; activityAfter: number }> = {};

    this.checkInHistory.forEach((checkIn, index) => {
      if (!typeEffectiveness[checkIn.type]) {
        typeEffectiveness[checkIn.type] = { checkins: 0, activityAfter: 0 };
      }
      typeEffectiveness[checkIn.type].checkins++;

      if (checkIn.responded) {
        typeEffectiveness[checkIn.type].activityAfter++;
      }
    });

    let mostEffectiveType = 'scheduled';
    let highestRate = 0;

    Object.entries(typeEffectiveness).forEach(([type, data]) => {
      const rate = data.checkins > 0 ? data.activityAfter / data.checkins : 0;
      if (rate > highestRate) {
        highestRate = rate;
        mostEffectiveType = type;
      }
    });

    return {
      totalCheckIns: total,
      responseRate: total > 0 ? responded / total : 0,
      mostEffectiveType,
    };
  }
}
