/**
 * DataExportService - Export productivity data
 *
 * Features:
 * - Export to JSON, CSV, PDF
 * - Date range selection
 * - Include/exclude data types
 * - Anonymization option
 * - Share with therapist/coach
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type {
  ExportFormat,
  ExportDataType,
  ExportOptions,
  ExportResult,
  Task,
} from '../types';

const STORAGE_KEYS = {
  EXPORT_HISTORY: 'nero_export_history',
};

export class DataExportService {
  private exportHistory: ExportResult[] = [];

  async initialize(): Promise<void> {
    try {
      const historyJson = await AsyncStorage.getItem(STORAGE_KEYS.EXPORT_HISTORY);
      if (historyJson) {
        this.exportHistory = JSON.parse(historyJson);
      }
    } catch (error) {
      console.error('Failed to initialize DataExportService:', error);
    }
  }

  // ============ EXPORT FUNCTIONS ============

  async exportData(options: ExportOptions): Promise<ExportResult | null> {
    try {
      // Gather data based on options
      const data = await this.gatherData(options);

      // Format data based on export format
      let content: string;
      let filename: string;
      let mimeType: string;

      switch (options.format) {
        case 'json':
          content = this.formatAsJSON(data, options);
          filename = `unfocused-export-${this.getDateString()}.json`;
          mimeType = 'application/json';
          break;

        case 'csv':
          content = this.formatAsCSV(data, options);
          filename = `unfocused-export-${this.getDateString()}.csv`;
          mimeType = 'text/csv';
          break;

        case 'pdf':
          // For PDF, we'll generate HTML and note that a proper PDF library would be needed
          content = this.formatAsHTML(data, options);
          filename = `unfocused-export-${this.getDateString()}.html`;
          mimeType = 'text/html';
          break;

        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }

      // Write file
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, content);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(filePath);

      const result: ExportResult = {
        id: `export_${Date.now()}`,
        format: options.format,
        dataTypes: options.dataTypes,
        createdAt: new Date().toISOString(),
        fileSize: (fileInfo as any).size || content.length,
        downloadUrl: filePath,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      this.exportHistory.push(result);
      await this.saveHistory();

      return result;
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  async shareExport(exportId: string): Promise<boolean> {
    const exportResult = this.exportHistory.find(e => e.id === exportId);
    if (!exportResult || !exportResult.downloadUrl) return false;

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        console.log('Sharing is not available on this platform');
        return false;
      }

      await Sharing.shareAsync(exportResult.downloadUrl);
      return true;
    } catch (error) {
      console.error('Failed to share export:', error);
      return false;
    }
  }

  // ============ DATA GATHERING ============

  private async gatherData(options: ExportOptions): Promise<Record<string, any>> {
    const data: Record<string, any> = {
      exportInfo: {
        generatedAt: new Date().toISOString(),
        dateRange: options.dateRange,
        dataTypes: options.dataTypes,
        anonymized: options.anonymize,
      },
    };

    const startDate = new Date(options.dateRange.start);
    const endDate = new Date(options.dateRange.end);

    // Load data from AsyncStorage
    if (options.dataTypes.includes('tasks') || options.dataTypes.includes('all')) {
      const tasks = await this.loadTasks(startDate, endDate);
      data.tasks = options.anonymize ? this.anonymizeTasks(tasks) : tasks;
    }

    if (options.dataTypes.includes('focus_sessions') || options.dataTypes.includes('all')) {
      data.focusSessions = await this.loadFocusSessions(startDate, endDate);
    }

    if (options.dataTypes.includes('mood') || options.dataTypes.includes('all')) {
      data.moodEntries = await this.loadMoodEntries(startDate, endDate);
    }

    if (options.dataTypes.includes('energy') || options.dataTypes.includes('all')) {
      data.energyLogs = await this.loadEnergyLogs(startDate, endDate);
    }

    if (options.dataTypes.includes('patterns') || options.dataTypes.includes('all')) {
      data.patterns = await this.loadPatterns();
    }

    if (options.includeAnalytics) {
      data.analytics = this.generateAnalytics(data);
    }

    return data;
  }

  private async loadTasks(startDate: Date, endDate: Date): Promise<Task[]> {
    // In a real app, this would load from proper storage
    const tasksJson = await AsyncStorage.getItem('nero_tasks');
    if (!tasksJson) return [];

    const tasks: Task[] = JSON.parse(tasksJson);
    return tasks.filter(t => {
      const taskDate = new Date(t.createdAt);
      return taskDate >= startDate && taskDate <= endDate;
    });
  }

  private async loadFocusSessions(startDate: Date, endDate: Date): Promise<any[]> {
    const sessionsJson = await AsyncStorage.getItem('nero_focus_sessions');
    if (!sessionsJson) return [];

    const sessions = JSON.parse(sessionsJson);
    return sessions.filter((s: any) => {
      const sessionDate = new Date(s.startTime);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  private async loadMoodEntries(startDate: Date, endDate: Date): Promise<any[]> {
    const moodJson = await AsyncStorage.getItem('nero_mood_entries');
    if (!moodJson) return [];

    const entries = JSON.parse(moodJson);
    return entries.filter((e: any) => {
      const entryDate = new Date(e.timestamp);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  private async loadEnergyLogs(startDate: Date, endDate: Date): Promise<any[]> {
    const energyJson = await AsyncStorage.getItem('nero_energy_logs');
    if (!energyJson) return [];

    const logs = JSON.parse(energyJson);
    return logs.filter((l: any) => {
      const logDate = new Date(l.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  private async loadPatterns(): Promise<any> {
    const patternsJson = await AsyncStorage.getItem('nero_patterns');
    return patternsJson ? JSON.parse(patternsJson) : {};
  }

  private anonymizeTasks(tasks: Task[]): Task[] {
    return tasks.map(task => ({
      ...task,
      title: `Task ${task.id.slice(-4)}`, // Replace title with generic
      id: this.hashString(task.id),
    }));
  }

  private hashString(str: string): string {
    // Simple hash for anonymization
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `anon_${Math.abs(hash)}`;
  }

  // ============ FORMATTING ============

  private formatAsJSON(data: Record<string, any>, options: ExportOptions): string {
    return JSON.stringify(data, null, 2);
  }

  private formatAsCSV(data: Record<string, any>, options: ExportOptions): string {
    const lines: string[] = [];

    // Tasks
    if (data.tasks && data.tasks.length > 0) {
      lines.push('=== TASKS ===');
      lines.push('ID,Title,Energy,Completed,Created At,Completed At');
      for (const task of data.tasks) {
        lines.push([
          task.id,
          `"${task.title.replace(/"/g, '""')}"`,
          task.energy,
          task.completed,
          task.createdAt,
          task.completedAt || '',
        ].join(','));
      }
      lines.push('');
    }

    // Focus Sessions
    if (data.focusSessions && data.focusSessions.length > 0) {
      lines.push('=== FOCUS SESSIONS ===');
      lines.push('ID,Start Time,End Time,Duration (min),Status');
      for (const session of data.focusSessions) {
        lines.push([
          session.id,
          session.startTime,
          session.endTime || '',
          Math.round(session.duration / 60),
          session.status,
        ].join(','));
      }
      lines.push('');
    }

    // Mood Entries
    if (data.moodEntries && data.moodEntries.length > 0) {
      lines.push('=== MOOD ENTRIES ===');
      lines.push('ID,Mood,Energy,Timestamp,Context');
      for (const entry of data.moodEntries) {
        lines.push([
          entry.id,
          entry.mood,
          entry.energy || '',
          entry.timestamp,
          entry.context || '',
        ].join(','));
      }
      lines.push('');
    }

    // Energy Logs
    if (data.energyLogs && data.energyLogs.length > 0) {
      lines.push('=== ENERGY LOGS ===');
      lines.push('ID,Level,Mood,Timestamp');
      for (const log of data.energyLogs) {
        lines.push([
          log.id,
          log.level,
          log.mood || '',
          log.timestamp,
        ].join(','));
      }
    }

    return lines.join('\n');
  }

  private formatAsHTML(data: Record<string, any>, options: ExportOptions): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>UnFocused Export - ${this.getDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
    h1 { color: #6C5CE7; }
    h2 { color: #252542; border-bottom: 2px solid #6C5CE7; padding-bottom: 8px; margin-top: 32px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .stat { background: #f0f0ff; padding: 12px; border-radius: 8px; margin: 8px 0; }
    .stat-value { font-size: 24px; font-weight: bold; color: #6C5CE7; }
  </style>
</head>
<body>
  <h1>🎯 UnFocused Export</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <p>Date Range: ${options.dateRange.start} to ${options.dateRange.end}</p>
`;

    // Summary Stats
    if (data.analytics) {
      html += `
  <h2>📊 Summary</h2>
  <div class="stat">
    <div class="stat-value">${data.analytics.totalTasks}</div>
    <div>Total Tasks</div>
  </div>
  <div class="stat">
    <div class="stat-value">${data.analytics.completedTasks}</div>
    <div>Completed Tasks</div>
  </div>
  <div class="stat">
    <div class="stat-value">${data.analytics.totalFocusMinutes}</div>
    <div>Total Focus Minutes</div>
  </div>
`;
    }

    // Tasks Table
    if (data.tasks && data.tasks.length > 0) {
      html += `
  <h2>✅ Tasks</h2>
  <table>
    <tr><th>Title</th><th>Energy</th><th>Completed</th><th>Date</th></tr>
`;
      for (const task of data.tasks.slice(0, 50)) {
        html += `    <tr>
      <td>${this.escapeHtml(task.title)}</td>
      <td>${task.energy}</td>
      <td>${task.completed ? '✓' : '-'}</td>
      <td>${new Date(task.createdAt).toLocaleDateString()}</td>
    </tr>\n`;
      }
      html += `  </table>\n`;

      if (data.tasks.length > 50) {
        html += `  <p><em>Showing 50 of ${data.tasks.length} tasks</em></p>\n`;
      }
    }

    html += `
</body>
</html>`;

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============ ANALYTICS ============

  private generateAnalytics(data: Record<string, any>): Record<string, any> {
    const analytics: Record<string, any> = {};

    if (data.tasks) {
      analytics.totalTasks = data.tasks.length;
      analytics.completedTasks = data.tasks.filter((t: Task) => t.completed).length;
      analytics.completionRate = analytics.totalTasks > 0
        ? Math.round((analytics.completedTasks / analytics.totalTasks) * 100)
        : 0;

      // Tasks by energy
      analytics.tasksByEnergy = {
        high: data.tasks.filter((t: Task) => t.energy === 'high').length,
        medium: data.tasks.filter((t: Task) => t.energy === 'medium').length,
        low: data.tasks.filter((t: Task) => t.energy === 'low').length,
      };
    }

    if (data.focusSessions) {
      analytics.totalSessions = data.focusSessions.length;
      analytics.totalFocusMinutes = Math.round(
        data.focusSessions.reduce((sum: number, s: any) => sum + (s.duration || 0), 0) / 60
      );
      analytics.avgSessionMinutes = analytics.totalSessions > 0
        ? Math.round(analytics.totalFocusMinutes / analytics.totalSessions)
        : 0;
    }

    if (data.moodEntries) {
      const moodValues: Record<string, number> = { low: 1, neutral: 2, high: 3 };
      const avgMood = data.moodEntries.reduce(
        (sum: number, e: any) => sum + (moodValues[e.mood] || 2),
        0
      ) / (data.moodEntries.length || 1);
      analytics.avgMood = Math.round(avgMood * 100) / 100;
      analytics.totalMoodEntries = data.moodEntries.length;
    }

    return analytics;
  }

  // ============ EXPORT HISTORY ============

  getExportHistory(): ExportResult[] {
    return [...this.exportHistory].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async deleteExport(exportId: string): Promise<boolean> {
    const exportResult = this.exportHistory.find(e => e.id === exportId);
    if (!exportResult) return false;

    // Delete file if exists
    if (exportResult.downloadUrl) {
      try {
        await FileSystem.deleteAsync(exportResult.downloadUrl, { idempotent: true });
      } catch (error) {
        console.warn('Failed to delete export file:', error);
      }
    }

    this.exportHistory = this.exportHistory.filter(e => e.id !== exportId);
    await this.saveHistory();
    return true;
  }

  // ============ HELPERS ============

  private getDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  }

  getSupportedFormats(): ExportFormat[] {
    return ['json', 'csv', 'pdf'];
  }

  getSupportedDataTypes(): ExportDataType[] {
    return ['tasks', 'focus_sessions', 'mood', 'energy', 'patterns', 'all'];
  }

  // ============ STORAGE ============

  private async saveHistory(): Promise<void> {
    try {
      // Keep last 20 exports
      const toSave = this.exportHistory.slice(-20);
      await AsyncStorage.setItem(STORAGE_KEYS.EXPORT_HISTORY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save export history:', error);
    }
  }
}

// Singleton instance
let serviceInstance: DataExportService | null = null;

export function getDataExportService(): DataExportService {
  if (!serviceInstance) {
    serviceInstance = new DataExportService();
  }
  return serviceInstance;
}

export async function initializeDataExportService(): Promise<DataExportService> {
  const service = getDataExportService();
  await service.initialize();
  return service;
}
