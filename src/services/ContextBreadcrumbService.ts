/**
 * ContextBreadcrumbService - Track where you were when interrupted
 * 
 * For ADHD brains that lose context when switching tasks.
 * "Where was I? What was I doing? Why did I come into this room?"
 * 
 * Features:
 * - Auto-track task switches and interruptions
 * - Visual breadcrumb trail
 * - Quick context restoration
 * - Spawn catching (when you start something new mid-task)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type BreadcrumbType = 
  | 'task_start'      // Started working on a task
  | 'task_complete'   // Finished a task
  | 'task_pause'      // Paused/switched away
  | 'interruption'    // Got interrupted (phone, notification, etc.)
  | 'spawn'           // Started a new task while doing another
  | 'thought'         // Captured a thought
  | 'energy_change'   // Energy level changed
  | 'context_save'    // Manually saved context
  | 'app_background'  // App went to background
  | 'app_foreground'; // App came back to foreground

export interface Breadcrumb {
  id: string;
  type: BreadcrumbType;
  label: string;
  description?: string;
  taskId?: string;
  taskTitle?: string;
  parentTaskId?: string; // For spawn tracking
  energy?: 'low' | 'medium' | 'high';
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface BreadcrumbTrail {
  id: string;
  name: string;
  breadcrumbs: Breadcrumb[];
  createdAt: string;
  lastUpdated: string;
  isActive: boolean;
}

export interface ContextSnapshot {
  id: string;
  label: string;
  description?: string;
  activeTaskId?: string;
  activeTaskTitle?: string;
  breadcrumbTrailId: string;
  breadcrumbCount: number;
  energy?: 'low' | 'medium' | 'high';
  savedAt: string;
  restoredAt?: string;
}

const STORAGE_KEYS = {
  TRAILS: 'nero_breadcrumb_trails',
  ACTIVE_TRAIL: 'nero_active_trail_id',
  SNAPSHOTS: 'nero_context_snapshots',
  SETTINGS: 'nero_breadcrumb_settings',
};

const MAX_BREADCRUMBS_PER_TRAIL = 50;
const MAX_TRAILS = 10;
const MAX_SNAPSHOTS = 20;

export class ContextBreadcrumbService {
  private trails: BreadcrumbTrail[] = [];
  private activeTrailId: string | null = null;
  private snapshots: ContextSnapshot[] = [];
  private listeners: Set<(trail: BreadcrumbTrail | null) => void> = new Set();

  async initialize(): Promise<void> {
    try {
      const [trailsJson, activeId, snapshotsJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.TRAILS),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TRAIL),
        AsyncStorage.getItem(STORAGE_KEYS.SNAPSHOTS),
      ]);

      this.trails = trailsJson ? JSON.parse(trailsJson) : [];
      this.activeTrailId = activeId;
      this.snapshots = snapshotsJson ? JSON.parse(snapshotsJson) : [];

      // Create a new trail for today if none active
      if (!this.activeTrailId || !this.getActiveTrail()) {
        await this.startNewTrail();
      }
    } catch (error) {
      console.error('Failed to initialize breadcrumb service:', error);
      await this.startNewTrail();
    }
  }

  private async save(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.TRAILS, JSON.stringify(this.trails)),
        AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TRAIL, this.activeTrailId || ''),
        AsyncStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(this.snapshots)),
      ]);
    } catch (error) {
      console.error('Failed to save breadcrumb data:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(): void {
    const activeTrail = this.getActiveTrail();
    this.listeners.forEach(listener => listener(activeTrail));
  }

  subscribe(listener: (trail: BreadcrumbTrail | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ============ TRAIL MANAGEMENT ============

  async startNewTrail(name?: string): Promise<BreadcrumbTrail> {
    const now = new Date();
    const defaultName = `${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
    
    const trail: BreadcrumbTrail = {
      id: this.generateId(),
      name: name || defaultName,
      breadcrumbs: [],
      createdAt: now.toISOString(),
      lastUpdated: now.toISOString(),
      isActive: true,
    };

    // Deactivate old trails
    this.trails = this.trails.map(t => ({ ...t, isActive: false }));
    
    // Add new trail
    this.trails.unshift(trail);
    this.activeTrailId = trail.id;

    // Trim old trails
    if (this.trails.length > MAX_TRAILS) {
      this.trails = this.trails.slice(0, MAX_TRAILS);
    }

    await this.save();
    this.notifyListeners();
    return trail;
  }

  getActiveTrail(): BreadcrumbTrail | null {
    return this.trails.find(t => t.id === this.activeTrailId) || null;
  }

  getAllTrails(): BreadcrumbTrail[] {
    return this.trails;
  }

  // ============ BREADCRUMB OPERATIONS ============

  async addBreadcrumb(
    type: BreadcrumbType,
    label: string,
    options?: {
      description?: string;
      taskId?: string;
      taskTitle?: string;
      parentTaskId?: string;
      energy?: 'low' | 'medium' | 'high';
      metadata?: Record<string, any>;
    }
  ): Promise<Breadcrumb | null> {
    const trail = this.getActiveTrail();
    if (!trail) {
      await this.startNewTrail();
      return this.addBreadcrumb(type, label, options);
    }

    const breadcrumb: Breadcrumb = {
      id: this.generateId(),
      type,
      label,
      description: options?.description,
      taskId: options?.taskId,
      taskTitle: options?.taskTitle,
      parentTaskId: options?.parentTaskId,
      energy: options?.energy,
      timestamp: new Date().toISOString(),
      metadata: options?.metadata,
    };

    trail.breadcrumbs.push(breadcrumb);
    trail.lastUpdated = breadcrumb.timestamp;

    // Trim old breadcrumbs
    if (trail.breadcrumbs.length > MAX_BREADCRUMBS_PER_TRAIL) {
      trail.breadcrumbs = trail.breadcrumbs.slice(-MAX_BREADCRUMBS_PER_TRAIL);
    }

    await this.save();
    this.notifyListeners();
    return breadcrumb;
  }

  // Convenience methods for common breadcrumb types
  async trackTaskStart(taskId: string, taskTitle: string, energy?: 'low' | 'medium' | 'high'): Promise<Breadcrumb | null> {
    return this.addBreadcrumb('task_start', `Started: ${taskTitle}`, {
      taskId,
      taskTitle,
      energy,
    });
  }

  async trackTaskComplete(taskId: string, taskTitle: string): Promise<Breadcrumb | null> {
    return this.addBreadcrumb('task_complete', `Completed: ${taskTitle}`, {
      taskId,
      taskTitle,
    });
  }

  async trackTaskPause(taskId: string, taskTitle: string, reason?: string): Promise<Breadcrumb | null> {
    return this.addBreadcrumb('task_pause', `Paused: ${taskTitle}`, {
      taskId,
      taskTitle,
      description: reason,
    });
  }

  async trackInterruption(description: string, currentTaskId?: string, currentTaskTitle?: string): Promise<Breadcrumb | null> {
    return this.addBreadcrumb('interruption', `Interrupted: ${description}`, {
      taskId: currentTaskId,
      taskTitle: currentTaskTitle,
      description,
    });
  }

  async trackSpawn(newTaskTitle: string, parentTaskId: string, parentTaskTitle: string): Promise<Breadcrumb | null> {
    return this.addBreadcrumb('spawn', `Spawned: ${newTaskTitle}`, {
      taskTitle: newTaskTitle,
      parentTaskId,
      description: `While working on: ${parentTaskTitle}`,
    });
  }

  async trackThought(thought: string): Promise<Breadcrumb | null> {
    const preview = thought.length > 50 ? thought.substring(0, 50) + '...' : thought;
    return this.addBreadcrumb('thought', `Thought: ${preview}`, {
      description: thought,
    });
  }

  async trackEnergyChange(energy: 'low' | 'medium' | 'high'): Promise<Breadcrumb | null> {
    const emoji = energy === 'high' ? '⚡' : energy === 'medium' ? '😊' : '🔋';
    return this.addBreadcrumb('energy_change', `${emoji} Energy: ${energy}`, {
      energy,
    });
  }

  async trackAppState(state: 'background' | 'foreground'): Promise<Breadcrumb | null> {
    const type: BreadcrumbType = state === 'background' ? 'app_background' : 'app_foreground';
    const label = state === 'background' ? '📱 App backgrounded' : '📱 Returned to app';
    return this.addBreadcrumb(type, label);
  }

  // ============ CONTEXT SNAPSHOTS ============

  async saveContext(
    label: string,
    options?: {
      description?: string;
      activeTaskId?: string;
      activeTaskTitle?: string;
      energy?: 'low' | 'medium' | 'high';
    }
  ): Promise<ContextSnapshot | null> {
    const trail = this.getActiveTrail();
    if (!trail) return null;

    const snapshot: ContextSnapshot = {
      id: this.generateId(),
      label,
      description: options?.description,
      activeTaskId: options?.activeTaskId,
      activeTaskTitle: options?.activeTaskTitle,
      breadcrumbTrailId: trail.id,
      breadcrumbCount: trail.breadcrumbs.length,
      energy: options?.energy,
      savedAt: new Date().toISOString(),
    };

    this.snapshots.unshift(snapshot);

    // Trim old snapshots
    if (this.snapshots.length > MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(0, MAX_SNAPSHOTS);
    }

    // Add breadcrumb for the save
    await this.addBreadcrumb('context_save', `💾 Saved: ${label}`, {
      taskId: options?.activeTaskId,
      taskTitle: options?.activeTaskTitle,
    });

    await this.save();
    return snapshot;
  }

  async restoreContext(snapshotId: string): Promise<ContextSnapshot | null> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) return null;

    snapshot.restoredAt = new Date().toISOString();

    // Add breadcrumb for the restore
    await this.addBreadcrumb('context_save', `📂 Restored: ${snapshot.label}`, {
      taskId: snapshot.activeTaskId,
      taskTitle: snapshot.activeTaskTitle,
    });

    await this.save();
    return snapshot;
  }

  getSnapshots(): ContextSnapshot[] {
    return this.snapshots;
  }

  // ============ QUERY & ANALYSIS ============

  getRecentBreadcrumbs(count: number = 10): Breadcrumb[] {
    const trail = this.getActiveTrail();
    if (!trail) return [];
    return trail.breadcrumbs.slice(-count).reverse();
  }

  getLastTaskContext(): { taskId: string; taskTitle: string; breadcrumb: Breadcrumb } | null {
    const trail = this.getActiveTrail();
    if (!trail) return null;

    // Find the most recent task-related breadcrumb
    for (let i = trail.breadcrumbs.length - 1; i >= 0; i--) {
      const b = trail.breadcrumbs[i];
      if (b.taskId && b.taskTitle && ['task_start', 'task_pause'].includes(b.type)) {
        return { taskId: b.taskId, taskTitle: b.taskTitle, breadcrumb: b };
      }
    }
    return null;
  }

  getSpawnedTasks(): Breadcrumb[] {
    const trail = this.getActiveTrail();
    if (!trail) return [];
    return trail.breadcrumbs.filter(b => b.type === 'spawn');
  }

  getInterruptions(): Breadcrumb[] {
    const trail = this.getActiveTrail();
    if (!trail) return [];
    return trail.breadcrumbs.filter(b => b.type === 'interruption');
  }

  generateSummary(): string {
    const trail = this.getActiveTrail();
    if (!trail || trail.breadcrumbs.length === 0) {
      return "No activity tracked yet today.";
    }

    const taskStarts = trail.breadcrumbs.filter(b => b.type === 'task_start').length;
    const taskCompletes = trail.breadcrumbs.filter(b => b.type === 'task_complete').length;
    const interruptions = trail.breadcrumbs.filter(b => b.type === 'interruption').length;
    const spawns = trail.breadcrumbs.filter(b => b.type === 'spawn').length;

    const parts: string[] = [];
    
    if (taskCompletes > 0) {
      parts.push(`✅ ${taskCompletes} task${taskCompletes > 1 ? 's' : ''} completed`);
    }
    if (taskStarts > taskCompletes) {
      parts.push(`🔄 ${taskStarts - taskCompletes} in progress`);
    }
    if (interruptions > 0) {
      parts.push(`⚡ ${interruptions} interruption${interruptions > 1 ? 's' : ''}`);
    }
    if (spawns > 0) {
      parts.push(`🌱 ${spawns} spawned task${spawns > 1 ? 's' : ''}`);
    }

    return parts.length > 0 ? parts.join(' • ') : "Activity tracked, no completions yet.";
  }

  // ============ CLEANUP ============

  async clearActiveTrail(): Promise<void> {
    await this.startNewTrail();
  }

  async deleteOldTrails(keepDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    
    const before = this.trails.length;
    this.trails = this.trails.filter(t => 
      t.id === this.activeTrailId || new Date(t.createdAt) > cutoff
    );
    
    await this.save();
    return before - this.trails.length;
  }
}

// Singleton instance
let serviceInstance: ContextBreadcrumbService | null = null;

export function getContextBreadcrumbService(): ContextBreadcrumbService {
  if (!serviceInstance) {
    serviceInstance = new ContextBreadcrumbService();
  }
  return serviceInstance;
}

export async function initializeContextBreadcrumbs(): Promise<ContextBreadcrumbService> {
  const service = getContextBreadcrumbService();
  await service.initialize();
  return service;
}