// Supabase Client Service for UnFocused App
// Handles all database operations for Nero AI companion

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uvanigqqvfidjbtnqvvz.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types
export interface FocusSession {
  id?: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  task_id?: string;
  notes?: string;
  completed: boolean;
}

export interface EnergyLog {
  id?: string;
  user_id: string;
  logged_at: string;
  energy_level: number; // 1-10
  mood?: string;
  notes?: string;
}

export interface SmartNudge {
  id: string;
  user_id: string;
  scheduled_time: string; // "HH:MM"
  type: 'focus_reminder' | 'energy_check' | 'task_suggestion' | 'break_reminder';
  message: string;
  enabled: boolean;
  repeat_days: number[]; // 0=Sunday, 1=Monday, etc.
  last_fired_at?: string;
}

export interface Task {
  id?: string;
  user_id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
  estimated_minutes?: number;
  priority: number;
  tags?: string[];
}

// Focus Sessions API
export const FocusSessionsAPI = {
  async create(session: Omit<FocusSession, 'id'>): Promise<FocusSession | null> {
    const { data, error } = await supabase
      .from('nero_focus_sessions')
      .insert(session)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating focus session:', error);
      return null;
    }
    return data;
  },

  async getRecent(userId: string, limit = 20): Promise<FocusSession[]> {
    const { data, error } = await supabase
      .from('nero_focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching focus sessions:', error);
      return [];
    }
    return data || [];
  },

  async getWeekly(userId: string): Promise<FocusSession[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data, error } = await supabase
      .from('nero_focus_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', oneWeekAgo.toISOString())
      .order('started_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching weekly sessions:', error);
      return [];
    }
    return data || [];
  },

  async update(id: string, updates: Partial<FocusSession>): Promise<boolean> {
    const { error } = await supabase
      .from('nero_focus_sessions')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating focus session:', error);
      return false;
    }
    return true;
  },
};

// Energy Logs API
export const EnergyLogsAPI = {
  async create(log: Omit<EnergyLog, 'id'>): Promise<EnergyLog | null> {
    const { data, error } = await supabase
      .from('nero_energy_logs')
      .insert(log)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating energy log:', error);
      return null;
    }
    return data;
  },

  async getRecent(userId: string, limit = 50): Promise<EnergyLog[]> {
    const { data, error } = await supabase
      .from('nero_energy_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching energy logs:', error);
      return [];
    }
    return data || [];
  },

  async getWeekly(userId: string): Promise<EnergyLog[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data, error } = await supabase
      .from('nero_energy_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', oneWeekAgo.toISOString())
      .order('logged_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching weekly energy logs:', error);
      return [];
    }
    return data || [];
  },
};

// Smart Nudges API
export const NudgesAPI = {
  async create(nudge: SmartNudge): Promise<SmartNudge | null> {
    const { data, error } = await supabase
      .from('nero_nudges')
      .insert(nudge)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating nudge:', error);
      return null;
    }
    return data;
  },

  async getEnabled(userId: string): Promise<SmartNudge[]> {
    const { data, error } = await supabase
      .from('nero_nudges')
      .select('*')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      console.error('Error fetching nudges:', error);
      return [];
    }
    return data || [];
  },

  async getAll(userId: string): Promise<SmartNudge[]> {
    const { data, error } = await supabase
      .from('nero_nudges')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });
    
    if (error) {
      console.error('Error fetching all nudges:', error);
      return [];
    }
    return data || [];
  },

  async update(id: string, updates: Partial<SmartNudge>): Promise<boolean> {
    const { error } = await supabase
      .from('nero_nudges')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating nudge:', error);
      return false;
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('nero_nudges')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting nudge:', error);
      return false;
    }
    return true;
  },
};

// Tasks API
export const TasksAPI = {
  async create(task: Omit<Task, 'id'>): Promise<Task | null> {
    const { data, error } = await supabase
      .from('nero_tasks')
      .insert(task)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
      return null;
    }
    return data;
  },

  async getIncomplete(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('nero_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching incomplete tasks:', error);
      return [];
    }
    return data || [];
  },

  async getCompleted(userId: string, limit = 20): Promise<Task[]> {
    const { data, error } = await supabase
      .from('nero_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .order('completed_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching completed tasks:', error);
      return [];
    }
    return data || [];
  },

  async complete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('nero_tasks')
      .update({ 
        completed: true, 
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (error) {
      console.error('Error completing task:', error);
      return false;
    }
    return true;
  },

  async update(id: string, updates: Partial<Task>): Promise<boolean> {
    const { error } = await supabase
      .from('nero_tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating task:', error);
      return false;
    }
    return true;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('nero_tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting task:', error);
      return false;
    }
    return true;
  },
};

// Auth helpers
export const AuthAPI = {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export default supabase;
