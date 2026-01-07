import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, 
  SafeAreaView, Modal, Animated, Platform, KeyboardAvoidingView, 
  ActivityIndicator, Switch, Linking, Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============ TYPES ============
type EnergyLevel = 'low' | 'medium' | 'high';
type ViewMode = 'conversation' | 'oneThing' | 'list' | 'timeline' | 'dashboard' | 'minimal';
type Personality = 'loyalFriend' | 'professional' | 'coach' | 'drillSergeant' | 'funny' | 'calm';
type ThinkingMode = 'off' | 'minimal' | 'full';
type NotificationStyle = 'gentle' | 'variable' | 'persistent';

interface Task {
  id: string;
  title: string;
  energy: EnergyLevel;
  completed: boolean;
  isMicroStep: boolean;
  parentId?: string;
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  scheduledTime?: string;
  synced?: boolean;
  completionTimeMs?: number;
}

// ============ PATTERN ANALYSIS TYPES ============
interface CompletionRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  energy: EnergyLevel;
  completedAt: string;
  hour: number;
  dayOfWeek: number;
  completionTimeMs?: number;
}

interface HourlyProductivity {
  hour: number;
  completions: number;
  avgEnergy: number;
  successRate: number;
}

interface WeeklyInsight {
  id: string;
  type: 'peak_hours' | 'energy_pattern' | 'suggestion' | 'achievement' | 'warning';
  title: string;
  message: string;
  emoji: string;
  generatedAt: string;
  priority: number;
}

interface PatternData {
  hourlyStats: HourlyProductivity[];
  peakHours: number[];
  bestDays: number[];
  avgCompletionsByEnergy: Record<EnergyLevel, number>;
  totalCompletions: number;
  weeklyTrend: 'improving' | 'stable' | 'declining';
}

interface Message {
  id: string;
  role: 'nero' | 'user';
  content: string;
  model?: string;
  thinking?: string;
  timestamp: string;
}

interface Breadcrumb {
  id: string;
  text: string;
  timestamp: string;
}

interface SavedContext {
  id: string;
  label: string;
  tasks: string[];
  breadcrumbs: string[];
  energy: EnergyLevel | null;
  timestamp: string;
}

interface ThoughtDump {
  id: string;
  text: string;
  timestamp: string;
  processed: boolean;
}

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  points: number;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  color?: string;
}

interface UserProfile {
  id?: string;
  email?: string;
  name: string;
  neroName: string;
  personality: Personality;
  apiKey: string;
  thinkingMode: ThinkingMode;
  notificationStyle: NotificationStyle;
  notificationsEnabled: boolean;
  calendarConnected: boolean;
  lastSync?: string;
}

interface NeroMemory {
  likes: string[];
  dislikes: string[];
  triggers: string[];
  patterns: string[];
}

// ============ CONSTANTS ============
const C = {
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  bg: '#0F0F1A',
  card: '#252542',
  text: '#FFFFFF',
  textSec: '#B8B8D1',
  textMuted: '#6C6C8A',
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF7675',
  border: '#3D3D5C',
  gold: '#F9CA24',
  teal: '#00CEC9',
  pink: '#FD79A8',
  blue: '#0984E3',
};

// Supabase Config (User will add their own keys in settings)
const SUPABASE_URL = 'https://wektbfkzbxvtxsremnnk.supabase.co';

const PERSONALITIES: Record<string, { name: string; emoji: string; desc: string; color: string; greetings: string[]; systemPrompt: string }> = {
  loyalFriend: {
    name: 'Loyal Friend', emoji: '🤗', desc: 'Warm, supportive, casual', color: C.primary,
    greetings: ["Hey there! 💙", "Hi friend!", "Hey! 👋", "Good to see you!"],
    systemPrompt: "You are Nero, a warm and supportive AI companion for someone with ADHD. Be friendly, use casual language, light humor. Always be encouraging. Never guilt or shame."
  },
  professional: {
    name: 'Professional', emoji: '💼', desc: 'Clear, efficient, minimal', color: C.teal,
    greetings: ["Hello.", "Ready when you are.", "How can I help?"],
    systemPrompt: "You are Nero, a professional AI assistant for someone with ADHD. Be clear, efficient, and concise. Skip unnecessary words. Respect their time and energy."
  },
  coach: {
    name: 'Coach', emoji: '🏆', desc: 'Motivating, pushing gently', color: C.gold,
    greetings: ["Let's go! 💪", "Ready to crush it?", "Champion! Let's do this!"],
    systemPrompt: "You are Nero, a motivating coach for someone with ADHD. Be encouraging, push gently, celebrate wins enthusiastically. Help them see their potential."
  },
  drillSergeant: {
    name: 'Drill Sergeant', emoji: '🎖️', desc: 'Direct, firm, no excuses', color: '#E17055',
    greetings: ["Attention!", "Time to work.", "No excuses today."],
    systemPrompt: "You are Nero, a firm but fair drill sergeant for someone with ADHD. Be direct, no-nonsense, but ultimately supportive. They chose this mode because they need accountability."
  },
  funny: {
    name: 'Funny', emoji: '😄', desc: 'Playful, jokes, light', color: C.pink,
    greetings: ["Heyyy! 😄", "Look who showed up!", "The legend returns!"],
    systemPrompt: "You are Nero, a playful and funny AI companion for someone with ADHD. Use humor, puns, and keep things light while being helpful. Laughter helps with dopamine!"
  },
  calm: {
    name: 'Calm/Zen', emoji: '🧘', desc: 'Soft, gentle, no pressure', color: C.teal,
    greetings: ["Welcome 🌿", "Peace, friend.", "Breathe. You're here now."],
    systemPrompt: "You are Nero, a calm and zen AI companion for someone with ADHD. Be gentle, soft-spoken, never rush. Create a peaceful space. Anxiety is real."
  },
};

const VIEWS: Record<string, { name: string; emoji: string; desc: string }> = {
  conversation: { name: 'Chat', emoji: '💬', desc: 'Talk with Nero' },
  oneThing: { name: 'Focus', emoji: '🎯', desc: 'One task at a time' },
  list: { name: 'List', emoji: '📝', desc: 'All your tasks' },
  timeline: { name: 'Timeline', emoji: '📅', desc: "Today's schedule" },
  dashboard: { name: 'Stats', emoji: '📊', desc: 'Your progress' },
  minimal: { name: 'Minimal', emoji: '🌙', desc: 'Low energy mode' },
};

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_task', name: 'First Step', emoji: '👣', description: 'Complete your first task', points: 10 },
  { id: 'five_tasks', name: 'Getting Going', emoji: '🚀', description: 'Complete 5 tasks', points: 25 },
  { id: 'ten_tasks', name: 'On a Roll', emoji: '🔥', description: 'Complete 10 tasks', points: 50 },
  { id: 'twenty_five', name: 'Unstoppable', emoji: '⚡', description: 'Complete 25 tasks', points: 100 },
  { id: 'fifty_tasks', name: 'Task Master', emoji: '👑', description: 'Complete 50 tasks', points: 200 },
  { id: 'first_chat', name: 'Hello Nero', emoji: '👋', description: 'Start a conversation', points: 10 },
  { id: 'ten_chats', name: 'Best Friends', emoji: '💙', description: 'Send 10 messages', points: 25 },
  { id: 'low_energy_win', name: 'Low Energy Hero', emoji: '🌙', description: 'Complete task on low energy', points: 30 },
  { id: 'micro_win', name: 'Micro Win', emoji: '✨', description: 'Complete a micro-step', points: 10 },
  { id: 'breakdown_master', name: 'Task Breaker', emoji: '🔨', description: 'Break down 3 tasks', points: 25 },
  { id: 'context_keeper', name: 'Context Keeper', emoji: '📌', description: 'Save your context', points: 15 },
  { id: 'thought_dumper', name: 'Brain Dump', emoji: '💭', description: 'Capture 5 thoughts', points: 20 },
  { id: 'comeback_kid', name: 'Comeback Kid', emoji: '🦸', description: 'Return after a day away', points: 30 },
  { id: 'early_bird', name: 'Early Bird', emoji: '🌅', description: 'Complete task before 9am', points: 20 },
  { id: 'night_owl', name: 'Night Owl', emoji: '🦉', description: 'Complete task after 10pm', points: 20 },
  { id: 'calendar_pro', name: 'Calendar Pro', emoji: '📅', description: 'Connect your calendar', points: 25 },
  { id: 'sync_master', name: 'Sync Master', emoji: '☁️', description: 'Enable cloud sync', points: 25 },
  { id: 'week_warrior', name: 'Week Warrior', emoji: '🗓️', description: 'Use app for 7 days', points: 75 },
];

const CELEBRATIONS = ['Nice work! 🎉', 'Crushed it! 💪', 'Amazing! ⭐', "That's a win! 🏆", 'Boom! 💥', 'Yes! 🙌', 'Nailed it! 🎯', 'Fantastic! ✨', 'You did it! 🌟', 'Incredible! 💫'];
const SURPRISES = [
  { emoji: '🌟', msg: "You're amazing!" },
  { emoji: '💎', msg: 'Rare focus achieved!' },
  { emoji: '🦄', msg: 'Unicorn productivity!' },
  { emoji: '🎁', msg: 'Surprise bonus!' },
  { emoji: '⭐', msg: 'Star performer!' },
  { emoji: '🔮', msg: 'Magic focus!' },
  { emoji: '🏅', msg: 'Gold medal moment!' },
];

const NOTIFICATION_MESSAGES = {
  gentle: [
    "Hey, just checking in 💙",
    "No pressure, but you've got this!",
    "Tiny step whenever you're ready",
    "Your future self will thank you",
  ],
  variable: [
    "⚡ Quick! Do one tiny thing!",
    "🎯 Focus mode: activated?",
    "💪 You're stronger than the task!",
    "🚀 3... 2... 1... GO!",
  ],
  persistent: [
    "Task waiting for you!",
    "Don't forget your goal!",
    "Time to make progress!",
    "You committed to this!",
  ],
};

const MICRO_STARTS = [
  "Just open it and look",
  "Set a 2-minute timer",
  "Do the tiniest first step",
  "Just read the first line",
  "Move one thing",
  "Write one word",
  "Take one breath, then start",
];

// ============ HELPERS ============
const genId = () => Math.random().toString(36).substr(2, 9) + Date.now();
const getEC = (e: EnergyLevel) => e === 'high' ? C.success : e === 'medium' ? C.warning : C.error;
const getEE = (e: EnergyLevel) => e === 'high' ? '⚡' : e === 'medium' ? '✨' : '🌙';
const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const formatDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

// ============ API SERVICES ============

