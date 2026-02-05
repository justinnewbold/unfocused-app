/**
 * TaskImportService - Import tasks from other apps
 *
 * Supports:
 * - Todoist
 * - Notion
 * - Asana
 * - Apple Reminders
 * - Google Tasks
 * - CSV/JSON file import
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task, EnergyLevel } from '../types';

const STORAGE_KEY = 'nero_import_history';

export type ImportSource =
  | 'todoist'
  | 'notion'
  | 'asana'
  | 'apple_reminders'
  | 'google_tasks'
  | 'csv'
  | 'json';

export interface ImportResult {
  id: string;
  source: ImportSource;
  timestamp: string;
  totalItems: number;
  imported: number;
  skipped: number;
  errors: string[];
  tasks: Task[];
}

export interface ImportMapping {
  titleField: string;
  dueDateField?: string;
  priorityField?: string;
  completedField?: string;
  notesField?: string;
  tagsField?: string;
}

// Default field mappings for each service
const DEFAULT_MAPPINGS: Record<ImportSource, ImportMapping> = {
  todoist: {
    titleField: 'content',
    dueDateField: 'due.date',
    priorityField: 'priority',
    completedField: 'is_completed',
    notesField: 'description',
    tagsField: 'labels',
  },
  notion: {
    titleField: 'properties.Name.title[0].plain_text',
    dueDateField: 'properties.Due.date.start',
    priorityField: 'properties.Priority.select.name',
    completedField: 'properties.Status.checkbox',
    notesField: 'properties.Notes.rich_text[0].plain_text',
    tagsField: 'properties.Tags.multi_select',
  },
  asana: {
    titleField: 'name',
    dueDateField: 'due_on',
    priorityField: 'custom_fields',
    completedField: 'completed',
    notesField: 'notes',
    tagsField: 'tags',
  },
  apple_reminders: {
    titleField: 'title',
    dueDateField: 'dueDate',
    priorityField: 'priority',
    completedField: 'isCompleted',
    notesField: 'notes',
  },
  google_tasks: {
    titleField: 'title',
    dueDateField: 'due',
    completedField: 'status',
    notesField: 'notes',
  },
  csv: {
    titleField: 'title',
    dueDateField: 'due_date',
    priorityField: 'priority',
    completedField: 'completed',
    notesField: 'notes',
  },
  json: {
    titleField: 'title',
    dueDateField: 'dueDate',
    priorityField: 'priority',
    completedField: 'completed',
    notesField: 'notes',
  },
};

export class TaskImportService {
  private importHistory: ImportResult[] = [];

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.importHistory = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to initialize TaskImportService:', error);
    }
  }

  // ============ TODOIST IMPORT ============

  async importFromTodoist(apiToken: string): Promise<ImportResult> {
    const result: ImportResult = {
      id: `import_${Date.now()}`,
      source: 'todoist',
      timestamp: new Date().toISOString(),
      totalItems: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      tasks: [],
    };

    try {
      // Fetch active tasks from Todoist API
      const response = await fetch('https://api.todoist.com/rest/v2/tasks', {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Todoist API error: ${response.status}`);
      }

      const todoistTasks = await response.json();
      result.totalItems = todoistTasks.length;

      for (const item of todoistTasks) {
        try {
          const task = this.convertTodoistTask(item);
          result.tasks.push(task);
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import "${item.content}": ${error}`);
          result.skipped++;
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    await this.saveImportResult(result);
    return result;
  }

  private convertTodoistTask(item: any): Task {
    // Map Todoist priority (1-4, where 4 is highest) to energy
    const priorityToEnergy: Record<number, EnergyLevel> = {
      4: 'high',
      3: 'high',
      2: 'medium',
      1: 'low',
    };

    return {
      id: `todoist_${item.id}`,
      title: item.content,
      energy: priorityToEnergy[item.priority] || 'medium',
      completed: item.is_completed || false,
      isMicroStep: false,
      createdAt: item.created_at || new Date().toISOString(),
      dueDate: item.due?.date,
      tags: item.labels,
    };
  }

  // ============ NOTION IMPORT ============

  async importFromNotion(
    apiToken: string,
    databaseId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      id: `import_${Date.now()}`,
      source: 'notion',
      timestamp: new Date().toISOString(),
      totalItems: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      tasks: [],
    };

    try {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error(`Notion API error: ${response.status}`);
      }

      const data = await response.json();
      result.totalItems = data.results.length;

      for (const item of data.results) {
        try {
          const task = this.convertNotionTask(item);
          result.tasks.push(task);
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import Notion item: ${error}`);
          result.skipped++;
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    await this.saveImportResult(result);
    return result;
  }

  private convertNotionTask(item: any): Task {
    const props = item.properties;

    // Try to find title property
    let title = 'Untitled';
    for (const [key, value] of Object.entries(props)) {
      if ((value as any).type === 'title' && (value as any).title?.[0]?.plain_text) {
        title = (value as any).title[0].plain_text;
        break;
      }
    }

    // Try to find due date
    let dueDate: string | undefined;
    for (const [key, value] of Object.entries(props)) {
      if ((value as any).type === 'date' && (value as any).date?.start) {
        dueDate = (value as any).date.start;
        break;
      }
    }

    return {
      id: `notion_${item.id}`,
      title,
      energy: 'medium',
      completed: false,
      isMicroStep: false,
      createdAt: item.created_time,
      dueDate,
    };
  }

  // ============ ASANA IMPORT ============

  async importFromAsana(
    accessToken: string,
    projectId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      id: `import_${Date.now()}`,
      source: 'asana',
      timestamp: new Date().toISOString(),
      totalItems: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      tasks: [],
    };

    try {
      const response = await fetch(
        `https://app.asana.com/api/1.0/projects/${projectId}/tasks?opt_fields=name,due_on,completed,notes`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Asana API error: ${response.status}`);
      }

      const data = await response.json();
      result.totalItems = data.data.length;

      for (const item of data.data) {
        try {
          const task = this.convertAsanaTask(item);
          result.tasks.push(task);
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to import "${item.name}": ${error}`);
          result.skipped++;
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    await this.saveImportResult(result);
    return result;
  }

  private convertAsanaTask(item: any): Task {
    return {
      id: `asana_${item.gid}`,
      title: item.name,
      energy: 'medium',
      completed: item.completed || false,
      isMicroStep: false,
      createdAt: new Date().toISOString(),
      dueDate: item.due_on,
    };
  }

  // ============ CSV IMPORT ============

  async importFromCSV(
    csvContent: string,
    mapping?: Partial<ImportMapping>
  ): Promise<ImportResult> {
    const result: ImportResult = {
      id: `import_${Date.now()}`,
      source: 'csv',
      timestamp: new Date().toISOString(),
      totalItems: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      tasks: [],
    };

    try {
      const finalMapping = { ...DEFAULT_MAPPINGS.csv, ...mapping };
      const lines = csvContent.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV must have at least a header and one data row');
      }

      const headers = this.parseCSVLine(lines[0]);
      result.totalItems = lines.length - 1;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          const row: Record<string, string> = {};

          headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim() || '';
          });

          const task = this.convertCSVRow(row, finalMapping);
          if (task.title) {
            result.tasks.push(task);
            result.imported++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.errors.push(`Row ${i + 1}: ${error}`);
          result.skipped++;
        }
      }
    } catch (error) {
      result.errors.push(`Import failed: ${error}`);
    }

    await this.saveImportResult(result);
    return result;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  }

  private convertCSVRow(row: Record<string, string>, mapping: ImportMapping): Task {
    const getValue = (field: string | undefined): string | undefined => {
      if (!field) return undefined;
      return row[field];
    };

    const title = getValue(mapping.titleField) || '';
    const dueDate = getValue(mapping.dueDateField);
    const completed = getValue(mapping.completedField)?.toLowerCase() === 'true';

    // Try to infer energy from priority
    const priority = getValue(mapping.priorityField)?.toLowerCase();
    let energy: EnergyLevel = 'medium';
    if (priority === 'high' || priority === '1') energy = 'high';
    else if (priority === 'low' || priority === '3') energy = 'low';

    return {
      id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      energy,
      completed,
      isMicroStep: false,
      createdAt: new Date().toISOString(),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
    };
  }

  // ============ JSON IMPORT ============

  async importFromJSON(jsonContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      id: `import_${Date.now()}`,
      source: 'json',
      timestamp: new Date().toISOString(),
      totalItems: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      tasks: [],
    };

    try {
      const data = JSON.parse(jsonContent);
      const items = Array.isArray(data) ? data : data.tasks || data.items || [];
      result.totalItems = items.length;

      for (const item of items) {
        try {
          const task: Task = {
            id: `json_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: item.title || item.name || item.content || 'Untitled',
            energy: item.energy || 'medium',
            completed: item.completed || item.done || false,
            isMicroStep: item.isMicroStep || false,
            createdAt: item.createdAt || new Date().toISOString(),
            dueDate: item.dueDate || item.due,
          };

          if (task.title && task.title !== 'Untitled') {
            result.tasks.push(task);
            result.imported++;
          } else {
            result.skipped++;
          }
        } catch (error) {
          result.errors.push(`Failed to import item: ${error}`);
          result.skipped++;
        }
      }
    } catch (error) {
      result.errors.push(`Invalid JSON: ${error}`);
    }

    await this.saveImportResult(result);
    return result;
  }

  // ============ IMPORT HISTORY ============

  getImportHistory(): ImportResult[] {
    return [...this.importHistory].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async clearImportHistory(): Promise<void> {
    this.importHistory = [];
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // ============ SUPPORTED SOURCES ============

  getSupportedSources(): Array<{
    id: ImportSource;
    name: string;
    description: string;
    requiresAuth: boolean;
    authType?: 'api_key' | 'oauth';
    icon: string;
  }> {
    return [
      {
        id: 'todoist',
        name: 'Todoist',
        description: 'Import tasks from Todoist',
        requiresAuth: true,
        authType: 'api_key',
        icon: '📋',
      },
      {
        id: 'notion',
        name: 'Notion',
        description: 'Import from a Notion database',
        requiresAuth: true,
        authType: 'api_key',
        icon: '📝',
      },
      {
        id: 'asana',
        name: 'Asana',
        description: 'Import tasks from an Asana project',
        requiresAuth: true,
        authType: 'oauth',
        icon: '🎯',
      },
      {
        id: 'csv',
        name: 'CSV File',
        description: 'Import from a CSV spreadsheet',
        requiresAuth: false,
        icon: '📊',
      },
      {
        id: 'json',
        name: 'JSON File',
        description: 'Import from a JSON file',
        requiresAuth: false,
        icon: '📄',
      },
    ];
  }

  // ============ STORAGE ============

  private async saveImportResult(result: ImportResult): Promise<void> {
    this.importHistory.push(result);

    // Keep last 50 imports
    if (this.importHistory.length > 50) {
      this.importHistory = this.importHistory.slice(-50);
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.importHistory));
    } catch (error) {
      console.error('Failed to save import history:', error);
    }
  }
}

// Singleton instance
let serviceInstance: TaskImportService | null = null;

export function getTaskImportService(): TaskImportService {
  if (!serviceInstance) {
    serviceInstance = new TaskImportService();
  }
  return serviceInstance;
}

export async function initializeTaskImportService(): Promise<TaskImportService> {
  const service = getTaskImportService();
  await service.initialize();
  return service;
}
