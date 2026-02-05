/**
 * MedicationService - Track ADHD medication and correlations
 *
 * Features:
 * - Track medication schedule
 * - Log doses taken/skipped
 * - Correlate with focus and energy
 * - Reminders for medication times
 * - Side effect tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Medication,
  MedicationLog,
  MedicationCorrelation,
} from '../types';

const STORAGE_KEYS = {
  MEDICATIONS: 'nero_medications',
  LOGS: 'nero_medication_logs',
  CORRELATIONS: 'nero_medication_correlations',
};

export class MedicationService {
  private medications: Medication[] = [];
  private logs: MedicationLog[] = [];
  private correlations: MedicationCorrelation[] = [];

  async initialize(): Promise<void> {
    try {
      const [medsJson, logsJson, corrJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.MEDICATIONS),
        AsyncStorage.getItem(STORAGE_KEYS.LOGS),
        AsyncStorage.getItem(STORAGE_KEYS.CORRELATIONS),
      ]);

      if (medsJson) this.medications = JSON.parse(medsJson);
      if (logsJson) this.logs = JSON.parse(logsJson);
      if (corrJson) this.correlations = JSON.parse(corrJson);
    } catch (error) {
      console.error('Failed to initialize MedicationService:', error);
    }
  }

  // ============ MEDICATION MANAGEMENT ============

  getMedications(): Medication[] {
    return this.medications.filter(m => m.active);
  }

  getAllMedications(): Medication[] {
    return [...this.medications];
  }

  getMedication(medicationId: string): Medication | null {
    return this.medications.find(m => m.id === medicationId) || null;
  }

  async addMedication(
    name: string,
    dosage: string,
    frequency: Medication['frequency'],
    scheduledTimes: string[],
    notes?: string
  ): Promise<Medication> {
    const medication: Medication = {
      id: `med_${Date.now()}`,
      name,
      dosage,
      frequency,
      scheduledTimes,
      notes,
      active: true,
      startDate: new Date().toISOString(),
    };

    this.medications.push(medication);
    await this.saveMedications();
    return medication;
  }

  async updateMedication(
    medicationId: string,
    updates: Partial<Medication>
  ): Promise<Medication | null> {
    const medication = this.medications.find(m => m.id === medicationId);
    if (!medication) return null;

    Object.assign(medication, updates);
    await this.saveMedications();
    return medication;
  }

  async deactivateMedication(medicationId: string): Promise<boolean> {
    const medication = this.medications.find(m => m.id === medicationId);
    if (!medication) return false;

    medication.active = false;
    medication.endDate = new Date().toISOString();
    await this.saveMedications();
    return true;
  }

  async deleteMedication(medicationId: string): Promise<boolean> {
    const initialLength = this.medications.length;
    this.medications = this.medications.filter(m => m.id !== medicationId);

    if (this.medications.length !== initialLength) {
      await this.saveMedications();
      return true;
    }
    return false;
  }

  // ============ LOGGING ============

  async logDose(
    medicationId: string,
    scheduledTime: string,
    options?: {
      takenAt?: string;
      skipped?: boolean;
      notes?: string;
      sideEffects?: string[];
      effectivenessRating?: number;
    }
  ): Promise<MedicationLog> {
    const log: MedicationLog = {
      id: `log_${Date.now()}`,
      medicationId,
      scheduledTime,
      takenAt: options?.skipped ? undefined : (options?.takenAt || new Date().toISOString()),
      skipped: options?.skipped || false,
      notes: options?.notes,
      sideEffects: options?.sideEffects,
      effectivenessRating: options?.effectivenessRating,
    };

    this.logs.push(log);
    await this.saveLogs();
    return log;
  }

  async markTaken(
    medicationId: string,
    scheduledTime: string,
    effectivenessRating?: number
  ): Promise<MedicationLog> {
    return this.logDose(medicationId, scheduledTime, {
      effectivenessRating,
    });
  }

  async markSkipped(
    medicationId: string,
    scheduledTime: string,
    reason?: string
  ): Promise<MedicationLog> {
    return this.logDose(medicationId, scheduledTime, {
      skipped: true,
      notes: reason,
    });
  }

  async logSideEffects(
    logId: string,
    sideEffects: string[]
  ): Promise<MedicationLog | null> {
    const log = this.logs.find(l => l.id === logId);
    if (!log) return null;

    log.sideEffects = sideEffects;
    await this.saveLogs();
    return log;
  }

  getLogsForDate(date: Date): MedicationLog[] {
    const dateString = date.toISOString().split('T')[0];
    return this.logs.filter(l => {
      const logDate = new Date(l.scheduledTime).toISOString().split('T')[0];
      return logDate === dateString;
    });
  }

  getLogsForMedication(medicationId: string, limit?: number): MedicationLog[] {
    const logs = this.logs
      .filter(l => l.medicationId === medicationId)
      .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());

    return limit ? logs.slice(0, limit) : logs;
  }

  // ============ SCHEDULED DOSES ============

  getTodaysDoses(): Array<{
    medication: Medication;
    scheduledTime: string;
    logged: boolean;
    log?: MedicationLog;
  }> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todaysLogs = this.getLogsForDate(today);

    const doses: Array<{
      medication: Medication;
      scheduledTime: string;
      logged: boolean;
      log?: MedicationLog;
    }> = [];

    for (const medication of this.getMedications()) {
      for (const time of medication.scheduledTimes) {
        const scheduledTime = `${todayStr}T${time}:00.000Z`;
        const log = todaysLogs.find(
          l => l.medicationId === medication.id && l.scheduledTime === scheduledTime
        );

        doses.push({
          medication,
          scheduledTime,
          logged: !!log,
          log,
        });
      }
    }

    // Sort by scheduled time
    doses.sort((a, b) =>
      new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    );

    return doses;
  }

  getUpcomingDoses(withinMinutes: number = 60): Array<{
    medication: Medication;
    scheduledTime: string;
    minutesUntil: number;
  }> {
    const now = new Date();
    const todaysDoses = this.getTodaysDoses();

    return todaysDoses
      .filter(dose => {
        if (dose.logged) return false;
        const scheduled = new Date(dose.scheduledTime);
        const diff = (scheduled.getTime() - now.getTime()) / (1000 * 60);
        return diff > -15 && diff <= withinMinutes; // 15 min grace period for past doses
      })
      .map(dose => ({
        medication: dose.medication,
        scheduledTime: dose.scheduledTime,
        minutesUntil: Math.round(
          (new Date(dose.scheduledTime).getTime() - now.getTime()) / (1000 * 60)
        ),
      }));
  }

  // ============ CORRELATIONS ============

  async analyzeCorrelations(
    focusData: Array<{ date: string; avgScore: number }>,
    energyData: Array<{ date: string; avgLevel: number }>,
    moodData: Array<{ date: string; avgMood: number }>,
    taskData: Array<{ date: string; completed: number }>
  ): Promise<void> {
    const correlations: MedicationCorrelation[] = [];

    for (const medication of this.getMedications()) {
      const medLogs = this.getLogsForMedication(medication.id);

      // Group by date
      const logsByDate = new Map<string, MedicationLog[]>();
      for (const log of medLogs) {
        const date = new Date(log.scheduledTime).toISOString().split('T')[0];
        if (!logsByDate.has(date)) {
          logsByDate.set(date, []);
        }
        logsByDate.get(date)!.push(log);
      }

      // Calculate averages for days with medication vs without
      let focusWithMed = 0, focusWithoutMed = 0;
      let energyWithMed = 0, energyWithoutMed = 0;
      let moodWithMed = 0, moodWithoutMed = 0;
      let tasksWithMed = 0, tasksWithoutMed = 0;
      let daysWithMed = 0, daysWithoutMed = 0;

      for (const focusDay of focusData) {
        const logs = logsByDate.get(focusDay.date) || [];
        const tookMed = logs.some(l => !l.skipped);

        const energy = energyData.find(e => e.date === focusDay.date)?.avgLevel || 0;
        const mood = moodData.find(m => m.date === focusDay.date)?.avgMood || 0;
        const tasks = taskData.find(t => t.date === focusDay.date)?.completed || 0;

        if (tookMed) {
          focusWithMed += focusDay.avgScore;
          energyWithMed += energy;
          moodWithMed += mood;
          tasksWithMed += tasks;
          daysWithMed++;
        } else {
          focusWithoutMed += focusDay.avgScore;
          energyWithoutMed += energy;
          moodWithoutMed += mood;
          tasksWithoutMed += tasks;
          daysWithoutMed++;
        }
      }

      if (daysWithMed > 0 && daysWithoutMed > 0) {
        correlations.push({
          medicationId: medication.id,
          focusScoreAvg: focusWithMed / daysWithMed,
          energyLevelAvg: energyWithMed / daysWithMed,
          moodAvg: moodWithMed / daysWithMed,
          tasksCompletedAvg: tasksWithMed / daysWithMed,
          sampleDays: daysWithMed,
        });
      }
    }

    this.correlations = correlations;
    await this.saveCorrelations();
  }

  getCorrelation(medicationId: string): MedicationCorrelation | null {
    return this.correlations.find(c => c.medicationId === medicationId) || null;
  }

  getCorrelations(): MedicationCorrelation[] {
    return [...this.correlations];
  }

  // ============ STATISTICS ============

  getStatistics(medicationId: string): {
    totalDoses: number;
    takenDoses: number;
    skippedDoses: number;
    adherenceRate: number;
    avgEffectiveness: number | null;
    commonSideEffects: string[];
  } {
    const logs = this.getLogsForMedication(medicationId);

    const takenDoses = logs.filter(l => !l.skipped).length;
    const skippedDoses = logs.filter(l => l.skipped).length;
    const totalDoses = logs.length;

    const adherenceRate = totalDoses > 0
      ? Math.round((takenDoses / totalDoses) * 100)
      : 0;

    const effectivenessRatings = logs
      .filter(l => l.effectivenessRating !== undefined)
      .map(l => l.effectivenessRating!);

    const avgEffectiveness = effectivenessRatings.length > 0
      ? effectivenessRatings.reduce((a, b) => a + b, 0) / effectivenessRatings.length
      : null;

    // Count side effects
    const sideEffectCounts = new Map<string, number>();
    for (const log of logs) {
      if (log.sideEffects) {
        for (const effect of log.sideEffects) {
          sideEffectCounts.set(effect, (sideEffectCounts.get(effect) || 0) + 1);
        }
      }
    }

    const commonSideEffects = Array.from(sideEffectCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([effect]) => effect);

    return {
      totalDoses,
      takenDoses,
      skippedDoses,
      adherenceRate,
      avgEffectiveness: avgEffectiveness ? Math.round(avgEffectiveness * 10) / 10 : null,
      commonSideEffects,
    };
  }

  getInsights(): string[] {
    const insights: string[] = [];

    for (const medication of this.getMedications()) {
      const stats = this.getStatistics(medication.id);

      if (stats.adherenceRate >= 90) {
        insights.push(`💊 Great ${medication.name} adherence: ${stats.adherenceRate}%`);
      } else if (stats.adherenceRate < 70 && stats.totalDoses >= 7) {
        insights.push(`⚠️ ${medication.name} adherence is ${stats.adherenceRate}%`);
      }

      const correlation = this.getCorrelation(medication.id);
      if (correlation && correlation.sampleDays >= 7) {
        if (correlation.focusScoreAvg > 7) {
          insights.push(`📈 ${medication.name} correlates with better focus`);
        }
      }

      if (stats.avgEffectiveness !== null) {
        if (stats.avgEffectiveness >= 4) {
          insights.push(`✨ ${medication.name} effectiveness rated ${stats.avgEffectiveness}/5`);
        } else if (stats.avgEffectiveness < 3 && stats.totalDoses >= 10) {
          insights.push(`💭 Consider discussing ${medication.name} effectiveness with your doctor`);
        }
      }
    }

    if (insights.length === 0) {
      insights.push('💊 Track medication to see insights over time');
    }

    return insights;
  }

  // ============ COMMON SIDE EFFECTS LIST ============

  getCommonSideEffectOptions(): string[] {
    return [
      'Decreased appetite',
      'Difficulty sleeping',
      'Dry mouth',
      'Headache',
      'Increased heart rate',
      'Irritability',
      'Jitteriness',
      'Nausea',
      'Stomach ache',
      'Mood changes',
      'Fatigue (crash)',
      'Dizziness',
      'Sweating',
      'Other',
    ];
  }

  // ============ STORAGE ============

  private async saveMedications(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(this.medications));
    } catch (error) {
      console.error('Failed to save medications:', error);
    }
  }

  private async saveLogs(): Promise<void> {
    try {
      // Keep last 365 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 365);

      const toSave = this.logs.filter(l =>
        new Date(l.scheduledTime) >= cutoff
      );

      await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save medication logs:', error);
    }
  }

  private async saveCorrelations(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CORRELATIONS, JSON.stringify(this.correlations));
    } catch (error) {
      console.error('Failed to save correlations:', error);
    }
  }
}

// Singleton instance
let serviceInstance: MedicationService | null = null;

export function getMedicationService(): MedicationService {
  if (!serviceInstance) {
    serviceInstance = new MedicationService();
  }
  return serviceInstance;
}

export async function initializeMedicationService(): Promise<MedicationService> {
  const service = getMedicationService();
  await service.initialize();
  return service;
}
