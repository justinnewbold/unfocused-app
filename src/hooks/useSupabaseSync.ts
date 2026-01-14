// Supabase Data Sync Hook for UnFocused
// Handles bidirectional sync between local state and Supabase

import { useCallback, useRef } from 'react';
import { 
  supabase, 
  TasksAPI, 
  FocusSessionsAPI, 
  EnergyLogsAPI,
  type Task as SupabaseTask,
  type FocusSession as SupabaseFocusSession,
  type EnergyLog as SupabaseEnergyLog,
} from '../services/supabase';

// Local task type from App.tsx
interface LocalTask {
  id: string;
  title: string;
  energy: 'low' | 'medium' | 'high';
  completed: boolean;
  isMicroStep: boolean;
  parentId?: string;
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  scheduledTime?: string;
  synced?: boolean;
  completionTimeMs?: number;
  calendarEventId?: string;
}

interface SyncHookOptions {
  userId: string | null;
  onTasksLoaded?: (tasks: LocalTask[]) => void;
}

// Convert energy level to number (1-10)
const energyToNumber = (energy: 'low' | 'medium' | 'high'): number => {
  switch (energy) {
    case 'low': return 3;
    case 'medium': return 6;
    case 'high': return 9;
    default: return 5;
  }
};

// Convert number to energy level
const numberToEnergy = (num: number): 'low' | 'medium' | 'high' => {
  if (num <= 4) return 'low';
  if (num <= 7) return 'medium';
  return 'high';
};

// Convert local task to Supabase format
const toSupabaseTask = (task: LocalTask, userId: string): Omit<SupabaseTask, 'id'> => ({
  user_id: userId,
  title: task.title,
  description: task.isMicroStep && task.parentId ? `Micro-step of ${task.parentId}` : undefined,
  completed: task.completed,
  completed_at: task.completedAt,
  estimated_minutes: task.completionTimeMs ? Math.round(task.completionTimeMs / 60000) : undefined,
  priority: task.energy === 'high' ? 3 : task.energy === 'medium' ? 2 : 1,
  tags: [task.energy, task.isMicroStep ? 'micro-step' : 'main-task'],
});

// Convert Supabase task to local format
const toLocalTask = (task: SupabaseTask): LocalTask => ({
  id: task.id || `supabase-${Date.now()}`,
  title: task.title,
  energy: task.priority >= 3 ? 'high' : task.priority >= 2 ? 'medium' : 'low',
  completed: task.completed,
  isMicroStep: task.tags?.includes('micro-step') || false,
  createdAt: new Date().toISOString(),
  completedAt: task.completed_at,
  synced: true,
});