// Claude AI Service
const callClaudeAPI = async (
  messages: Message[],
  personality: Personality,
  energy: EnergyLevel | null,
  tasks: Task[],
  memory: NeroMemory,
  apiKey: string
): Promise<{ content: string; thinking?: string; model: string }> => {
  if (!apiKey) {
    const pc = PERSONALITIES[personality];
    const responses = [
      `${pc.greetings[0]} What's the ONE thing you'd like to focus on?`,
      `Got it! What's the smallest first step you could take?`,
      `No pressure! Tell me what's on your mind when you're ready.`,
      `That sounds manageable! Want me to add that as a task?`,
      `You're doing great just being here. One tiny step at a time! 💙`,
      `I hear you. Let's break that down into something tiny.`,
      `Totally valid! What would feel like a win today?`,
      `Remember: done is better than perfect! What's one thing?`,
    ];
    return { content: responses[Math.floor(Math.random() * responses.length)], model: 'local' };
  }

  const pendingTasks = tasks.filter(t => !t.completed).slice(0, 5);
  const pc = PERSONALITIES[personality];

  const systemPrompt = `${pc.systemPrompt}

CRITICAL RULES FOR ADHD USERS:
- Ask only ONE question at a time
- Offer maximum 3 options when giving choices
- Keep responses SHORT (under 100 words)
- Never guilt or shame - only encourage
- Match the user's energy level: ${energy || 'unknown'}
- Help with task initiation - suggest tiny first steps
- Celebrate every small win enthusiastically
- If they mention feeling overwhelmed, acknowledge it first

Current context:
- Energy level: ${energy || 'not set'}
- Pending tasks: ${pendingTasks.map(t => t.title).join(', ') || 'none'}
- User likes: ${memory.likes.join(', ') || 'learning...'}
- User dislikes: ${memory.dislikes.join(', ') || 'learning...'}
- Patterns: ${memory.patterns.join(', ') || 'still observing...'}

You're not just a task manager. You're a supportive companion who truly understands ADHD.`;

  const apiMessages = messages.slice(-10).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content
  }));

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: apiMessages,
      }),
    });

    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    return {
      content: data.content[0]?.text || "I'm here for you! What's on your mind?",
      model: 'claude-sonnet',
    };
  } catch (error) {
    const pc = PERSONALITIES[personality];
    return {
      content: `${pc.greetings[0]} I'm having trouble connecting, but I'm still here! What can I help with?`,
      model: 'fallback'
    };
  }
};

// Supabase Service
class SupabaseService {
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    if (!this.key) throw new Error('No Supabase key configured');
    
    const response = await fetch(`${this.url}/rest/v1${endpoint}`, {
      ...options,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.status}`);
    }

    return response.json();
  }

  async syncTasks(userId: string, tasks: Task[]) {
    return this.request(`/tasks?user_id=eq.${userId}`, {
      method: 'POST',
      body: JSON.stringify(tasks.map(t => ({ ...t, user_id: userId }))),
    });
  }

  async getTasks(userId: string): Promise<Task[]> {
    return this.request(`/tasks?user_id=eq.${userId}&order=createdAt.desc`);
  }

  async syncProfile(profile: UserProfile) {
    return this.request(`/profiles?id=eq.${profile.id}`, {
      method: 'POST',
      body: JSON.stringify(profile),
    });
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const results = await this.request(`/profiles?id=eq.${userId}`);
    return results[0] || null;
  }
}

// Notification Service
class NotificationService {
  private style: NotificationStyle;
  private enabled: boolean;
  private timers: NodeJS.Timeout[] = [];

  constructor(style: NotificationStyle = 'gentle', enabled: boolean = true) {
    this.style = style;
    this.enabled = enabled;
  }

  setStyle(style: NotificationStyle) {
    this.style = style;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  getRandomMessage(): string {
    const messages = NOTIFICATION_MESSAGES[this.style];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  scheduleNotification(title: string, body: string, delayMs: number) {
    if (!this.enabled) return;

    // For web, we use the Notification API
    if (Platform.OS === 'web' && 'Notification' in window) {
      const timer = setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '🧠' });
        }
      }, delayMs);
      this.timers.push(timer);
    }
  }

  scheduleVariableReminder(taskTitle: string) {
    if (!this.enabled) return;

    // Variable timing - harder to ignore!
    const delays = this.style === 'variable'
      ? [5, 12, 23, 37, 52].map(m => m * 60 * 1000) // Random-feeling minutes
      : [15, 30, 60].map(m => m * 60 * 1000); // Regular intervals

    const delay = delays[Math.floor(Math.random() * delays.length)];
    this.scheduleNotification('UnFocused', `${this.getRandomMessage()} Task: ${taskTitle}`, delay);
  }

  scheduleHyperfocusCheck(minutesActive: number) {
    if (!this.enabled || minutesActive < 90) return;

    this.scheduleNotification(
      '🧠 Hyperfocus Check',
      "You've been going for a while! Water? Stretch? Quick break?",
      0
    );
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  clearAll() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
  }
}

// Calendar Service (Google Calendar via OAuth)
class CalendarService {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  async getEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    if (!this.accessToken) {
      // Return mock events for demo
      const now = new Date();
      return [
        {
          id: '1',
          title: 'Morning Focus Block',
          start: new Date(now.setHours(9, 0, 0, 0)).toISOString(),
          end: new Date(now.setHours(11, 0, 0, 0)).toISOString(),
          color: C.primary,
        },
        {
          id: '2',
          title: 'Lunch Break',
          start: new Date(now.setHours(12, 0, 0, 0)).toISOString(),
          end: new Date(now.setHours(13, 0, 0, 0)).toISOString(),
          color: C.success,
        },
        {
          id: '3',
          title: 'Afternoon Tasks',
          start: new Date(now.setHours(14, 0, 0, 0)).toISOString(),
          end: new Date(now.setHours(17, 0, 0, 0)).toISOString(),
          color: C.warning,
        },
      ];
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!response.ok) throw new Error('Calendar API error');

      const data = await response.json();
      return (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.summary || 'Untitled',
        start: item.start?.dateTime || item.start?.date,
        end: item.end?.dateTime || item.end?.date,
        allDay: !!item.start?.date,
      }));
    } catch (error) {
      console.error('Calendar error:', error);
      return [];
    }
  }

  calculateTravelTime(eventStart: Date, travelMinutes: number = 30): { shouldLeave: Date; message: string } | null {
    const now = new Date();
    const shouldLeave = new Date(eventStart.getTime() - travelMinutes * 60 * 1000);
    const minutesUntilLeave = Math.floor((shouldLeave.getTime() - now.getTime()) / 60000);

    if (minutesUntilLeave > 0 && minutesUntilLeave <= 60) {
      return {
        shouldLeave,
        message: `Leave in ${minutesUntilLeave} min for your next event!`,
      };
    }
    return null;
  }
}

// ============ PATTERN ANALYSIS SERVICE ============
class PatternAnalysisService {
  private completionHistory: CompletionRecord[] = [];

  setHistory(history: CompletionRecord[]) {
    this.completionHistory = history;
  }

  recordCompletion(task: Task): CompletionRecord {
    const now = new Date();
    const record: CompletionRecord = {
      id: genId(),
      taskId: task.id,
      taskTitle: task.title,
      energy: task.energy,
      completedAt: now.toISOString(),
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      completionTimeMs: task.completionTimeMs,
    };
    this.completionHistory.push(record);
    return record;
  }

  getHourlyStats(): HourlyProductivity[] {
    const hourlyData: Record<number, { completions: number; energySum: number; count: number }> = {};
    
    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      hourlyData[h] = { completions: 0, energySum: 0, count: 0 };
    }

    // Aggregate completions by hour
    this.completionHistory.forEach(record => {
      const energyValue = record.energy === 'high' ? 3 : record.energy === 'medium' ? 2 : 1;
      hourlyData[record.hour].completions++;
      hourlyData[record.hour].energySum += energyValue;
      hourlyData[record.hour].count++;
    });

    return Object.entries(hourlyData).map(([hour, data]) => ({
      hour: parseInt(hour),
      completions: data.completions,
      avgEnergy: data.count > 0 ? data.energySum / data.count : 0,
      successRate: data.completions > 0 ? 1 : 0,
    }));
  }

  getPeakHours(): number[] {
    const hourlyStats = this.getHourlyStats();
    const maxCompletions = Math.max(...hourlyStats.map(h => h.completions));
    if (maxCompletions === 0) return [9, 10, 11]; // Default morning hours
    
    const threshold = maxCompletions * 0.7;
    return hourlyStats
      .filter(h => h.completions >= threshold)
      .map(h => h.hour)
      .slice(0, 3);
  }

  getBestDays(): number[] {
    const dayData: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    this.completionHistory.forEach(r => { dayData[r.dayOfWeek]++; });
    
    const sorted = Object.entries(dayData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));
    
    return sorted.length > 0 ? sorted : [1, 2, 3]; // Default to weekdays
  }

  getWeeklyTrend(): 'improving' | 'stable' | 'declining' {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const thisWeek = this.completionHistory.filter(r => 
      new Date(r.completedAt).getTime() > oneWeekAgo
    ).length;

    const lastWeek = this.completionHistory.filter(r => {
      const time = new Date(r.completedAt).getTime();
      return time > twoWeeksAgo && time <= oneWeekAgo;
    }).length;

    if (thisWeek > lastWeek * 1.2) return 'improving';
    if (thisWeek < lastWeek * 0.8) return 'declining';
    return 'stable';
  }

  getPatternData(): PatternData {
    const avgByEnergy: Record<EnergyLevel, number> = { low: 0, medium: 0, high: 0 };
    const countByEnergy: Record<EnergyLevel, number> = { low: 0, medium: 0, high: 0 };

    this.completionHistory.forEach(r => {
      countByEnergy[r.energy]++;
    });

    return {
      hourlyStats: this.getHourlyStats(),
      peakHours: this.getPeakHours(),
      bestDays: this.getBestDays(),
      avgCompletionsByEnergy: countByEnergy,
      totalCompletions: this.completionHistory.length,
      weeklyTrend: this.getWeeklyTrend(),
    };
  }

  generateInsights(profile: UserProfile, energy: EnergyLevel | null, tasks: Task[]): WeeklyInsight[] {
    const patterns = this.getPatternData();
    const insights: WeeklyInsight[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Peak hours insight
    if (patterns.peakHours.length > 0) {
      const peakTimes = patterns.peakHours.map(h => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}${ampm}`;
      }).join(', ');

      insights.push({
        id: genId(),
        type: 'peak_hours',
        title: 'Your Peak Hours',
        message: `You're most productive around ${peakTimes}. Try scheduling important tasks during these times!`,
        emoji: '⚡',
        generatedAt: new Date().toISOString(),
        priority: 1,
      });
    }

    // Best days insight
    if (patterns.bestDays.length > 0) {
      const bestDayNames = patterns.bestDays.map(d => dayNames[d]).join(' & ');
      insights.push({
        id: genId(),
        type: 'energy_pattern',
        title: 'Best Days',
        message: `${bestDayNames} tend to be your most productive days. Plan challenging tasks for these days!`,
        emoji: '📅',
        generatedAt: new Date().toISOString(),
        priority: 2,
      });
    }

    // Weekly trend insight
    const trendEmoji = patterns.weeklyTrend === 'improving' ? '📈' : patterns.weeklyTrend === 'declining' ? '📉' : '➡️';
    const trendMsg = patterns.weeklyTrend === 'improving' 
      ? "You're completing more tasks than last week! Keep up the momentum!" 
      : patterns.weeklyTrend === 'declining'
      ? "This week's been slower - that's okay! Be gentle with yourself."
      : "You're maintaining a steady pace. Consistency is key!";

    insights.push({
      id: genId(),
      type: 'achievement',
      title: 'Weekly Trend',
      message: trendMsg,
      emoji: trendEmoji,
      generatedAt: new Date().toISOString(),
      priority: 3,
    });

    // Energy-based suggestion
    if (energy === 'low' && tasks.filter(t => !t.completed && t.energy === 'low').length > 0) {
      insights.push({
        id: genId(),
        type: 'suggestion',
        title: 'Low Energy Mode',
        message: "I see you're low energy. I've got some easy wins queued up for you - small victories still count!",
        emoji: '🌙',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    // Completion milestone
    if (patterns.totalCompletions > 0 && patterns.totalCompletions % 10 === 0) {
      insights.push({
        id: genId(),
        type: 'achievement',
        title: 'Milestone!',
        message: `You've completed ${patterns.totalCompletions} tasks total! That's amazing progress! 🎉`,
        emoji: '🏆',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    // Optimal scheduling suggestion
    const currentHour = new Date().getHours();
    if (patterns.peakHours.includes(currentHour)) {
      insights.push({
        id: genId(),
        type: 'suggestion',
        title: 'Peak Time Now!',
        message: "Right now is one of your peak productivity hours! Perfect time for that challenging task.",
        emoji: '🎯',
        generatedAt: new Date().toISOString(),
        priority: 0,
      });
    }

    return insights.sort((a, b) => a.priority - b.priority);
  }

  async generateAIInsights(apiKey: string, patterns: PatternData, profile: UserProfile): Promise<string> {
    if (!apiKey) {
      return this.generateLocalInsight(patterns);
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: `You are Nero, an AI companion helping someone with ADHD understand their productivity patterns. Be warm, encouraging, and specific. Keep it under 50 words. Never guilt or shame.`,
          messages: [{
            role: 'user',
            content: `Based on my productivity data:
- Peak hours: ${patterns.peakHours.map(h => `${h}:00`).join(', ')}
- Total completions: ${patterns.totalCompletions}
- Weekly trend: ${patterns.weeklyTrend}
- Best for high energy tasks: ${patterns.avgCompletionsByEnergy.high} completions
- Best for low energy tasks: ${patterns.avgCompletionsByEnergy.low} completions

Give me ONE specific, actionable insight about my ADHD productivity patterns.`
          }],
        }),
      });

      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      return data.content[0]?.text || this.generateLocalInsight(patterns);
    } catch {
      return this.generateLocalInsight(patterns);
    }
  }

  private generateLocalInsight(patterns: PatternData): string {
    const insights = [
      `Your brain loves ${patterns.peakHours[0] || 10}:00 - that's your superpower hour! ⚡`,
      `You've crushed ${patterns.totalCompletions} tasks! Every single one counts. 🎯`,
      `${patterns.weeklyTrend === 'improving' ? 'You\'re on fire this week!' : 'Steady progress is still progress!'} 💪`,
      `Low energy? Your data shows you still get things done - just differently. 🌙`,
    ];
    return insights[Math.floor(Math.random() * insights.length)];
  }
}

