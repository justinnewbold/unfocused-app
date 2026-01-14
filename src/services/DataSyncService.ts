/**
 * DataSyncService - Syncs local app data with Supabase backend
 * Handles tasks, focus sessions, and energy logs
 */

import { supabase, TasksAPI, FocusSessionsAPI, EnergyLogsAPI } from './supabase';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  estimatedMinutes?: number;
  actualMinutes?: number;
  dueDate?: string;
  tags?: string[];
  createdAt: string;
  completedAt?: string;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  focusScore?: number;
  distractions?: number;
  notes?: string;
}

export interface EnergyLog {
  id: string;
  level: number; // 1-5
  mood?: string;
  notes?: string;
  timestamp: string;
}

class DataSyncService {
  private userId: string | null = null;
  private isGuest: boolean = false;

  /**
   * Initialize the sync service with user context
   */
  initialize(userId: string, isGuest: boolean = false) {
    this.userId = userId;
    this.isGuest = isGuest;
    console.log(`DataSyncService initialized for ${isGuest ? 'guest' : 'authenticated'} user:`, userId);
  }

  /**
   * Check if service is ready for operations
   */
  isReady(): boolean {
    return this.userId !== null;
  }

  // ==================== TASKS ====================

  /**
   * Fetch all tasks for the current user
   */
  async getTasks(): Promise<Task[]> {
    if (!this.userId) return [];
    
    // Guest users use localStorage
    if (this.isGuest) {
      return this.getLocalTasks();
    }

    try {
      const tasks = await TasksAPI.getAll(this.userId);
      return tasks.map(this.mapDbTaskToTask);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return this.getLocalTasks(); // Fallback to local
    }
  }