export function useSupabaseSync({ userId, onTasksLoaded }: SyncHookOptions) {
  const syncInProgress = useRef(false);

  // Load tasks from Supabase
  const loadTasks = useCallback(async (): Promise<LocalTask[]> => {
    if (!userId) return [];
    
    try {
      const [incomplete, completed] = await Promise.all([
        TasksAPI.getIncomplete(userId),
        TasksAPI.getCompleted(userId, 10),
      ]);
      
      const localTasks = [...incomplete, ...completed].map(toLocalTask);
      onTasksLoaded?.(localTasks);
      return localTasks;
    } catch (error) {
      console.error('Error loading tasks from Supabase:', error);
      return [];
    }
  }, [userId, onTasksLoaded]);

  // Create a new task
  const createTask = useCallback(async (task: LocalTask): Promise<LocalTask | null> => {
    if (!userId) {
      // Return task with synced=false for offline use
      return { ...task, synced: false };
    }

    try {
      const created = await TasksAPI.create(toSupabaseTask(task, userId));
      if (created) {
        return { ...task, id: created.id || task.id, synced: true };
      }
      return { ...task, synced: false };
    } catch (error) {
      console.error('Error creating task in Supabase:', error);
      return { ...task, synced: false };
    }
  }, [userId]);

  // Complete a task
  const completeTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!userId) return true; // Local only, mark as success

    try {
      return await TasksAPI.complete(taskId);
    } catch (error) {
      console.error('Error completing task in Supabase:', error);
      return false;
    }
  }, [userId]);

  // Update a task
  const updateTask = useCallback(async (taskId: string, updates: Partial<LocalTask>): Promise<boolean> => {
    if (!userId) return true;

    try {
      const supabaseUpdates: Partial<SupabaseTask> = {
        title: updates.title,
        completed: updates.completed,
        completed_at: updates.completedAt,
        priority: updates.energy === 'high' ? 3 : updates.energy === 'medium' ? 2 : 1,
      };
      return await TasksAPI.update(taskId, supabaseUpdates);
    } catch (error) {
      console.error('Error updating task in Supabase:', error);
      return false;
    }
  }, [userId]);

  // Delete a task
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!userId) return true;

    try {
      return await TasksAPI.delete(taskId);
    } catch (error) {
      console.error('Error deleting task in Supabase:', error);
      return false;
    }
  }, [userId]);

  // Log a focus session
  const logFocusSession = useCallback(async (
    startedAt: Date,
    endedAt: Date,
    taskId?: string,
    notes?: string
  ): Promise<boolean> => {
    if (!userId) return true;

    try {
      const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60000);
      
      const session = await FocusSessionsAPI.create({
        user_id: userId,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        task_id: taskId,
        notes: notes,
        completed: true,
      });
      
      return session !== null;
    } catch (error) {
      console.error('Error logging focus session:', error);
      return false;
    }
  }, [userId]);

  // Get recent focus sessions
  const getFocusSessions = useCallback(async (limit = 20): Promise<SupabaseFocusSession[]> => {
    if (!userId) return [];

    try {
      return await FocusSessionsAPI.getRecent(userId, limit);
    } catch (error) {
      console.error('Error fetching focus sessions:', error);
      return [];
    }
  }, [userId]);

  // Log energy level
  const logEnergy = useCallback(async (
    energyLevel: 'low' | 'medium' | 'high',
    mood?: string,
    notes?: string
  ): Promise<boolean> => {
    if (!userId) return true;

    try {
      const log = await EnergyLogsAPI.create({
        user_id: userId,
        logged_at: new Date().toISOString(),
        energy_level: energyToNumber(energyLevel),
        mood: mood,
        notes: notes,
      });
      
      return log !== null;
    } catch (error) {
      console.error('Error logging energy:', error);
      return false;
    }
  }, [userId]);

  // Get recent energy logs
  const getEnergyLogs = useCallback(async (limit = 50): Promise<SupabaseEnergyLog[]> => {
    if (!userId) return [];

    try {
      return await EnergyLogsAPI.getRecent(userId, limit);
    } catch (error) {
      console.error('Error fetching energy logs:', error);
      return [];
    }
  }, [userId]);

  // Sync unsynced local tasks to Supabase
  const syncLocalTasks = useCallback(async (localTasks: LocalTask[]): Promise<LocalTask[]> => {
    if (!userId || syncInProgress.current) return localTasks;
    
    syncInProgress.current = true;
    const updatedTasks = [...localTasks];
    
    try {
      for (let i = 0; i < updatedTasks.length; i++) {
        const task = updatedTasks[i];
        if (!task.synced) {
          const synced = await createTask(task);
          if (synced) {
            updatedTasks[i] = synced;
          }
        }
      }
    } catch (error) {
      console.error('Error syncing local tasks:', error);
    } finally {
      syncInProgress.current = false;
    }
    
    return updatedTasks;
  }, [userId, createTask]);

  return {
    // Task operations
    loadTasks,
    createTask,
    completeTask,
    updateTask,
    deleteTask,
    syncLocalTasks,
    
    // Focus session operations
    logFocusSession,
    getFocusSessions,
    
    // Energy operations
    logEnergy,
    getEnergyLogs,
  };
}

export default useSupabaseSync;
