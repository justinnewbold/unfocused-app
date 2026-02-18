/**
 * DataPortabilityService - GDPR-compliant data management
 *
 * Features:
 * - Export all user data
 * - Delete all user data
 * - Data access requests
 * - Audit logging
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const STORAGE_KEY = 'nero_data_portability';

export interface DataCategory {
  id: string;
  name: string;
  description: string;
  storageKey: string;
  sensitivityLevel: 'low' | 'medium' | 'high';
  canDelete: boolean;
}

export interface DataAccessLog {
  id: string;
  action: 'export' | 'delete' | 'access' | 'modify';
  category: string;
  timestamp: string;
  details?: string;
}

export interface ExportManifest {
  exportDate: string;
  appVersion: string;
  dataCategories: string[];
  totalRecords: number;
  format: string;
  anonymized: boolean;
}

// All data categories in the app
const DATA_CATEGORIES: DataCategory[] = [
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'All your tasks and to-dos',
    storageKey: 'nero_tasks',
    sensitivityLevel: 'low',
    canDelete: true,
  },
  {
    id: 'focus_sessions',
    name: 'Focus Sessions',
    description: 'Your focus timer history',
    storageKey: 'nero_focus_sessions',
    sensitivityLevel: 'low',
    canDelete: true,
  },
  {
    id: 'mood_entries',
    name: 'Mood Entries',
    description: 'Your mood tracking history',
    storageKey: 'nero_mood_entries',
    sensitivityLevel: 'medium',
    canDelete: true,
  },
  {
    id: 'energy_logs',
    name: 'Energy Logs',
    description: 'Your energy level history',
    storageKey: 'nero_energy_logs',
    sensitivityLevel: 'low',
    canDelete: true,
  },
  {
    id: 'medications',
    name: 'Medications',
    description: 'Medication tracking data',
    storageKey: 'nero_medications',
    sensitivityLevel: 'high',
    canDelete: true,
  },
  {
    id: 'medication_logs',
    name: 'Medication Logs',
    description: 'Medication dose history',
    storageKey: 'nero_medication_logs',
    sensitivityLevel: 'high',
    canDelete: true,
  },
  {
    id: 'sleep_entries',
    name: 'Sleep Data',
    description: 'Sleep tracking history',
    storageKey: 'nero_sleep_entries',
    sensitivityLevel: 'medium',
    canDelete: true,
  },
  {
    id: 'daily_plans',
    name: 'Daily Plans',
    description: 'Morning planning data',
    storageKey: 'nero_daily_plans',
    sensitivityLevel: 'low',
    canDelete: true,
  },
  {
    id: 'reflections',
    name: 'Daily Reflections',
    description: 'Evening reflection entries',
    storageKey: 'nero_daily_reflections',
    sensitivityLevel: 'medium',
    canDelete: true,
  },
  {
    id: 'patterns',
    name: 'Productivity Patterns',
    description: 'Analyzed productivity patterns',
    storageKey: 'nero_patterns',
    sensitivityLevel: 'low',
    canDelete: true,
  },
  {
    id: 'settings',
    name: 'App Settings',
    description: 'Your preferences and settings',
    storageKey: 'nero_settings',
    sensitivityLevel: 'low',
    canDelete: true,
  },
  {
    id: 'profile',
    name: 'User Profile',
    description: 'Your profile information',
    storageKey: 'nero_profile',
    sensitivityLevel: 'medium',
    canDelete: true,
  },
];

export class DataPortabilityService {
  private accessLogs: DataAccessLog[] = [];

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.accessLogs = parsed.accessLogs || [];
      }
    } catch (error) {
      console.error('Failed to initialize DataPortabilityService:', error);
    }
  }

  // ============ DATA EXPORT ============

  async exportAllData(options?: {
    format?: 'json' | 'readable';
    anonymize?: boolean;
    categories?: string[];
  }): Promise<{
    success: boolean;
    filePath?: string;
    manifest?: ExportManifest;
    error?: string;
  }> {
    try {
      const format = options?.format || 'json';
      const anonymize = options?.anonymize || false;
      const categoriesToExport = options?.categories || DATA_CATEGORIES.map(c => c.id);

      const exportData: Record<string, any> = {};
      let totalRecords = 0;

      // Gather data from each category
      for (const categoryId of categoriesToExport) {
        const category = DATA_CATEGORIES.find(c => c.id === categoryId);
        if (!category) continue;

        try {
          const data = await AsyncStorage.getItem(category.storageKey);
          if (data) {
            let parsed = JSON.parse(data);

            // Anonymize if requested
            if (anonymize) {
              parsed = this.anonymizeData(parsed, category);
            }

            exportData[categoryId] = parsed;
            totalRecords += Array.isArray(parsed) ? parsed.length : 1;

            // Log access
            await this.logAccess('export', categoryId);
          }
        } catch (error) {
          console.warn(`Failed to export ${categoryId}:`, error);
        }
      }

      // Create manifest
      const manifest: ExportManifest = {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0', // Would come from app config
        dataCategories: categoriesToExport,
        totalRecords,
        format,
        anonymized: anonymize,
      };

      // Format output
      let content: string;
      if (format === 'readable') {
        content = this.formatReadableExport(exportData, manifest);
      } else {
        content = JSON.stringify({ manifest, data: exportData }, null, 2);
      }

      // Save to file
      if (Platform.OS !== 'web') {
        const fileName = `unfocused_export_${Date.now()}.${format === 'json' ? 'json' : 'txt'}`;
        const filePath = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(filePath, content);

        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath);
        }

        return { success: true, filePath, manifest };
      } else {
        // Web: Download via blob
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unfocused_export_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        return { success: true, manifest };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  private anonymizeData(data: any, category: DataCategory): any {
    if (Array.isArray(data)) {
      return data.map((item, index) => this.anonymizeItem(item, index));
    }
    return this.anonymizeItem(data, 0);
  }

  private anonymizeItem(item: any, index: number): any {
    if (!item || typeof item !== 'object') return item;

    const anonymized = { ...item };

    // Replace identifying fields
    if (anonymized.name) anonymized.name = `User_${index}`;
    if (anonymized.email) anonymized.email = `user${index}@example.com`;
    if (anonymized.displayName) anonymized.displayName = `User ${index}`;

    // Keep IDs but hash them
    if (anonymized.id) anonymized.id = `anon_${index}`;
    if (anonymized.userId) anonymized.userId = 'anon_user';

    return anonymized;
  }

  private formatReadableExport(data: Record<string, any>, manifest: ExportManifest): string {
    let output = '=== UnFocused Data Export ===\n\n';
    output += `Export Date: ${new Date(manifest.exportDate).toLocaleString()}\n`;
    output += `Total Records: ${manifest.totalRecords}\n`;
    output += `Anonymized: ${manifest.anonymized ? 'Yes' : 'No'}\n`;
    output += '\n---\n\n';

    for (const [categoryId, categoryData] of Object.entries(data)) {
      const category = DATA_CATEGORIES.find(c => c.id === categoryId);
      output += `## ${category?.name || categoryId}\n\n`;

      if (Array.isArray(categoryData)) {
        output += `${categoryData.length} records\n\n`;
        for (const item of categoryData.slice(0, 10)) {
          output += `- ${JSON.stringify(item, null, 2)}\n`;
        }
        if (categoryData.length > 10) {
          output += `\n... and ${categoryData.length - 10} more\n`;
        }
      } else {
        output += JSON.stringify(categoryData, null, 2);
      }

      output += '\n\n---\n\n';
    }

    return output;
  }

  // ============ DATA DELETION ============

  async deleteAllData(options?: {
    categories?: string[];
    confirm?: boolean;
  }): Promise<{
    success: boolean;
    deletedCategories: string[];
    error?: string;
  }> {
    if (!options?.confirm) {
      return {
        success: false,
        deletedCategories: [],
        error: 'Deletion must be confirmed',
      };
    }

    const categoriesToDelete = options?.categories || DATA_CATEGORIES.map(c => c.id);
    const deletedCategories: string[] = [];

    try {
      for (const categoryId of categoriesToDelete) {
        const category = DATA_CATEGORIES.find(c => c.id === categoryId);
        if (!category || !category.canDelete) continue;

        try {
          await AsyncStorage.removeItem(category.storageKey);
          deletedCategories.push(categoryId);

          await this.logAccess('delete', categoryId);
        } catch (error) {
          console.warn(`Failed to delete ${categoryId}:`, error);
        }
      }

      return { success: true, deletedCategories };
    } catch (error: any) {
      return {
        success: false,
        deletedCategories,
        error: error.message,
      };
    }
  }

  async deleteCategory(categoryId: string): Promise<boolean> {
    const category = DATA_CATEGORIES.find(c => c.id === categoryId);
    if (!category || !category.canDelete) return false;

    try {
      await AsyncStorage.removeItem(category.storageKey);
      await this.logAccess('delete', categoryId);
      return true;
    } catch (error) {
      console.error(`Failed to delete ${categoryId}:`, error);
      return false;
    }
  }

  // ============ DATA ACCESS ============

  getDataCategories(): DataCategory[] {
    return [...DATA_CATEGORIES];
  }

  async getDataSummary(): Promise<Array<{
    category: DataCategory;
    recordCount: number;
    lastModified?: string;
    sizeBytes: number;
  }>> {
    const summary: Array<{
      category: DataCategory;
      recordCount: number;
      lastModified?: string;
      sizeBytes: number;
    }> = [];

    for (const category of DATA_CATEGORIES) {
      try {
        const data = await AsyncStorage.getItem(category.storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          const recordCount = Array.isArray(parsed) ? parsed.length : 1;

          // Try to find last modified date
          let lastModified: string | undefined;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const dates = parsed
              .map((item: any) => item.updatedAt || item.createdAt || item.timestamp)
              .filter(Boolean)
              .sort()
              .reverse();
            lastModified = dates[0];
          }

          summary.push({
            category,
            recordCount,
            lastModified,
            sizeBytes: new Blob([data]).size,
          });
        } else {
          summary.push({
            category,
            recordCount: 0,
            sizeBytes: 0,
          });
        }
      } catch (error) {
        summary.push({
          category,
          recordCount: 0,
          sizeBytes: 0,
        });
      }
    }

    return summary;
  }

  async getCategoryData(categoryId: string): Promise<any | null> {
    const category = DATA_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return null;

    try {
      const data = await AsyncStorage.getItem(category.storageKey);
      await this.logAccess('access', categoryId);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      return null;
    }
  }

  // ============ AUDIT LOGGING ============

  private async logAccess(
    action: DataAccessLog['action'],
    category: string,
    details?: string
  ): Promise<void> {
    const log: DataAccessLog = {
      id: `log_${Date.now()}`,
      action,
      category,
      timestamp: new Date().toISOString(),
      details,
    };

    this.accessLogs.push(log);

    // Keep last 1000 logs
    if (this.accessLogs.length > 1000) {
      this.accessLogs = this.accessLogs.slice(-1000);
    }

    await this.saveData();
  }

  getAccessLogs(limit?: number): DataAccessLog[] {
    const sorted = [...this.accessLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async exportAccessLogs(): Promise<string> {
    return JSON.stringify(this.accessLogs, null, 2);
  }

  // ============ DATA RIGHTS INFO ============

  getDataRightsInfo(): {
    rights: Array<{ title: string; description: string }>;
    contact: string;
    retentionPolicy: string;
  } {
    return {
      rights: [
        {
          title: 'Right to Access',
          description: 'You can export all your data at any time.',
        },
        {
          title: 'Right to Rectification',
          description: 'You can edit or correct your data within the app.',
        },
        {
          title: 'Right to Erasure',
          description: 'You can delete all your data at any time.',
        },
        {
          title: 'Right to Data Portability',
          description: 'You can export your data in machine-readable format.',
        },
        {
          title: 'Right to Restrict Processing',
          description: 'You can disable features that process your data.',
        },
      ],
      contact: 'privacy@unfocused.app',
      retentionPolicy: 'Data is stored locally on your device. Cloud-synced data is retained until you delete it.',
    };
  }

  // ============ STORAGE ============

  private async saveData(): Promise<void> {
    try {
      const data = {
        accessLogs: this.accessLogs,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save data portability data:', error);
    }
  }
}

// Singleton instance
let serviceInstance: DataPortabilityService | null = null;

export function getDataPortabilityService(): DataPortabilityService {
  if (!serviceInstance) {
    serviceInstance = new DataPortabilityService();
  }
  return serviceInstance;
}

export async function initializeDataPortabilityService(): Promise<DataPortabilityService> {
  const service = getDataPortabilityService();
  await service.initialize();
  return service;
}