  /**
   * Create a new task
   */
  async createTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task | null> {
    if (!this.userId) return null;

    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    // Guest users store locally
    if (this.isGuest) {
      this.saveLocalTask(newTask);
      return newTask;
    }

    try {
      const dbTask = await TasksAPI.create({
        user_id: this.userId,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: newTask.status,
        estimated_minutes: newTask.estimatedMinutes,
        due_date: newTask.dueDate,
        tags: newTask.tags,
      });

      return this.mapDbTaskToTask(dbTask);
    } catch (error) {
      console.error('Error creating task:', error);
      // Fallback: save locally
      this.saveLocalTask(newTask);
      return newTask;
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    if (!this.userId) return null;

    if (this.isGuest) {
      return this.updateLocalTask(taskId, updates);
    }

    try {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.estimatedMinutes !== undefined) dbUpdates.estimated_minutes = updates.estimatedMinutes;
      if (updates.actualMinutes !== undefined) dbUpdates.actual_minutes = updates.actualMinutes;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;

      const dbTask = await TasksAPI.update(taskId, dbUpdates);
      return this.mapDbTaskToTask(dbTask);
    } catch (error) {
      console.error('Error updating task:', error);
      return this.updateLocalTask(taskId, updates);
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    if (!this.userId) return false;

    if (this.isGuest) {
      return this.deleteLocalTask(taskId);
    }

    try {
      await TasksAPI.delete(taskId);
      return true;
    } catch (error) {
      console.error('Error deleting task:', error);
      return this.deleteLocalTask(taskId);
    }
  }

  /**
   * Mark a task as completed
   */
  async completeTask(taskId: string): Promise<Task | null> {
    return this.updateTask(taskId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  }

  // ==================== FOCUS SESSIONS ====================

  /**
   * Start a new focus session
   */
  async startFocusSession(taskId?: string, taskTitle?: string): Promise<FocusSession | null> {
    if (!this.userId) return null;

    const session: FocusSession = {
      id: crypto.randomUUID(),
      taskId,
      startTime: new Date().toISOString(),
      durationMinutes: 0,
    };

    if (this.isGuest) {
      this.saveLocalFocusSession(session);
      return session;
    }

    try {
      const dbSession = await FocusSessionsAPI.create({
        user_id: this.userId,
        task_id: taskId,
        task_title: taskTitle,
        start_time: session.startTime,
        duration_minutes: 0,
      });

      return this.mapDbSessionToSession(dbSession);
    } catch (error) {
      console.error('Error starting focus session:', error);
      this.saveLocalFocusSession(session);
      return session;
    }
  }

  /**
   * End a focus session
   */
  async endFocusSession(
    sessionId: string,
    durationMinutes: number,
    focusScore?: number,
    distractions?: number,
    notes?: string
  ): Promise<FocusSession | null> {
    if (!this.userId) return null;

    const endTime = new Date().toISOString();

    if (this.isGuest) {
      return this.updateLocalFocusSession(sessionId, {
        endTime,
        durationMinutes,
        focusScore,
        distractions,
        notes,
      });
    }

    try {
      const dbSession = await FocusSessionsAPI.update(sessionId, {
        end_time: endTime,
        duration_minutes: durationMinutes,
        focus_score: focusScore,
        distractions,
        notes,
      });

      return this.mapDbSessionToSession(dbSession);
    } catch (error) {
      console.error('Error ending focus session:', error);
      return this.updateLocalFocusSession(sessionId, {
        endTime,
        durationMinutes,
        focusScore,
        distractions,
        notes,
      });
    }
  }

  /**
   * Get focus sessions for date range
   */
  async getFocusSessions(startDate: Date, endDate: Date): Promise<FocusSession[]> {
    if (!this.userId) return [];

    if (this.isGuest) {
      return this.getLocalFocusSessions().filter(s => {
        const sessionDate = new Date(s.startTime);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    }

    try {
      const sessions = await FocusSessionsAPI.getByDateRange(
        this.userId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      return sessions.map(this.mapDbSessionToSession);
    } catch (error) {
      console.error('Error fetching focus sessions:', error);
      return this.getLocalFocusSessions();
    }
  }

  // ==================== ENERGY LOGS ====================

  /**
   * Log energy level
   */
  async logEnergy(level: number, mood?: string, notes?: string): Promise<EnergyLog | null> {
    if (!this.userId) return null;

    const log: EnergyLog = {
      id: crypto.randomUUID(),
      level,
      mood,
      notes,
      timestamp: new Date().toISOString(),
    };

    if (this.isGuest) {
      this.saveLocalEnergyLog(log);
      return log;
    }

    try {
      const dbLog = await EnergyLogsAPI.create({
        user_id: this.userId,
        energy_level: level,
        mood,
        notes,
      });

      return this.mapDbLogToLog(dbLog);
    } catch (error) {
      console.error('Error logging energy:', error);
      this.saveLocalEnergyLog(log);
      return log;
    }
  }

  /**
   * Get energy logs for date range
   */
  async getEnergyLogs(startDate: Date, endDate: Date): Promise<EnergyLog[]> {
    if (!this.userId) return [];

    if (this.isGuest) {
      return this.getLocalEnergyLogs().filter(l => {
        const logDate = new Date(l.timestamp);
        return logDate >= startDate && logDate <= endDate;
      });
    }

    try {
      const logs = await EnergyLogsAPI.getByDateRange(
        this.userId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      return logs.map(this.mapDbLogToLog);
    } catch (error) {
      console.error('Error fetching energy logs:', error);
      return this.getLocalEnergyLogs();
    }
  }

  // ==================== LOCAL STORAGE HELPERS ====================

  private getLocalTasks(): Task[] {
    try {
      const data = localStorage.getItem(`unfocused_tasks_${this.userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalTask(task: Task): void {
    const tasks = this.getLocalTasks();
    tasks.push(task);
    localStorage.setItem(`unfocused_tasks_${this.userId}`, JSON.stringify(tasks));
  }

  private updateLocalTask(taskId: string, updates: Partial<Task>): Task | null {
    const tasks = this.getLocalTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    tasks[index] = { ...tasks[index], ...updates };
    localStorage.setItem(`unfocused_tasks_${this.userId}`, JSON.stringify(tasks));
    return tasks[index];
  }

  private deleteLocalTask(taskId: string): boolean {
    const tasks = this.getLocalTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(`unfocused_tasks_${this.userId}`, JSON.stringify(filtered));
    return tasks.length !== filtered.length;
  }

  private getLocalFocusSessions(): FocusSession[] {
    try {
      const data = localStorage.getItem(`unfocused_sessions_${this.userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalFocusSession(session: FocusSession): void {
    const sessions = this.getLocalFocusSessions();
    sessions.push(session);
    localStorage.setItem(`unfocused_sessions_${this.userId}`, JSON.stringify(sessions));
  }

  private updateLocalFocusSession(sessionId: string, updates: Partial<FocusSession>): FocusSession | null {
    const sessions = this.getLocalFocusSessions();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index === -1) return null;

    sessions[index] = { ...sessions[index], ...updates };
    localStorage.setItem(`unfocused_sessions_${this.userId}`, JSON.stringify(sessions));
    return sessions[index];
  }

  private getLocalEnergyLogs(): EnergyLog[] {
    try {
      const data = localStorage.getItem(`unfocused_energy_${this.userId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalEnergyLog(log: EnergyLog): void {
    const logs = this.getLocalEnergyLogs();
    logs.push(log);
    localStorage.setItem(`unfocused_energy_${this.userId}`, JSON.stringify(logs));
  }

  // ==================== MAPPERS ====================

  private mapDbTaskToTask(dbTask: any): Task {
    return {
      id: dbTask.id,
      title: dbTask.title,
      description: dbTask.description,
      priority: dbTask.priority || 'medium',
      status: dbTask.status || 'pending',
      estimatedMinutes: dbTask.estimated_minutes,
      actualMinutes: dbTask.actual_minutes,
      dueDate: dbTask.due_date,
      tags: dbTask.tags || [],
      createdAt: dbTask.created_at,
      completedAt: dbTask.completed_at,
    };
  }

  private mapDbSessionToSession(dbSession: any): FocusSession {
    return {
      id: dbSession.id,
      taskId: dbSession.task_id,
      startTime: dbSession.start_time,
      endTime: dbSession.end_time,
      durationMinutes: dbSession.duration_minutes || 0,
      focusScore: dbSession.focus_score,
      distractions: dbSession.distractions,
      notes: dbSession.notes,
    };
  }

  private mapDbLogToLog(dbLog: any): EnergyLog {
    return {
      id: dbLog.id,
      level: dbLog.energy_level,
      mood: dbLog.mood,
      notes: dbLog.notes,
      timestamp: dbLog.logged_at || dbLog.created_at,
    };
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService();
export default dataSyncService;