// Energy detection from text
const detectEnergy = (text: string): EnergyLevel | null => {
  const lower = text.toLowerCase();
  const lowWords = ['tired', 'exhausted', 'low', 'rough', 'struggling', 'cant', "can't", 'hard', 'difficult', 'overwhelmed', 'anxious', 'stressed', 'drained', 'sleepy', 'foggy'];
  const highWords = ['great', 'good', 'energized', 'productive', 'motivated', 'excited', 'ready', 'pumped', 'focused', 'amazing', 'awesome', 'fantastic'];

  if (lowWords.some(w => lower.includes(w))) return 'low';
  if (highWords.some(w => lower.includes(w))) return 'high';
  return null;
};

// Extract tasks from natural language
const extractTasks = (text: string): string[] => {
  const patterns = [
    /i need to (.+?)(?:\.|,|!|$)/gi,
    /i have to (.+?)(?:\.|,|!|$)/gi,
    /i should (.+?)(?:\.|,|!|$)/gi,
    /remind me to (.+?)(?:\.|,|!|$)/gi,
    /don't forget to (.+?)(?:\.|,|!|$)/gi,
    /todo:?\s*(.+?)(?:\.|,|!|$)/gi,
    /i want to (.+?)(?:\.|,|!|$)/gi,
    /gotta (.+?)(?:\.|,|!|$)/gi,
  ];

  const tasks: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const task = match[1].trim();
      if (task.length > 2 && task.length < 100 && !tasks.includes(task)) {
        tasks.push(task.charAt(0).toUpperCase() + task.slice(1));
      }
    }
  }
  return tasks;
};

