-- Supabase Migration: Weekly Reports & Smart Nudges
-- Run this in your Supabase SQL Editor

-- Create nero_focus_sessions table (if not exists)
CREATE TABLE IF NOT EXISTS nero_focus_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  task_id UUID,
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nero_energy_logs table (if not exists)
CREATE TABLE IF NOT EXISTS nero_energy_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  mood TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nero_nudges table for smart nudge scheduling
CREATE TABLE IF NOT EXISTS nero_nudges (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_time TEXT NOT NULL, -- Format: "HH:MM" (e.g., "09:00")
  type TEXT NOT NULL CHECK (type IN ('focus_reminder', 'energy_check', 'task_suggestion', 'break_reminder')),
  message TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  repeat_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- 0=Sunday, 1=Monday, etc.
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nero_tasks table (if not exists) - for task suggestions
CREATE TABLE IF NOT EXISTS nero_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  estimated_minutes INTEGER,
  priority INTEGER DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started 
  ON nero_focus_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_energy_logs_user_logged 
  ON nero_energy_logs(user_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_nudges_user_enabled 
  ON nero_nudges(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_tasks_user_completed 
  ON nero_tasks(user_id, completed, created_at DESC);

-- Row Level Security Policies
ALTER TABLE nero_focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE nero_energy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nero_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE nero_tasks ENABLE ROW LEVEL SECURITY;

-- Focus Sessions Policies
CREATE POLICY "Users can view own focus sessions" ON nero_focus_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus sessions" ON nero_focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focus sessions" ON nero_focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own focus sessions" ON nero_focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Energy Logs Policies
CREATE POLICY "Users can view own energy logs" ON nero_energy_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own energy logs" ON nero_energy_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own energy logs" ON nero_energy_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own energy logs" ON nero_energy_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Nudges Policies
CREATE POLICY "Users can view own nudges" ON nero_nudges
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nudges" ON nero_nudges
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nudges" ON nero_nudges
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nudges" ON nero_nudges
  FOR DELETE USING (auth.uid() = user_id);

-- Tasks Policies  
CREATE POLICY "Users can view own tasks" ON nero_tasks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON nero_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON nero_tasks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON nero_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Helpful comment
COMMENT ON TABLE nero_nudges IS 'Smart nudge scheduling for ADHD-friendly reminders based on user patterns';
COMMENT ON TABLE nero_focus_sessions IS 'Track focus sessions for pattern analysis';
COMMENT ON TABLE nero_energy_logs IS 'Track energy levels throughout the day for correlation with productivity';