// ============ MAIN APP COMPONENT ============
export default function App() {
  // Core State
  const [screen, setScreen] = useState<'welcome' | 'onboarding' | 'main' | 'settings'>('welcome');
  const [view, setView] = useState<ViewMode>('conversation');
  const [loading, setLoading] = useState(true);

  // User Profile
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    neroName: 'Nero',
    personality: 'loyalFriend',
    apiKey: '',
    thinkingMode: 'minimal',
    notificationStyle: 'gentle',
    notificationsEnabled: true,
    calendarConnected: false,
  });

  // Data State
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [savedContexts, setSavedContexts] = useState<SavedContext[]>([]);
  const [thoughtDumps, setThoughtDumps] = useState<ThoughtDump[]>([]);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [neroMemory, setNeroMemory] = useState<NeroMemory>({ likes: [], dislikes: [], triggers: [], patterns: [] });

  // Stats
  const [stats, setStats] = useState({
    tasksCompleted: 0, messagesSent: 0, lowEnergyWins: 0, microSteps: 0,
    tasksBreakdown: 0, contextsSaved: 0, thoughtsDumped: 0, daysActive: 1,
    totalPoints: 0, lastActiveDate: new Date().toDateString(), streak: 0,
    sessionStart: Date.now(),
  });

  // UI State
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [newTask, setNewTask] = useState('');
  const [newEnergy, setNewEnergy] = useState<EnergyLevel>('medium');
  const [showAdd, setShowAdd] = useState(false);
  const [showCeleb, setShowCeleb] = useState(false);
  const [celebText, setCelebText] = useState('');
  const [showAch, setShowAch] = useState<Achievement | null>(null);
  const [showThought, setShowThought] = useState(false);
  const [thought, setThought] = useState('');
  const [showCtx, setShowCtx] = useState(false);
  const [ctxLabel, setCtxLabel] = useState('');
  const [showContexts, setShowContexts] = useState(false);
  const [filter, setFilter] = useState<EnergyLevel | 'all'>('all');
  const [listening, setListening] = useState(false);
  const [onbStep, setOnbStep] = useState(0);
  const [extractedTasks, setExtractedTasks] = useState<string[]>([]);
  const [showExtracted, setShowExtracted] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [supabaseKey, setSupabaseKey] = useState('');
  const [travelAlert, setTravelAlert] = useState<string | null>(null);

  // Services
  const [notificationService] = useState(() => new NotificationService());
  const [calendarService] = useState(() => new CalendarService());
  const [patternService] = useState(() => new PatternAnalysisService());

  // Pattern Analysis State
  const [completionHistory, setCompletionHistory] = useState<CompletionRecord[]>([]);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Animation refs
  const celebAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // ============ EFFECTS ============

  // Load data on mount
  useEffect(() => {
    loadData();
    requestNotificationPermission();
  }, []);

  // Check for hyperfocus
  useEffect(() => {
    const interval = setInterval(() => {
      const minutesActive = Math.floor((Date.now() - stats.sessionStart) / 60000);
      if (minutesActive > 0 && minutesActive % 90 === 0) {
        notificationService.scheduleHyperfocusCheck(minutesActive);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [stats.sessionStart]);

  // Load calendar events
  useEffect(() => {
    if (profile.calendarConnected) {
      loadCalendarEvents();
    }
  }, [profile.calendarConnected]);

  // Check travel time alerts
  useEffect(() => {
    const checkTravel = () => {
      for (const event of calendarEvents) {
        const alert = calendarService.calculateTravelTime(new Date(event.start));
        if (alert) {
          setTravelAlert(alert.message);
          setTimeout(() => setTravelAlert(null), 30000);
          break;
        }
      }
    };

    const interval = setInterval(checkTravel, 60000);
    checkTravel(); // Check immediately
    return () => clearInterval(interval);
  }, [calendarEvents]);

  // ============ DATA FUNCTIONS ============

  const loadData = async () => {
    try {
      const keys = ['@uf/tasks', '@uf/msgs', '@uf/stats', '@uf/ach', '@uf/profile', '@uf/onb', '@uf/memory', '@uf/contexts', '@uf/thoughts', '@uf/bcs', '@uf/sbkey', '@uf/completions'];
      const results = await AsyncStorage.multiGet(keys);
      const data: Record<string, any> = {};
      results.forEach(([key, value]) => { if (value) data[key] = JSON.parse(value); });

      if (data['@uf/tasks']) setTasks(data['@uf/tasks']);
      if (data['@uf/msgs']) setMessages(data['@uf/msgs']);
      if (data['@uf/stats']) {
        const savedStats = data['@uf/stats'];
        const today = new Date().toDateString();
        if (savedStats.lastActiveDate !== today) {
          savedStats.daysActive += 1;
          savedStats.streak = isYesterday(savedStats.lastActiveDate) ? savedStats.streak + 1 : 1;
          savedStats.lastActiveDate = today;
        }
        savedStats.sessionStart = Date.now();
        setStats(savedStats);
      }
      if (data['@uf/ach']) setAchievements(data['@uf/ach']);
      if (data['@uf/memory']) setNeroMemory(data['@uf/memory']);
      if (data['@uf/contexts']) setSavedContexts(data['@uf/contexts']);
      if (data['@uf/thoughts']) setThoughtDumps(data['@uf/thoughts']);
      if (data['@uf/bcs']) setBreadcrumbs(data['@uf/bcs']);
      if (data['@uf/sbkey']) setSupabaseKey(data['@uf/sbkey']);
      if (data['@uf/profile']) setProfile(data['@uf/profile']);
      if (data['@uf/completions']) {
        setCompletionHistory(data['@uf/completions']);
        patternService.setHistory(data['@uf/completions']);
      }

      setScreen(data['@uf/onb'] === true ? 'main' : 'welcome');
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const isYesterday = (dateStr: string) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return dateStr === yesterday.toDateString();
  };

  const save = async (key: string, data: any) => {
    try { await AsyncStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error('Save error:', e); }
  };

  useEffect(() => { save('@uf/tasks', tasks); }, [tasks]);
  useEffect(() => { save('@uf/msgs', messages.slice(-100)); }, [messages]);
  useEffect(() => { save('@uf/stats', stats); }, [stats]);
  useEffect(() => { save('@uf/ach', achievements); }, [achievements]);
  useEffect(() => { save('@uf/memory', neroMemory); }, [neroMemory]);
  useEffect(() => { save('@uf/contexts', savedContexts); }, [savedContexts]);
  useEffect(() => { save('@uf/thoughts', thoughtDumps); }, [thoughtDumps]);
  useEffect(() => { save('@uf/bcs', breadcrumbs.slice(-20)); }, [breadcrumbs]);
  useEffect(() => { save('@uf/profile', profile); }, [profile]);
  useEffect(() => { if (supabaseKey) save('@uf/sbkey', supabaseKey); }, [supabaseKey]);
  useEffect(() => { save('@uf/completions', completionHistory.slice(-500)); }, [completionHistory]);

  const requestNotificationPermission = async () => {
    const granted = await notificationService.requestPermission();
    if (granted) {
      setProfile(p => ({ ...p, notificationsEnabled: true }));
    }
  };

  const loadCalendarEvents = async () => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const events = await calendarService.getEvents(now, endOfDay);
    setCalendarEvents(events);
  };

  // ============ ACHIEVEMENT SYSTEM ============

  const checkAchievements = (newStats: typeof stats) => {
    const hour = new Date().getHours();
    const conditions: Record<string, boolean> = {
      first_task: newStats.tasksCompleted >= 1,
      five_tasks: newStats.tasksCompleted >= 5,
      ten_tasks: newStats.tasksCompleted >= 10,
      twenty_five: newStats.tasksCompleted >= 25,
      fifty_tasks: newStats.tasksCompleted >= 50,
      first_chat: newStats.messagesSent >= 1,
      ten_chats: newStats.messagesSent >= 10,
      low_energy_win: newStats.lowEnergyWins >= 1,
      micro_win: newStats.microSteps >= 1,
      breakdown_master: newStats.tasksBreakdown >= 3,
      context_keeper: newStats.contextsSaved >= 1,
      thought_dumper: newStats.thoughtsDumped >= 5,
      comeback_kid: newStats.daysActive >= 2,
      early_bird: hour < 9 && newStats.tasksCompleted > 0,
      night_owl: hour >= 22 && newStats.tasksCompleted > 0,
      calendar_pro: profile.calendarConnected,
      sync_master: !!supabaseKey,
      week_warrior: newStats.daysActive >= 7,
    };

    for (const ach of ACHIEVEMENTS) {
      if (conditions[ach.id] && !achievements.includes(ach.id)) {
        setAchievements(prev => [...prev, ach.id]);
        setShowAch(ach);
        setStats(s => ({ ...s, totalPoints: s.totalPoints + ach.points }));
        setTimeout(() => setShowAch(null), 3500);
        break;
      }
    }
  };

  // ============ TASK FUNCTIONS ============

  const addBreadcrumb = (text: string) => {
    const bc: Breadcrumb = { id: genId(), text, timestamp: new Date().toISOString() };
    setBreadcrumbs(prev => [...prev.slice(-19), bc]);
  };

  const addTask = (title?: string, taskEnergy?: EnergyLevel, isMicro?: boolean, parentId?: string) => {
    const taskTitle = title || newTask;
    if (!taskTitle.trim()) return;

    const task: Task = {
      id: genId(),
      title: taskTitle.trim(),
      energy: taskEnergy || newEnergy,
      completed: false,
      isMicroStep: isMicro || false,
      parentId,
      createdAt: new Date().toISOString(),
      synced: false,
    };

    if (parentId) {
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === parentId);
        const newTasks = [...prev];
        newTasks.splice(idx + 1, 0, task);
        return newTasks;
      });
    } else {
      setTasks(prev => [task, ...prev]);
    }

    addBreadcrumb(`Added: ${taskTitle.slice(0, 30)}`);
    if (!title) { setNewTask(''); setShowAdd(false); }

    // Schedule notification reminder
    if (profile.notificationsEnabled) {
      notificationService.scheduleVariableReminder(taskTitle);
    }
  };

  const completeTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.completed) return;

    // Calculate completion time if task has createdAt
    const completedAt = new Date().toISOString();
    const completionTimeMs = task.createdAt ? Date.now() - new Date(task.createdAt).getTime() : undefined;

    // Update task as completed
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completedAt, completionTimeMs } : t));

    // Record completion for pattern analysis
    const completedTask = { ...task, completedAt, completionTimeMs };
    const record = patternService.recordCompletion(completedTask);
    setCompletionHistory(prev => [...prev, record]);

    // Update insights
    const newInsights = patternService.generateInsights(profile, energy, tasks);
    setWeeklyInsights(newInsights);

    const newStats = {
      ...stats,
      tasksCompleted: stats.tasksCompleted + 1,
      lowEnergyWins: (energy === 'low' || task.energy === 'low') ? stats.lowEnergyWins + 1 : stats.lowEnergyWins,
      microSteps: task.isMicroStep ? stats.microSteps + 1 : stats.microSteps,
    };
    setStats(newStats);
    checkAchievements(newStats);

    // Celebration
    setCelebText(CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]);
    setShowCeleb(true);
    Animated.sequence([
      Animated.timing(celebAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(celebAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setShowCeleb(false));

    // Surprise reward (10% chance)
    if (Math.random() < 0.1) {
      const reward = SURPRISES[Math.floor(Math.random() * SURPRISES.length)];
      setTimeout(() => {
        setCelebText(`${reward.emoji} ${reward.msg}`);
        setShowCeleb(true);
        Animated.sequence([
          Animated.timing(celebAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(2000),
          Animated.timing(celebAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => setShowCeleb(false));
      }, 2000);
    }

    addBreadcrumb(`✓ ${task.title.slice(0, 30)}`);
  };

  const breakdownTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const microSteps = [
      `Just open/look at: ${task.title.slice(0, 20)}`,
      `Do the tiniest first part`,
      `Continue for 2 more minutes`,
    ];

    microSteps.forEach((step, i) => {
      setTimeout(() => addTask(step, 'low', true, id), i * 100);
    });

    const newStats = { ...stats, tasksBreakdown: stats.tasksBreakdown + 1 };
    setStats(newStats);
    checkAchievements(newStats);
    addBreadcrumb(`🔨 Broke down: ${task.title.slice(0, 25)}`);
  };

  // ============ MESSAGE FUNCTIONS ============

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: genId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    const userInput = input;
    setInput('');
    setTyping(true);
    if (profile.thinkingMode !== 'off') setThinkingText('Thinking...');

    const newStats = { ...stats, messagesSent: stats.messagesSent + 1 };
    setStats(newStats);
    checkAchievements(newStats);

    const detectedEnergy = detectEnergy(userInput);
    if (detectedEnergy) setEnergy(detectedEnergy);

    const extracted = extractTasks(userInput);
    if (extracted.length > 0) {
      setExtractedTasks(extracted);
      setShowExtracted(true);
    }

    addBreadcrumb(`You: ${userInput.slice(0, 35)}`);

    if (profile.thinkingMode === 'full') {
      setThinkingText('Analyzing your message...');
      await new Promise(r => setTimeout(r, 500));
      setThinkingText('Checking your tasks and energy...');
      await new Promise(r => setTimeout(r, 500));
      setThinkingText('Crafting response...');
    }

    const response = await callClaudeAPI(
      [...messages, userMsg],
      profile.personality,
      energy,
      tasks,
      neroMemory,
      profile.apiKey
    );

    setThinkingText('');
    setTyping(false);

    const neroMsg: Message = {
      id: genId(),
      role: 'nero',
      content: response.content,
      model: response.model,
      thinking: response.thinking,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, neroMsg]);
    addBreadcrumb(`${profile.neroName}: ${response.content.slice(0, 35)}`);
  };

  // ============ CONTEXT FUNCTIONS ============

  const saveContext = () => {
    if (!ctxLabel.trim()) return;

    const ctx: SavedContext = {
      id: genId(),
      label: ctxLabel.trim(),
      tasks: tasks.filter(t => !t.completed).slice(0, 5).map(t => t.title),
      breadcrumbs: breadcrumbs.slice(-5).map(b => b.text),
      energy,
      timestamp: new Date().toISOString(),
    };

    setSavedContexts(prev => [ctx, ...prev.slice(0, 9)]);
    const newStats = { ...stats, contextsSaved: stats.contextsSaved + 1 };
    setStats(newStats);
    checkAchievements(newStats);
    addBreadcrumb(`📌 Saved: ${ctxLabel}`);
    setCtxLabel('');
    setShowCtx(false);
  };

  const restoreContext = (ctx: SavedContext) => {
    if (ctx.energy) setEnergy(ctx.energy);
    addBreadcrumb(`📌 Restored: ${ctx.label}`);
    setShowContexts(false);

    const msg: Message = {
      id: genId(),
      role: 'nero',
      content: `Welcome back! I restored your context: "${ctx.label}". You were working on: ${ctx.tasks.slice(0, 2).join(', ') || 'nothing specific'}. Ready to continue?`,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
  };

  const dumpThought = () => {
    if (!thought.trim()) return;

    const dump: ThoughtDump = {
      id: genId(),
      text: thought.trim(),
      timestamp: new Date().toISOString(),
      processed: false,
    };

    setThoughtDumps(prev => [dump, ...prev]);
    const newStats = { ...stats, thoughtsDumped: stats.thoughtsDumped + 1 };
    setStats(newStats);
    checkAchievements(newStats);
    addBreadcrumb(`💭 ${thought.slice(0, 30)}`);
    setThought('');
    setShowThought(false);
  };

  // ============ SYNC FUNCTIONS ============

  const syncToCloud = async () => {
    if (!supabaseKey) {
      Alert.alert('Setup Required', 'Please add your Supabase anon key in settings.');
      return;
    }

    setSyncing(true);
    try {
      const supabase = new SupabaseService(SUPABASE_URL, supabaseKey);
      const userId = profile.id || genId();

      if (!profile.id) {
        setProfile(p => ({ ...p, id: userId }));
      }

      await supabase.syncTasks(userId, tasks);
      await supabase.syncProfile({ ...profile, id: userId });

      setTasks(prev => prev.map(t => ({ ...t, synced: true })));
      setProfile(p => ({ ...p, lastSync: new Date().toISOString() }));

      const newStats = { ...stats };
      checkAchievements(newStats);

      Alert.alert('Synced!', 'Your data has been saved to the cloud ☁️');
    } catch (error) {
      Alert.alert('Sync Error', 'Could not connect to cloud. Check your Supabase key.');
    } finally {
      setSyncing(false);
      setShowSync(false);
    }
  };

  // ============ VOICE INPUT ============

  const startVoiceInput = () => {
    setListening(true);
    // Simulated for web - in native app would use expo-speech
    setTimeout(() => {
      const samples = [
        "I need to finish that report today",
        "Remind me to call mom",
        "I'm feeling pretty tired today",
        "What should I focus on?",
      ];
      setInput(samples[Math.floor(Math.random() * samples.length)]);
      setListening(false);
    }, 2000);
  };

  // ============ ONBOARDING ============

  const finishOnboarding = async () => {
    await AsyncStorage.setItem('@uf/onb', JSON.stringify(true));
    setScreen('main');

    const greeting = PERSONALITIES[profile.personality].greetings[Math.floor(Math.random() * PERSONALITIES[profile.personality].greetings.length)];
    const welcomeMsg: Message = {
      id: genId(),
      role: 'nero',
      content: profile.name
        ? `${greeting} Great to meet you, ${profile.name}! I'm ${profile.neroName}, your ADHD companion. What's on your mind?`
        : `${greeting} I'm ${profile.neroName}, your ADHD companion. Ready to help whenever you are!`,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMsg]);
  };

  // ============ RENDER ============

  if (loading) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={S.loadText}>Loading UnFocused...</Text>
      </View>
    );
  }

  // WELCOME SCREEN
  if (screen === 'welcome') {
    return (
      <SafeAreaView style={S.container}>
        <StatusBar style="light" />
        <View style={S.welcomeC}>
          <Text style={S.logo}>🧠</Text>
          <Text style={S.title}>UnFocused</Text>
          <Text style={S.subtitle}>Your AI Companion for the ADHD Brain</Text>

          <View style={S.card}>
            <Text style={S.cardQ}>How much do you want to tell me?</Text>

            {[
              { k: 'skip', e: '🚀', t: "Let's just start", d: "I'll learn as we go" },
              { k: 'quick', e: '💬', t: 'A few quick questions', d: '~1 minute setup' },
              { k: 'deep', e: '🎯', t: 'Deep dive', d: 'Hit the ground running' },
            ].map(o => (
              <TouchableOpacity
                key={o.k}
                style={S.opt}
                onPress={() => {
                  if (o.k === 'skip') finishOnboarding();
                  else { setOnbStep(0); setScreen('onboarding'); }
                }}
              >
                <Text style={S.optE}>{o.e}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.optT}>{o.t}</Text>
                  <Text style={S.optD}>{o.d}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ONBOARDING SCREEN
  if (screen === 'onboarding') {
    const questions = [
      { q: "What should I call you?", type: 'name' },
      { q: "What's your biggest ADHD struggle?", type: 'struggle' },
      { q: "When do you usually have the most energy?", type: 'energy' },
      { q: "How should I talk to you?", type: 'personality' },
    ];
    const current = questions[onbStep];

    return (
      <SafeAreaView style={S.container}>
        <StatusBar style="light" />
        <View style={S.onbC}>
          <View style={S.prog}>
            <View style={[S.progFill, { width: `${((onbStep + 1) / questions.length) * 100}%` }]} />
          </View>

          <Text style={S.onbQ}>{current.q}</Text>

          {current.type === 'name' && (
            <TextInput
              style={S.onbIn}
              value={profile.name}
              onChangeText={(t) => setProfile(p => ({ ...p, name: t }))}
              placeholder="Your name (optional)"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
          )}

          {current.type === 'struggle' && (
            <View style={S.optsCol}>
              {['Starting tasks', 'Staying focused', 'Remembering things', 'Time management'].map(opt => (
                <TouchableOpacity key={opt} style={S.onbOpt} onPress={() => setOnbStep(s => s + 1)}>
                  <Text style={S.onbOptT}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {current.type === 'energy' && (
            <View style={S.optsCol}>
              {['Morning ☀️', 'Afternoon 🌤️', 'Evening 🌙', 'Unpredictable 🎲'].map(opt => (
                <TouchableOpacity key={opt} style={S.onbOpt} onPress={() => setOnbStep(s => s + 1)}>
                  <Text style={S.onbOptT}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {current.type === 'personality' && (
            <View style={S.optsCol}>
              {Object.entries(PERSONALITIES).slice(0, 4).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[S.onbOpt, profile.personality === key && S.onbOptSel]}
                  onPress={() => setProfile(p => ({ ...p, personality: key as Personality }))}
                >
                  <Text style={S.onbOptT}>{val.emoji} {val.name}</Text>
                  <Text style={S.onbOptD}>{val.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={S.onbBtns}>
            {onbStep > 0 && (
              <TouchableOpacity style={S.backBtn} onPress={() => setOnbStep(s => s - 1)}>
                <Text style={S.backBtnT}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={S.nextBtn}
              onPress={() => {
                if (onbStep < questions.length - 1) setOnbStep(s => s + 1);
                else finishOnboarding();
              }}
            >
              <Text style={S.nextBtnT}>
                {onbStep === questions.length - 1 ? "Let's go! 🚀" : 'Continue'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={S.skipBtn} onPress={finishOnboarding}>
            <Text style={S.skipBtnT}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // SETTINGS SCREEN
  if (screen === 'settings') {
    return (
      <SafeAreaView style={S.container}>
        <StatusBar style="light" />
        <View style={S.setHead}>
          <TouchableOpacity onPress={() => setScreen('main')}>
            <Text style={S.setBack}>← Back</Text>
          </TouchableOpacity>
          <Text style={S.setTitle}>Settings</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={S.setCont}>
          {/* Personality */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>{profile.neroName}'s Personality</Text>
            {Object.entries(PERSONALITIES).map(([key, val]) => (
              <TouchableOpacity
                key={key}
                style={[S.setOpt, profile.personality === key && S.setOptSel]}
                onPress={() => setProfile(p => ({ ...p, personality: key as Personality }))}
              >
                <Text style={S.setOptE}>{val.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.setOptT}>{val.name}</Text>
                  <Text style={S.setOptD}>{val.desc}</Text>
                </View>
                {profile.personality === key && <Text style={S.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Companion Name */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>Companion Name</Text>
            <TextInput
              style={S.setIn}
              value={profile.neroName}
              onChangeText={(t) => setProfile(p => ({ ...p, neroName: t }))}
              placeholder="AI companion name"
              placeholderTextColor={C.textMuted}
            />
          </View>

          {/* Notifications */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>🔔 Notifications</Text>
            <View style={S.setRow}>
              <Text style={S.setOptT}>Enable Notifications</Text>
              <Switch
                value={profile.notificationsEnabled}
                onValueChange={(v) => {
                  setProfile(p => ({ ...p, notificationsEnabled: v }));
                  notificationService.setEnabled(v);
                }}
                trackColor={{ true: C.primary }}
              />
            </View>
            {profile.notificationsEnabled && (
              <>
                <Text style={[S.setOptD, { marginTop: 12, marginBottom: 8 }]}>Notification Style:</Text>
                {(['gentle', 'variable', 'persistent'] as NotificationStyle[]).map(style => (
                  <TouchableOpacity
                    key={style}
                    style={[S.setOpt, profile.notificationStyle === style && S.setOptSel]}
                    onPress={() => {
                      setProfile(p => ({ ...p, notificationStyle: style }));
                      notificationService.setStyle(style);
                    }}
                  >
                    <Text style={S.setOptT}>
                      {style === 'gentle' ? '🌸 Gentle' : style === 'variable' ? '🎲 Variable' : '💪 Persistent'}
                    </Text>
                    <Text style={S.setOptD}>
                      {style === 'gentle' ? 'Soft, kind reminders' : style === 'variable' ? 'Random timing (harder to ignore!)' : 'Regular, firm reminders'}
                    </Text>
                    {profile.notificationStyle === style && <Text style={S.check}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* Calendar */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>📅 Calendar Integration</Text>
            <TouchableOpacity
              style={[S.setOpt, profile.calendarConnected && S.setOptSel]}
              onPress={() => {
                setProfile(p => ({ ...p, calendarConnected: !p.calendarConnected }));
                if (!profile.calendarConnected) {
                  loadCalendarEvents();
                  const newStats = { ...stats };
                  checkAchievements(newStats);
                }
              }}
            >
              <Text style={S.setOptE}>{profile.calendarConnected ? '✓' : '○'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.setOptT}>{profile.calendarConnected ? 'Calendar Connected' : 'Connect Calendar'}</Text>
                <Text style={S.setOptD}>See events in Timeline, get travel alerts</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cloud Sync */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>☁️ Cloud Sync (Supabase)</Text>
            <Text style={[S.setOptD, { marginBottom: 8 }]}>Sync your data across devices</Text>
            <TextInput
              style={S.setIn}
              value={supabaseKey}
              onChangeText={setSupabaseKey}
              placeholder="Supabase anon key"
              placeholderTextColor={C.textMuted}
              secureTextEntry
            />
            {supabaseKey && (
              <TouchableOpacity style={[S.syncBtn, syncing && { opacity: 0.5 }]} onPress={syncToCloud} disabled={syncing}>
                <Text style={S.syncBtnT}>{syncing ? 'Syncing...' : '☁️ Sync Now'}</Text>
              </TouchableOpacity>
            )}
            {profile.lastSync && (
              <Text style={S.lastSync}>Last sync: {formatDate(new Date(profile.lastSync))}</Text>
            )}
          </View>

          {/* Claude API */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>🧠 Claude API Key (Optional)</Text>
            <Text style={[S.setOptD, { marginBottom: 8 }]}>For smarter, personalized responses</Text>
            <TextInput
              style={S.setIn}
              value={profile.apiKey}
              onChangeText={(t) => setProfile(p => ({ ...p, apiKey: t }))}
              placeholder="sk-ant-..."
              placeholderTextColor={C.textMuted}
              secureTextEntry
            />
          </View>

          {/* AI Thinking Mode */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>AI Thinking Display</Text>
            {(['off', 'minimal', 'full'] as ThinkingMode[]).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[S.setOpt, profile.thinkingMode === mode && S.setOptSel]}
                onPress={() => setProfile(p => ({ ...p, thinkingMode: mode }))}
              >
                <Text style={S.setOptT}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                {profile.thinkingMode === mode && <Text style={S.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>

          {/* Stats */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>Your Stats</Text>
            <View style={S.statsG}>
              <View style={S.statI}><Text style={S.statV}>{stats.tasksCompleted}</Text><Text style={S.statL}>Tasks Done</Text></View>
              <View style={S.statI}><Text style={S.statV}>{stats.messagesSent}</Text><Text style={S.statL}>Messages</Text></View>
              <View style={S.statI}><Text style={S.statV}>{stats.totalPoints}</Text><Text style={S.statL}>Points</Text></View>
              <View style={S.statI}><Text style={S.statV}>{stats.daysActive}</Text><Text style={S.statL}>Days Active</Text></View>
              <View style={S.statI}><Text style={S.statV}>{stats.streak}</Text><Text style={S.statL}>Day Streak</Text></View>
              <View style={S.statI}><Text style={S.statV}>{achievements.length}/{ACHIEVEMENTS.length}</Text><Text style={S.statL}>Achievements</Text></View>
            </View>
          </View>

          {/* Data Reset */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>Data</Text>
            <TouchableOpacity style={S.dangerBtn} onPress={async () => {
              await AsyncStorage.clear();
              setScreen('welcome');
            }}>
              <Text style={S.dangerBtnT}>Reset All Data</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 50 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============ MAIN APP ============
  const pendingTasks = tasks.filter(t => !t.completed);
  const filteredTasks = filter === 'all' ? pendingTasks : pendingTasks.filter(t => t.energy === filter);
  const nextTask = pendingTasks[0];
  const completedToday = tasks.filter(t => t.completed && new Date(t.createdAt).toDateString() === new Date().toDateString()).length;

  return (
    <SafeAreaView style={S.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* HEADER */}
        <View style={S.head}>
          <View style={S.headL}>
            <Text style={S.headT}>{profile.neroName}</Text>
            {energy && (
              <View style={[S.eBadge, { backgroundColor: getEC(energy) }]}>
                <Text style={S.eBadgeT}>{getEE(energy)} {energy}</Text>
              </View>
            )}
          </View>
          <View style={S.headR}>
            {supabaseKey && (
              <TouchableOpacity style={S.headBtn} onPress={syncToCloud}>
                <Text>{syncing ? '⏳' : '☁️'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={S.headBtn} onPress={() => setShowContexts(true)}>
              <Text>📌</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.headBtn} onPress={() => setScreen('settings')}>
              <Text>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TRAVEL ALERT */}
        {travelAlert && (
          <View style={S.travelAlert}>
            <Text style={S.travelAlertT}>🚗 {travelAlert}</Text>
          </View>
        )}

        {/* ENERGY SELECTOR */}
        {!energy && (
          <View style={S.eSel}>
            <Text style={S.eSelT}>How's your energy right now?</Text>
            <View style={S.eOpts}>
              {(['low', 'medium', 'high'] as EnergyLevel[]).map(e => (
                <TouchableOpacity
                  key={e}
                  style={[S.eOpt, { borderColor: getEC(e) }]}
                  onPress={() => setEnergy(e)}
                >
                  <Text style={S.eOptT}>{getEE(e)} {e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* BREADCRUMBS */}
        {breadcrumbs.length > 0 && view !== 'minimal' && (
          <ScrollView horizontal style={S.bcs} showsHorizontalScrollIndicator={false}>
            {breadcrumbs.slice(-5).map(bc => (
              <View key={bc.id} style={S.bc}>
                <Text style={S.bcT}>{bc.text}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* MAIN CONTENT */}
        <View style={S.main}>

          {/* CONVERSATION VIEW */}
          {view === 'conversation' && (
            <>
              <ScrollView
                ref={scrollRef}
                style={S.msgs}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd()}
              >
                {messages.map(msg => (
                  <View key={msg.id} style={[S.msg, msg.role === 'user' ? S.msgU : S.msgN]}>
                    <Text style={S.msgT}>{msg.content}</Text>
                    {msg.model && profile.thinkingMode !== 'off' && (
                      <Text style={S.modelBadge}>
                        {msg.model === 'claude-sonnet' ? '🧠' : msg.model === 'local' ? '💭' : '⚡'}
                      </Text>
                    )}
                  </View>
                ))}
                {typing && (
                  <View style={[S.msg, S.msgN]}>
                    <Text style={S.msgT}>{thinkingText || '...'}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={S.inC}>
                <View style={S.inR}>
                  <TouchableOpacity
                    style={[S.iconBtn, listening && S.iconBtnA]}
                    onPress={startVoiceInput}
                  >
                    <Text>{listening ? '🔴' : '🎤'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.iconBtn} onPress={() => setShowThought(true)}>
                    <Text>💭</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.iconBtn} onPress={() => setShowCtx(true)}>
                    <Text>📌</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={S.tIn}
                    value={input}
                    onChangeText={setInput}
                    placeholder={`Talk to ${profile.neroName}...`}
                    placeholderTextColor={C.textMuted}
                    multiline
                    onSubmitEditing={sendMessage}
                  />
                  <TouchableOpacity style={S.sendBtn} onPress={sendMessage} disabled={typing}>
                    <Text style={S.sendBtnT}>{typing ? '...' : '→'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* ONE THING VIEW */}
          {view === 'oneThing' && (
            <View style={S.oneC}>
              {nextTask ? (
                <>
                  <Text style={S.oneL}>Your ONE thing right now:</Text>
                  <View style={S.oneCard}>
                    <View style={[S.eDot, { backgroundColor: getEC(nextTask.energy) }]} />
                    <Text style={S.oneT}>{nextTask.title}</Text>
                    {nextTask.isMicroStep && <Text style={S.microB}>✨ micro-step</Text>}
                  </View>

                  <View style={S.oneActs}>
                    <TouchableOpacity style={S.oneDone} onPress={() => completeTask(nextTask.id)}>
                      <Text style={S.oneDoneT}>✓ Done!</Text>
                    </TouchableOpacity>
                    {!nextTask.isMicroStep && (
                      <TouchableOpacity style={S.oneBreak} onPress={() => breakdownTask(nextTask.id)}>
                        <Text style={S.oneBreakT}>🔨 Too big? Break it down</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={S.microStarts}>
                    <Text style={S.microStartsT}>Tiny starts:</Text>
                    {MICRO_STARTS.slice(0, 3).map((start, i) => (
                      <TouchableOpacity key={i} style={S.microStartO}>
                        <Text style={S.microStartT}>{start}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <View style={S.empty}>
                  <Text style={S.emptyE}>🎉</Text>
                  <Text style={S.emptyT}>All clear! You crushed it.</Text>
                  <Text style={S.emptyS}>Add a task when you're ready.</Text>
                  <TouchableOpacity style={S.addTaskBtn} onPress={() => setShowAdd(true)}>
                    <Text style={S.addTaskBtnT}>+ Add Task</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* LIST VIEW */}
          {view === 'list' && (
            <View style={S.listC}>
              <View style={S.listH}>
                <Text style={S.listT}>Tasks ({filteredTasks.length})</Text>
                <TouchableOpacity style={S.addBtn} onPress={() => setShowAdd(true)}>
                  <Text style={S.addBtnT}>+ Add</Text>
                </TouchableOpacity>
              </View>

              <View style={S.filterR}>
                {(['all', 'low', 'medium', 'high'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[S.filterBtn, filter === f && S.filterBtnA]}
                    onPress={() => setFilter(f)}
                  >
                    <Text style={[S.filterBtnT, filter === f && S.filterBtnTA]}>
                      {f === 'all' ? 'All' : getEE(f)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ScrollView style={S.taskList}>
                {filteredTasks.map(task => (
                  <View key={task.id} style={[S.taskI, task.isMicroStep && S.taskIMicro]}>
                    <TouchableOpacity
                      style={[S.chk, task.completed && S.chkD]}
                      onPress={() => completeTask(task.id)}
                    >
                      {task.completed && <Text style={S.chkT}>✓</Text>}
                    </TouchableOpacity>
                    <View style={[S.taskE, { backgroundColor: getEC(task.energy) }]} />
                    <Text style={[S.taskT, task.completed && S.taskTD]} numberOfLines={2}>
                      {task.title}
                    </Text>
                    {task.isMicroStep && <Text style={S.microL}>✨</Text>}
                    {!task.isMicroStep && (
                      <TouchableOpacity onPress={() => breakdownTask(task.id)}>
                        <Text style={S.taskA}>🔨</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setTasks(p => p.filter(t => t.id !== task.id))}>
                      <Text style={S.taskA}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {filteredTasks.length === 0 && (
                  <View style={S.emptyList}>
                    <Text style={S.emptyListT}>No tasks here! 🎉</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* TIMELINE VIEW */}
          {view === 'timeline' && (
            <ScrollView style={S.timeC}>
              <Text style={S.timeTitle}>Today's Flow</Text>
              <Text style={S.timeSubtitle}>{completedToday} tasks completed • {calendarEvents.length} events</Text>

              {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map(hour => {
                const now = new Date();
                const isNow = now.getHours() === hour;
                const isPast = now.getHours() > hour;
                const event = calendarEvents.find(e => {
                  const start = new Date(e.start).getHours();
                  return start === hour;
                });

                return (
                  <View key={hour} style={S.timeH}>
                    <Text style={[S.timeTm, isPast && S.timeTmPast]}>
                      {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
                    </Text>
                    <View style={[S.timeSlot, isNow && S.timeSlotNow, event && { backgroundColor: event.color || C.primary + '40' }]}>
                      {isNow && <View style={S.curLine} />}
                      {event && <Text style={S.timeEventT}>{event.title}</Text>}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* DASHBOARD VIEW */}
          {view === 'dashboard' && (
            <ScrollView style={S.dashC}>
              <Text style={S.dashT}>Your Progress</Text>

              <View style={S.dashStats}>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.tasksCompleted}</Text>
                  <Text style={S.dashSL}>Tasks Done</Text>
                </View>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.totalPoints}</Text>
                  <Text style={S.dashSL}>Points</Text>
                </View>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.streak}</Text>
                  <Text style={S.dashSL}>Day Streak</Text>
                </View>
              </View>

              <View style={S.dashStats}>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.daysActive}</Text>
                  <Text style={S.dashSL}>Days Active</Text>
                </View>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.lowEnergyWins}</Text>
                  <Text style={S.dashSL}>Low E Wins</Text>
                </View>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{completedToday}</Text>
                  <Text style={S.dashSL}>Today</Text>
                </View>
              </View>

              {/* AI Pattern Analysis Section */}
              <View style={S.patternSection}>
                <Text style={S.patternTitle}>🧠 AI Pattern Analysis</Text>
                
                {/* Peak Hours */}
                <View style={S.insightCard}>
                  <Text style={S.insightEmoji}>⚡</Text>
                  <View style={S.insightContent}>
                    <Text style={S.insightTitle}>Your Peak Hours</Text>
                    <Text style={S.insightText}>
                      {patternService.getPeakHours().map(h => {
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        const hour12 = h % 12 || 12;
                        return `${hour12}${ampm}`;
                      }).join(', ') || 'Start completing tasks to see patterns!'}
                    </Text>
                  </View>
                </View>

                {/* Productivity Chart */}
                <View style={S.chartContainer}>
                  <Text style={S.chartTitle}>Hourly Productivity</Text>
                  <View style={S.chartBars}>
                    {patternService.getHourlyStats().filter(h => h.hour >= 6 && h.hour <= 22).map(hourData => {
                      const maxCompletions = Math.max(...patternService.getHourlyStats().map(h => h.completions), 1);
                      const height = (hourData.completions / maxCompletions) * 60;
                      const isPeak = patternService.getPeakHours().includes(hourData.hour);
                      return (
                        <View key={hourData.hour} style={S.chartBarWrapper}>
                          <View style={[S.chartBar, { height: Math.max(height, 4), backgroundColor: isPeak ? C.gold : C.primary }]} />
                          <Text style={S.chartLabel}>{hourData.hour % 12 || 12}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {/* Weekly Trend */}
                <View style={S.insightCard}>
                  <Text style={S.insightEmoji}>
                    {patternService.getWeeklyTrend() === 'improving' ? '📈' : patternService.getWeeklyTrend() === 'declining' ? '📉' : '➡️'}
                  </Text>
                  <View style={S.insightContent}>
                    <Text style={S.insightTitle}>Weekly Trend</Text>
                    <Text style={S.insightText}>
                      {patternService.getWeeklyTrend() === 'improving' 
                        ? "You're crushing it! More done than last week! 🎉" 
                        : patternService.getWeeklyTrend() === 'declining'
                        ? "Slower week - that's okay! Be gentle with yourself. 💙"
                        : "Steady pace - consistency is your superpower! ✨"}
                    </Text>
                  </View>
                </View>

                {/* AI Generated Insight */}
                <TouchableOpacity 
                  style={S.aiInsightCard}
                  onPress={async () => {
                    setLoadingInsight(true);
                    const patterns = patternService.getPatternData();
                    const insight = await patternService.generateAIInsights(profile.apiKey, patterns, profile);
                    setAiInsight(insight);
                    setLoadingInsight(false);
                  }}
                >
                  <Text style={S.aiInsightEmoji}>🤖</Text>
                  <View style={S.aiInsightContent}>
                    <Text style={S.aiInsightTitle}>
                      {loadingInsight ? 'Analyzing your patterns...' : 'Nero\'s Insight'}
                    </Text>
                    <Text style={S.aiInsightText}>
                      {loadingInsight ? '⏳' : aiInsight || 'Tap for a personalized AI insight about your productivity patterns!'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Weekly Insights */}
                {weeklyInsights.length > 0 && (
                  <>
                    <Text style={[S.achT, { marginTop: 16 }]}>💡 Insights for You</Text>
                    {weeklyInsights.slice(0, 3).map(insight => (
                      <View key={insight.id} style={S.insightCard}>
                        <Text style={S.insightEmoji}>{insight.emoji}</Text>
                        <View style={S.insightContent}>
                          <Text style={S.insightTitle}>{insight.title}</Text>
                          <Text style={S.insightText}>{insight.message}</Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </View>

              <Text style={S.achT}>Achievements ({achievements.length}/{ACHIEVEMENTS.length})</Text>
              <View style={S.achG}>
                {ACHIEVEMENTS.map(a => {
                  const unlocked = achievements.includes(a.id);
                  return (
                    <View key={a.id} style={[S.achI, !unlocked && S.achIL]}>
                      <Text style={S.achE}>{unlocked ? a.emoji : '🔒'}</Text>
                      <Text style={S.achN}>{a.name}</Text>
                      <Text style={S.achP}>{a.points} pts</Text>
                    </View>
                  );
                })}
              </View>

              {thoughtDumps.length > 0 && (
                <>
                  <Text style={[S.achT, { marginTop: 24 }]}>Recent Thoughts ({thoughtDumps.length})</Text>
                  {thoughtDumps.slice(0, 5).map(t => (
                    <View key={t.id} style={S.thoughtI}>
                      <Text style={S.thoughtT}>{t.text}</Text>
                      <Text style={S.thoughtD}>{formatDate(new Date(t.timestamp))}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {/* MINIMAL VIEW */}
          {view === 'minimal' && (
            <View style={S.minC}>
              <Text style={S.minG}>Hey{profile.name ? `, ${profile.name}` : ''} 💙</Text>
              <Text style={S.minM}>Take it easy. One tiny thing when you're ready.</Text>

              {nextTask && (
                <TouchableOpacity style={S.minTask} onPress={() => completeTask(nextTask.id)}>
                  <Text style={S.minTaskT}>{nextTask.title}</Text>
                  <Text style={S.minTaskH}>Tap when done</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={S.minEnergy} onPress={() => setEnergy(null)}>
                <Text style={S.minEnergyT}>Change energy</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* BOTTOM NAV */}
        <View style={S.nav}>
          {Object.entries(VIEWS).map(([key, val]) => (
            <TouchableOpacity
              key={key}
              style={[S.navI, view === key && S.navIA]}
              onPress={() => setView(key as ViewMode)}
            >
              <Text style={S.navE}>{val.emoji}</Text>
              <Text style={[S.navL, view === key && S.navLA]}>{val.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ============ MODALS ============ */}

        {/* Add Task Modal */}
        <Modal visible={showAdd} transparent animationType="slide">
          <View style={S.mO}>
            <View style={S.mC}>
              <Text style={S.mT}>Add Task</Text>
              <TextInput
                style={S.mIn}
                value={newTask}
                onChangeText={setNewTask}
                placeholder="What needs to be done?"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
              <Text style={S.mL}>Energy needed:</Text>
              <View style={S.ePick}>
                {(['low', 'medium', 'high'] as EnergyLevel[]).map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[S.ePickO, newEnergy === e && { borderColor: getEC(e), backgroundColor: getEC(e) + '20' }]}
                    onPress={() => setNewEnergy(e)}
                  >
                    <Text style={S.ePickT}>{getEE(e)} {e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={S.mBtns}>
                <TouchableOpacity style={S.mCancel} onPress={() => setShowAdd(false)}>
                  <Text style={S.mCancelT}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.mConfirm} onPress={() => addTask()}>
                  <Text style={S.mConfirmT}>Add Task</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Thought Dump Modal */}
        <Modal visible={showThought} transparent animationType="slide">
          <View style={S.mO}>
            <View style={S.mC}>
              <Text style={S.mT}>💭 Quick Thought Dump</Text>
              <Text style={S.mSub}>Get it out of your head. Organize later (or never).</Text>
              <TextInput
                style={[S.mIn, { height: 120, textAlignVertical: 'top' }]}
                value={thought}
                onChangeText={setThought}
                placeholder="Whatever's on your mind..."
                placeholderTextColor={C.textMuted}
                multiline
                autoFocus
              />
              <View style={S.mBtns}>
                <TouchableOpacity style={S.mCancel} onPress={() => setShowThought(false)}>
                  <Text style={S.mCancelT}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.mConfirm} onPress={dumpThought}>
                  <Text style={S.mConfirmT}>Dump It!</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Save Context Modal */}
        <Modal visible={showCtx} transparent animationType="slide">
          <View style={S.mO}>
            <View style={S.mC}>
              <Text style={S.mT}>📌 Save Your Place</Text>
              <Text style={S.mSub}>Bookmark where you are so you can come back later.</Text>
              <TextInput
                style={S.mIn}
                value={ctxLabel}
                onChangeText={setCtxLabel}
                placeholder="What were you working on?"
                placeholderTextColor={C.textMuted}
                autoFocus
              />
              <View style={S.mBtns}>
                <TouchableOpacity style={S.mCancel} onPress={() => setShowCtx(false)}>
                  <Text style={S.mCancelT}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={S.mConfirm} onPress={saveContext}>
                  <Text style={S.mConfirmT}>Save Context</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Saved Contexts Modal */}
        <Modal visible={showContexts} transparent animationType="slide">
          <View style={S.mO}>
            <View style={[S.mC, { maxHeight: '80%' }]}>
              <Text style={S.mT}>📌 Saved Contexts</Text>
              <ScrollView style={{ maxHeight: 400 }}>
                {savedContexts.length === 0 ? (
                  <Text style={S.emptyListT}>No saved contexts yet.</Text>
                ) : (
                  savedContexts.map(ctx => (
                    <TouchableOpacity key={ctx.id} style={S.ctxI} onPress={() => restoreContext(ctx)}>
                      <Text style={S.ctxL}>{ctx.label}</Text>
                      <Text style={S.ctxD}>{formatDate(new Date(ctx.timestamp))} • {ctx.tasks.length} tasks</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={S.mCancel} onPress={() => setShowContexts(false)}>
                <Text style={S.mCancelT}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Extracted Tasks Modal */}
        <Modal visible={showExtracted} transparent animationType="slide">
          <View style={S.mO}>
            <View style={S.mC}>
              <Text style={S.mT}>🎯 I noticed some tasks!</Text>
              <Text style={S.mSub}>Want me to add these?</Text>
              {extractedTasks.map((task, i) => (
                <View key={i} style={S.extractedI}>
                  <Text style={S.extractedT}>{task}</Text>
                  <TouchableOpacity onPress={() => {
                    addTask(task, 'medium');
                    setExtractedTasks(prev => prev.filter((_, idx) => idx !== i));
                  }}>
                    <Text style={S.extractedA}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={S.mCancel} onPress={() => { setShowExtracted(false); setExtractedTasks([]); }}>
                <Text style={S.mCancelT}>Skip All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Celebration Overlay */}
        {showCeleb && (
          <Animated.View style={[S.celebO, { opacity: celebAnim, transform: [{ scale: celebAnim }] }]}>
            <Text style={S.celebT}>{celebText}</Text>
          </Animated.View>
        )}

        {/* Achievement Toast */}
        {showAch && (
          <Animated.View style={S.achToast}>
            <Text style={S.achToastE}>{showAch.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.achToastTitle}>Achievement Unlocked!</Text>
              <Text style={S.achToastN}>{showAch.name}</Text>
            </View>
            <Text style={S.achToastP}>+{showAch.points}</Text>
          </Animated.View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============ STYLES ============
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadText: { color: C.text, fontSize: 16, marginTop: 16 },

  // Welcome
  welcomeC: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logo: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 40, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: C.textSec, marginBottom: 48, textAlign: 'center' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  cardQ: { fontSize: 18, fontWeight: '600', color: C.text, marginBottom: 24, textAlign: 'center' },
  opt: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 16, padding: 16, marginBottom: 12 },
  optE: { fontSize: 28, marginRight: 16 },
  optT: { fontSize: 16, fontWeight: '600', color: C.text },
  optD: { fontSize: 14, color: C.textSec, marginTop: 2 },

  // Onboarding
  onbC: { flex: 1, padding: 24, justifyContent: 'center' },
  prog: { height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 48 },
  progFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  onbQ: { fontSize: 26, fontWeight: '600', color: C.text, marginBottom: 32, textAlign: 'center' },
  onbIn: { backgroundColor: C.card, borderRadius: 16, padding: 18, fontSize: 18, color: C.text, marginBottom: 24 },
  optsCol: { gap: 12 },
  onbOpt: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 2, borderColor: 'transparent' },
  onbOptSel: { borderColor: C.primary },
  onbOptT: { fontSize: 16, color: C.text, textAlign: 'center' },
  onbOptD: { fontSize: 14, color: C.textSec, textAlign: 'center', marginTop: 4 },
  onbBtns: { flexDirection: 'row', justifyContent: 'center', marginTop: 48, gap: 16 },
  backBtn: { padding: 18 },
  backBtnT: { color: C.textSec, fontSize: 16 },
  nextBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 36 },
  nextBtnT: { color: C.text, fontSize: 16, fontWeight: '600' },
  skipBtn: { alignItems: 'center', marginTop: 24 },
  skipBtnT: { color: C.textMuted, fontSize: 14 },

  // Settings
  setHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  setBack: { color: C.primary, fontSize: 16 },
  setTitle: { color: C.text, fontSize: 18, fontWeight: '600' },
  setCont: { flex: 1, padding: 16 },
  setSec: { marginBottom: 32 },
  setSecT: { color: C.textSec, fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  setOpt: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 8 },
  setOptSel: { borderWidth: 2, borderColor: C.primary },
  setOptE: { fontSize: 24, marginRight: 14 },
  setOptT: { color: C.text, fontSize: 16, fontWeight: '500', flex: 1 },
  setOptD: { color: C.textSec, fontSize: 13 },
  setIn: { backgroundColor: C.card, borderRadius: 14, padding: 16, fontSize: 16, color: C.text },
  setRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 8 },
  check: { color: C.primary, fontSize: 18, fontWeight: 'bold' },
  statsG: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statI: { backgroundColor: C.card, borderRadius: 14, padding: 18, width: '31%', alignItems: 'center' },
  statV: { color: C.text, fontSize: 24, fontWeight: 'bold' },
  statL: { color: C.textSec, fontSize: 11, marginTop: 4, textAlign: 'center' },
  dangerBtn: { backgroundColor: C.error + '30', borderRadius: 14, padding: 16, alignItems: 'center' },
  dangerBtnT: { color: C.error, fontSize: 16, fontWeight: '600' },
  syncBtn: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
  syncBtnT: { color: C.text, fontSize: 16, fontWeight: '600' },
  lastSync: { color: C.textMuted, fontSize: 12, marginTop: 8, textAlign: 'center' },

  // Header
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headL: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headT: { color: C.text, fontSize: 20, fontWeight: '700' },
  headR: { flexDirection: 'row', gap: 8 },
  headBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  eBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14 },
  eBadgeT: { color: C.bg, fontSize: 12, fontWeight: '700' },

  // Travel Alert
  travelAlert: { backgroundColor: C.warning, padding: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 12 },
  travelAlertT: { color: C.bg, fontSize: 14, fontWeight: '600', textAlign: 'center' },

  // Energy Selector
  eSel: { backgroundColor: C.card, margin: 16, borderRadius: 18, padding: 18 },
  eSelT: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 14, textAlign: 'center' },
  eOpts: { flexDirection: 'row', justifyContent: 'space-around' },
  eOpt: { paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, borderWidth: 2 },
  eOptT: { color: C.text, fontSize: 14, fontWeight: '600' },

  // Breadcrumbs
  bcs: { paddingHorizontal: 16, paddingVertical: 10, maxHeight: 50 },
  bc: { backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, marginRight: 10 },
  bcT: { color: C.textSec, fontSize: 12 },

  // Main
  main: { flex: 1 },

  // Messages
  msgs: { flex: 1, padding: 16 },
  msg: { maxWidth: '85%', padding: 16, borderRadius: 18, marginBottom: 12, position: 'relative' },
  msgN: { backgroundColor: C.card, alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  msgU: { backgroundColor: C.primary, alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  msgT: { color: C.text, fontSize: 15, lineHeight: 22 },
  modelBadge: { position: 'absolute', top: -6, right: -6, fontSize: 12 },

  // Input
  inC: { padding: 16, borderTopWidth: 1, borderTopColor: C.border },
  inR: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center' },
  iconBtnA: { backgroundColor: C.error },
  tIn: { flex: 1, backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, color: C.text, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  sendBtnT: { color: C.text, fontSize: 20, fontWeight: 'bold' },

  // One Thing
  oneC: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  oneL: { color: C.textSec, fontSize: 14, marginBottom: 20 },
  oneCard: { backgroundColor: C.card, borderRadius: 24, padding: 36, alignItems: 'center', width: '100%', maxWidth: 360 },
  eDot: { width: 14, height: 14, borderRadius: 7, marginBottom: 18 },
  oneT: { color: C.text, fontSize: 24, fontWeight: '600', textAlign: 'center', lineHeight: 32 },
  microB: { color: C.gold, fontSize: 14, marginTop: 12 },
  oneActs: { width: '100%', marginTop: 28, gap: 14 },
  oneDone: { backgroundColor: C.success, borderRadius: 18, padding: 20, alignItems: 'center' },
  oneDoneT: { color: C.text, fontSize: 18, fontWeight: '700' },
  oneBreak: { backgroundColor: C.card, borderRadius: 18, padding: 16, alignItems: 'center' },
  oneBreakT: { color: C.textSec, fontSize: 14 },
  microStarts: { marginTop: 36, width: '100%' },
  microStartsT: { color: C.textMuted, fontSize: 12, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  microStartO: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10 },
  microStartT: { color: C.textSec, fontSize: 14 },
  empty: { alignItems: 'center' },
  emptyE: { fontSize: 56, marginBottom: 18 },
  emptyT: { color: C.text, fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptyS: { color: C.textSec, fontSize: 14, marginBottom: 28 },
  addTaskBtn: { backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 28 },
  addTaskBtnT: { color: C.text, fontSize: 16, fontWeight: '600' },

  // List
  listC: { flex: 1, padding: 16 },
  listH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  listT: { color: C.text, fontSize: 22, fontWeight: '700' },
  addBtn: { backgroundColor: C.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  addBtnT: { color: C.text, fontSize: 14, fontWeight: '600' },
  filterR: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  filterBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: C.card },
  filterBtnA: { backgroundColor: C.primary },
  filterBtnT: { color: C.textSec, fontSize: 14, fontWeight: '600' },
  filterBtnTA: { color: C.text },
  taskList: { flex: 1 },
  taskI: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10 },
  taskIMicro: { marginLeft: 24, backgroundColor: C.card + '80' },
  chk: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  chkD: { backgroundColor: C.success, borderColor: C.success },
  chkT: { color: C.text, fontSize: 14, fontWeight: 'bold' },
  taskE: { width: 5, height: 28, borderRadius: 3, marginRight: 14 },
  taskT: { flex: 1, color: C.text, fontSize: 15 },
  taskTD: { textDecorationLine: 'line-through', color: C.textMuted },
  microL: { marginRight: 10, fontSize: 14 },
  taskA: { fontSize: 18, marginLeft: 10 },
  emptyList: { padding: 40, alignItems: 'center' },
  emptyListT: { color: C.textMuted, fontSize: 16 },

  // Timeline
  timeC: { flex: 1, padding: 16 },
  timeTitle: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  timeSubtitle: { color: C.textSec, fontSize: 14, marginBottom: 24 },
  timeH: { flexDirection: 'row', marginBottom: 4 },
  timeTm: { width: 50, color: C.textSec, fontSize: 12 },
  timeTmPast: { color: C.textMuted },
  timeSlot: { flex: 1, minHeight: 44, backgroundColor: C.card, borderRadius: 6, position: 'relative', justifyContent: 'center', paddingHorizontal: 10 },
  timeSlotNow: { backgroundColor: C.primary + '30', borderWidth: 1, borderColor: C.primary },
  curLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: C.primary },
  timeEventT: { color: C.text, fontSize: 13, fontWeight: '500' },

  // Dashboard
  dashC: { flex: 1, padding: 16 },
  dashT: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 24 },
  dashStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  dashS: { alignItems: 'center' },
  dashSV: { color: C.text, fontSize: 32, fontWeight: 'bold' },
  dashSL: { color: C.textSec, fontSize: 12, marginTop: 4 },
  achT: { color: C.text, fontSize: 18, fontWeight: '600', marginBottom: 18 },
  achG: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achI: { backgroundColor: C.card, borderRadius: 14, padding: 14, width: '31%', alignItems: 'center' },
  achIL: { opacity: 0.4 },
  achE: { fontSize: 28, marginBottom: 8 },
  achN: { color: C.text, fontSize: 10, textAlign: 'center', fontWeight: '500' },
  achP: { color: C.gold, fontSize: 10, marginTop: 4, fontWeight: '600' },
  thoughtI: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10 },
  thoughtT: { color: C.text, fontSize: 14 },
  thoughtD: { color: C.textMuted, fontSize: 12, marginTop: 6 },

  // Minimal
  minC: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36 },
  minG: { color: C.text, fontSize: 32, fontWeight: '300', marginBottom: 18 },
  minM: { color: C.textSec, fontSize: 16, textAlign: 'center', marginBottom: 48, lineHeight: 24 },
  minTask: { backgroundColor: C.card, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%' },
  minTaskT: { color: C.text, fontSize: 20, marginBottom: 10, textAlign: 'center' },
  minTaskH: { color: C.textMuted, fontSize: 13 },
  minEnergy: { marginTop: 36 },
  minEnergyT: { color: C.textMuted, fontSize: 14 },

  // Nav
  nav: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10 },
  navI: { alignItems: 'center', padding: 8 },
  navIA: {},
  navE: { fontSize: 22 },
  navL: { color: C.textMuted, fontSize: 10, marginTop: 4, fontWeight: '600' },
  navLA: { color: C.primary },

  // Modals
  mO: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  mC: { backgroundColor: C.card, borderRadius: 24, padding: 28 },
  mT: { color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  mSub: { color: C.textSec, fontSize: 14, marginBottom: 24 },
  mL: { color: C.textSec, fontSize: 14, marginBottom: 10 },
  mIn: { backgroundColor: C.bg, borderRadius: 16, padding: 18, color: C.text, fontSize: 16, marginBottom: 20 },
  ePick: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  ePickO: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 2, borderColor: C.border, alignItems: 'center' },
  ePickT: { color: C.text, fontSize: 14, fontWeight: '600' },
  mBtns: { flexDirection: 'row', gap: 14 },
  mCancel: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center' },
  mCancelT: { color: C.textSec, fontSize: 16, fontWeight: '600' },
  mConfirm: { flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center' },
  mConfirmT: { color: C.text, fontSize: 16, fontWeight: '700' },
  ctxI: { backgroundColor: C.bg, borderRadius: 14, padding: 16, marginBottom: 12 },
  ctxL: { color: C.text, fontSize: 16, fontWeight: '600' },
  ctxD: { color: C.textMuted, fontSize: 12, marginTop: 4 },
  extractedI: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bg, borderRadius: 14, padding: 16, marginBottom: 12 },
  extractedT: { color: C.text, fontSize: 14, flex: 1 },
  extractedA: { color: C.primary, fontSize: 14, fontWeight: '600' },

  // Celebration
  celebO: { position: 'absolute', top: '38%', left: '8%', right: '8%', backgroundColor: C.success, borderRadius: 24, padding: 32, alignItems: 'center' },
  celebT: { color: C.text, fontSize: 28, fontWeight: 'bold', textAlign: 'center' },

  // Achievement Toast
  achToast: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: C.gold, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center' },
  achToastE: { fontSize: 36, marginRight: 14 },
  achToastTitle: { color: C.bg, fontSize: 12, fontWeight: '600' },
  achToastN: { color: C.bg, fontSize: 18, fontWeight: 'bold' },
  achToastP: { color: C.bg, fontSize: 22, fontWeight: 'bold' },

  // Pattern Analysis Styles
  patternSection: { marginTop: 24, marginBottom: 16 },
  patternTitle: { color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  
  insightCard: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  insightEmoji: { fontSize: 32, marginRight: 14 },
  insightContent: { flex: 1 },
  insightTitle: { color: C.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  insightText: { color: C.textSec, fontSize: 14, lineHeight: 20 },

  aiInsightCard: { flexDirection: 'row', backgroundColor: C.primary + '20', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: C.primary },
  aiInsightEmoji: { fontSize: 32, marginRight: 14 },
  aiInsightContent: { flex: 1 },
  aiInsightTitle: { color: C.primary, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  aiInsightText: { color: C.text, fontSize: 14, lineHeight: 20 },

  chartContainer: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  chartTitle: { color: C.text, fontSize: 14, fontWeight: '600', marginBottom: 12 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80 },
  chartBarWrapper: { alignItems: 'center', width: 16 },
  chartBar: { width: 10, borderRadius: 5, backgroundColor: C.primary, minHeight: 4 },
  chartLabel: { color: C.textMuted, fontSize: 8, marginTop: 4 },
});
