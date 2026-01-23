import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, Modal, Animated, Platform, KeyboardAvoidingView,
  ActivityIndicator, Switch, Linking, Alert, AppState
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// ============ NEW AI FEATURE IMPORTS ============
import { FocusTimerService } from './src/services/FocusTimerService';
import { MoodTrackingService } from './src/services/MoodTrackingService';
import { ProactiveCheckInService } from './src/services/ProactiveCheckInService';
import { SmartNotificationService } from './src/services/SmartNotificationService';
import { ContextAwareSuggestionService } from './src/services/ContextAwareSuggestionService';
import { WidgetService, parseWidgetDeepLink } from './src/widgets/WidgetService';
import { FocusTimer } from './src/components/FocusTimer';
import { MoodTracker } from './src/components/MoodTracker';
import { TaskSuggestions } from './src/components/TaskSuggestions';
import { ProactiveCheckInCard } from './src/components/ProactiveCheckInCard';
import type { MoodLevel, FocusSession, ProactiveCheckIn, MoodEntry } from './src/types';

// ============ SUPABASE AUTH IMPORTS ============
import { useAuth } from './src/hooks/useAuth';
import { useSupabaseSync } from './src/hooks/useSupabaseSync';
import { AuthScreen } from './src/components/AuthScreen';
import { WeeklyReportCard } from './src/components/WeeklyReportCard';

// ============ VOICE & BREADCRUMBS UI COMPONENTS ============
import { VoiceInputButton } from './src/components/VoiceInputButton';
import { BreadcrumbTrail } from './src/components/BreadcrumbTrail';
import { getContextBreadcrumbService } from './src/services/ContextBreadcrumbService';
import { SmartNudgeSetup } from './src/components/SmartNudgeSetup';
import { WeeklyReportService, type WeeklyReportData } from './src/services/WeeklyReportService';
import { supabase, FocusSessionsAPI, EnergyLogsAPI, TasksAPI } from './src/services/supabase';


// Complete OAuth flow on web
WebBrowser.maybeCompleteAuthSession();

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Google OAuth Configuration
const GOOGLE_CLIENT_ID_WEB = ''; // Add your web client ID
const GOOGLE_CLIENT_ID_IOS = ''; // Add your iOS client ID  
const GOOGLE_CLIENT_ID_ANDROID = ''; // Add your Android client ID

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// ============ TYPES ============
type EnergyLevel = 'low' | 'medium' | 'high';
type ViewMode = 'conversation' | 'oneThing' | 'list' | 'insights';
type Personality = 'loyalFriend' | 'coach' | 'playful' | 'calm';
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
  calendarEventId?: string;
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
  voiceEnabled?: boolean;
  neroVoiceEnabled?: boolean;
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
    name: 'Friend', emoji: '🤗', desc: 'Warm, supportive, casual', color: C.primary,
    greetings: ["Hey there! 💙", "Hi friend!", "Hey! 👋", "Good to see you!"],
    systemPrompt: "You are Nero, a warm and supportive AI companion for someone with ADHD. Be friendly, use casual language, light humor. Always be encouraging. Never guilt or shame."
  },
  coach: {
    name: 'Coach', emoji: '🏆', desc: 'Motivating, gentle push', color: C.gold,
    greetings: ["Let's go! 💪", "Ready to crush it?", "Champion! Let's do this!"],
    systemPrompt: "You are Nero, a motivating coach for someone with ADHD. Be encouraging, push gently, celebrate wins enthusiastically. Help them see their potential."
  },
  playful: {
    name: 'Playful', emoji: '😄', desc: 'Jokes, light, fun', color: C.pink,
    greetings: ["Heyyy! 😄", "Look who showed up!", "The legend returns!"],
    systemPrompt: "You are Nero, a playful and funny AI companion for someone with ADHD. Use humor, puns, and keep things light while being helpful. Laughter helps with dopamine!"
  },
  calm: {
    name: 'Calm', emoji: '🧘', desc: 'Soft, gentle, zen', color: C.teal,
    greetings: ["Welcome 🌿", "Peace, friend.", "Breathe. You're here now."],
    systemPrompt: "You are Nero, a calm and zen AI companion for someone with ADHD. Be gentle, soft-spoken, never rush. Create a peaceful space. Anxiety is real."
  },
};

const VIEWS: Record<string, { name: string; emoji: string; desc: string }> = {
  conversation: { name: 'Chat', emoji: '💬', desc: 'Talk with Nero' },
  oneThing: { name: 'Focus', emoji: '🎯', desc: 'One task at a time' },
  list: { name: 'List', emoji: '📝', desc: 'All your tasks' },
  insights: { name: 'Insights', emoji: '📊', desc: 'Patterns & schedule' },
};

// ============ STUCK MODE PROMPTS ============
const STUCK_MODE_PROMPTS = {
  initial: [
    "I hear you. Being stuck is real and valid. Let's work through this gently. 💙",
    "Executive dysfunction is tough. I'm here with you. No pressure. 🌿",
    "It's okay. Your brain isn't broken - it just works differently. Let's try something tiny. ✨",
  ],
  bodyMovement: [
    "Can you stand up and touch a wall, then come back? Just that. 🚶",
    "Try wiggling your fingers for 5 seconds. Seriously, just that. ✋",
    "Take one deep breath. Just one. I'll wait. 🌬️",
    "Stretch your arms up for 3 seconds. That's it. 💪",
  ],
  microSteps: [
    "Can you just LOOK at the task? Not do it - just look at it. 👀",
    "What's the tiniest possible piece? Like, embarrassingly tiny? 🔬",
    "Forget the whole task. What's ONE word you could type? ⌨️",
    "Can you open the thing you need? Just open it, nothing else. 📂",
  ],
  randomTask: [
    "Want me to just pick something random for you? Remove the choice entirely? 🎲",
    "Sometimes any action beats no action. Should I pick one at random? 🎯",
    "Decision paralysis is real. I can choose for you if that helps. 🤝",
  ],
  validation: [
    "Some days the win is just being here. That counts. 💙",
    "You showed up. That's not nothing. 🌟",
    "Progress isn't always visible. You're still moving forward. 🐢",
    "It's okay to rest. You're not lazy - you're human. 🌙",
  ],
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
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;

  setTokens(accessToken: string, refreshToken?: string, expiresIn?: number) {
    this.accessToken = accessToken;
    if (refreshToken) this.refreshToken = refreshToken;
    if (expiresIn) this.tokenExpiry = Date.now() + (expiresIn * 1000);
  }

  getAccessToken() {
    return this.accessToken;
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          client_id: Platform.select({
            ios: GOOGLE_CLIENT_ID_IOS,
            android: GOOGLE_CLIENT_ID_ANDROID,
            default: GOOGLE_CLIENT_ID_WEB,
          }) || '',
        }).toString(),
      });

      if (!response.ok) return false;
      
      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      return true;
    } catch {
      return false;
    }
  }

  async getEvents(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    if (!this.accessToken) {
      // Return mock events for demo
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return [
        {
          id: 'demo-1',
          title: '🎯 Morning Focus Block',
          start: new Date(today.getTime() + 9 * 60 * 60 * 1000).toISOString(),
          end: new Date(today.getTime() + 11 * 60 * 60 * 1000).toISOString(),
          color: C.primary,
        },
        {
          id: 'demo-2',
          title: '🍽️ Lunch Break',
          start: new Date(today.getTime() + 12 * 60 * 60 * 1000).toISOString(),
          end: new Date(today.getTime() + 13 * 60 * 60 * 1000).toISOString(),
          color: C.success,
        },
        {
          id: 'demo-3',
          title: '📝 Afternoon Tasks',
          start: new Date(today.getTime() + 14 * 60 * 60 * 1000).toISOString(),
          end: new Date(today.getTime() + 17 * 60 * 60 * 1000).toISOString(),
          color: C.warning,
        },
      ];
    }

    // Check if token needs refresh
    if (Date.now() > this.tokenExpiry - 60000) {
      await this.refreshAccessToken();
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=50`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await this.refreshAccessToken();
          if (refreshed) return this.getEvents(timeMin, timeMax);
        }
        throw new Error('Calendar API error');
      }

      const data = await response.json();
      return (data.items || []).map((item: any) => ({
        id: item.id,
        title: item.summary || 'Untitled',
        start: item.start?.dateTime || item.start?.date,
        end: item.end?.dateTime || item.end?.date,
        allDay: !!item.start?.date,
        color: item.colorId ? this.getColorById(item.colorId) : C.primary,
        description: item.description,
        location: item.location,
      }));
    } catch (error) {
      console.error('Calendar error:', error);
      return [];
    }
  }

  // Create a calendar event from a task
  async createEventFromTask(task: Task, startTime: Date, durationMinutes: number = 30): Promise<CalendarEvent | null> {
    if (!this.accessToken) return null;

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const colorId = task.energy === 'high' ? '11' : task.energy === 'medium' ? '5' : '9'; // Red, Yellow, Blue

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `📋 ${task.title}`,
            description: `Task from UnFocused\nEnergy: ${task.energy}\nCreated: ${task.createdAt}`,
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
            colorId,
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'popup', minutes: 10 },
                { method: 'popup', minutes: 5 },
              ],
            },
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to create event');

      const event = await response.json();
      return {
        id: event.id,
        title: event.summary,
        start: event.start.dateTime,
        end: event.end.dateTime,
        color: this.getColorById(colorId),
      };
    } catch (error) {
      console.error('Create event error:', error);
      return null;
    }
  }

  // Create a time block for focused work
  async createTimeBlock(title: string, startTime: Date, durationMinutes: number, color: string = '9'): Promise<CalendarEvent | null> {
    if (!this.accessToken) return null;

    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            summary: `🎯 ${title}`,
            description: 'Focus block created by UnFocused',
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
            colorId: color,
            transparency: 'opaque', // Shows as busy
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to create time block');

      const event = await response.json();
      return {
        id: event.id,
        title: event.summary,
        start: event.start.dateTime,
        end: event.end.dateTime,
        color: this.getColorById(color),
      };
    } catch (error) {
      console.error('Create time block error:', error);
      return null;
    }
  }

  // Delete a calendar event
  async deleteEvent(eventId: string): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // Get free/busy times for scheduling
  async getFreeBusy(timeMin: Date, timeMax: Date): Promise<{ start: string; end: string }[]> {
    if (!this.accessToken) return [];

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            items: [{ id: 'primary' }],
          }),
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return data.calendars?.primary?.busy || [];
    } catch {
      return [];
    }
  }

  // Find next available slot for a task
  async findNextAvailableSlot(durationMinutes: number = 30): Promise<Date | null> {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(18, 0, 0, 0); // Look until 6 PM

    if (now >= endOfDay) {
      // Look at tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }

    const busyTimes = await this.getFreeBusy(now, endOfDay);
    
    let candidateStart = new Date(now);
    candidateStart.setMinutes(Math.ceil(candidateStart.getMinutes() / 15) * 15, 0, 0); // Round to 15 min

    for (const busy of busyTimes) {
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);

      if (candidateStart.getTime() + durationMinutes * 60 * 1000 <= busyStart.getTime()) {
        return candidateStart;
      }
      
      candidateStart = new Date(Math.max(candidateStart.getTime(), busyEnd.getTime()));
    }

    if (candidateStart.getTime() + durationMinutes * 60 * 1000 <= endOfDay.getTime()) {
      return candidateStart;
    }

    return null;
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

  private getColorById(colorId: string): string {
    const colors: Record<string, string> = {
      '1': '#7986CB', '2': '#33B679', '3': '#8E24AA', '4': '#E67C73',
      '5': '#F6BF26', '6': '#F4511E', '7': '#039BE5', '8': '#616161',
      '9': '#3F51B5', '10': '#0B8043', '11': '#D50000',
    };
    return colors[colorId] || C.primary;
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;
  }
}

// ============ NATIVE NOTIFICATION SERVICE ============
class NativeNotificationService {
  private expoPushToken: string | null = null;

  async initialize(): Promise<string | null> {
    if (Platform.OS === 'web') {
      // Web notifications
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }
      return null;
    }

    if (!Device.isDevice) {
      console.log('Push notifications require physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'unfocused-adhd-app',
    });
    
    this.expoPushToken = token.data;
    return this.expoPushToken;
  }

  async scheduleNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput
  ): Promise<string | null> {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });
      return id;
    } catch (error) {
      console.error('Schedule notification error:', error);
      return null;
    }
  }

  async scheduleTaskReminder(taskTitle: string, delaySeconds: number): Promise<string | null> {
    return this.scheduleNotification(
      '🎯 Task Reminder',
      taskTitle,
      { seconds: delaySeconds }
    );
  }

  async scheduleHyperfocusCheck(delayMinutes: number = 90): Promise<string | null> {
    return this.scheduleNotification(
      '🧠 Hyperfocus Check',
      "You've been going strong! Time for water, stretch, or a quick break?",
      { seconds: delayMinutes * 60 }
    );
  }

  async scheduleDailyCheckIn(hour: number = 9, minute: number = 0): Promise<string | null> {
    return this.scheduleNotification(
      '☀️ Good Morning!',
      "Ready to set your energy level and tackle today?",
      {
        hour,
        minute,
        repeats: true,
      }
    );
  }

  async cancelNotification(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
}

// ============ VOICE INPUT SERVICE ============
class VoiceService {
  private recording: Audio.Recording | null = null;
  private isRecording: boolean = false;

  async startRecording(): Promise<boolean> {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      this.recording = recording;
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Start recording error:', error);
      return false;
    }
  }

  async stopRecording(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;
      this.isRecording = false;
      return uri;
    } catch (error) {
      console.error('Stop recording error:', error);
      return null;
    }
  }

  async transcribeWithWhisper(audioUri: string, apiKey: string): Promise<string> {
    if (!apiKey) {
      // Fallback to speech recognition hint
      return '';
    }

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) return '';
      
      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Transcription error:', error);
      return '';
    }
  }

  // Text-to-speech for Nero responses
  speak(text: string, options?: { rate?: number; pitch?: number; language?: string }) {
    Speech.speak(text, {
      rate: options?.rate || 0.9,
      pitch: options?.pitch || 1.0,
      language: options?.language || 'en-US',
    });
  }

  stopSpeaking() {
    Speech.stop();
  }

  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
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
  const [screen, setScreen] = useState<'auth' | 'welcome' | 'onboarding' | 'main' | 'settings'>('auth');
  
  // ============ SUPABASE AUTH STATE ============
  const { user, session, loading: authLoading, error: authError, signIn, signUp, signOut, clearError } = useAuth();
  const supabaseSync = useSupabaseSync({ userId: user?.id || null });
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReportData | null>(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [showNudgeSetup, setShowNudgeSetup] = useState(false);

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
  const [nativeNotificationService] = useState(() => new NativeNotificationService());
  const [voiceService] = useState(() => new VoiceService());

  // ============ NEW AI SERVICES ============
  const [focusTimerService] = useState(() => new FocusTimerService());
  const [moodTrackingService] = useState(() => new MoodTrackingService());
  const [proactiveCheckInService] = useState(() => new ProactiveCheckInService());
  const [smartNotificationService] = useState(() => new SmartNotificationService());
  const [contextSuggestionService] = useState(() => new ContextAwareSuggestionService());
  const [widgetService] = useState(() => new WidgetService());

  // ============ NEW AI FEATURE STATE ============
  // Focus Timer State
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [focusTimerRemaining, setFocusTimerRemaining] = useState(0);
  const [focusSessionHistory, setFocusSessionHistory] = useState<FocusSession[]>([]);

  // Mood Tracking State
  const [currentMood, setCurrentMood] = useState<MoodLevel | null>(null);
  const [moodHistory, setMoodHistory] = useState<MoodEntry[]>([]);
  const [showMoodTracker, setShowMoodTracker] = useState(false);

  // Proactive Check-In State
  const [activeCheckIn, setActiveCheckIn] = useState<ProactiveCheckIn | null>(null);
  const [checkInHistory, setCheckInHistory] = useState<ProactiveCheckIn[]>([]);

  // Context-Aware Suggestions State
  const [taskSuggestions, setTaskSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Pattern Analysis State
  const [completionHistory, setCompletionHistory] = useState<CompletionRecord[]>([]);
  const [weeklyInsights, setWeeklyInsights] = useState<WeeklyInsight[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  // Google OAuth State
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  // Voice Input State
  const [isRecording, setIsRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [neroSpeaking, setNeroSpeaking] = useState(false);

  // Native Notifications State
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [scheduledReminders, setScheduledReminders] = useState<string[]>([]);

  // ============ STUCK/PARALYSIS MODE STATE ============
  const [isStuckMode, setIsStuckMode] = useState(false);
  const [stuckStep, setStuckStep] = useState(0);
  const [stuckMessage, setStuckMessage] = useState('');

  // ============ SWIPE GESTURE STATE ============
  const [swipingTaskId, setSwipingTaskId] = useState<string | null>(null);
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const swipeValue = useRef(0); // Track current swipe value

  // Google OAuth Hook
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'unfocused',
    path: 'oauth',
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: Platform.select({
        ios: GOOGLE_CLIENT_ID_IOS,
        android: GOOGLE_CLIENT_ID_ANDROID,
        default: GOOGLE_CLIENT_ID_WEB,
      }) || '',
      redirectUri,
      scopes: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      responseType: 'code',
      usePKCE: true,
    },
    discovery
  );

  // Animation refs
  const celebAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // ============ EFFECTS ============

  // ============ AUTH STATE EFFECT ============
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        // User authenticated - check onboarding status
        AsyncStorage.getItem('@uf/onb').then(onb => {
          if (screen === 'auth') {
            setScreen(onb === 'true' ? 'main' : 'welcome');
          }
        });
        // Load tasks from Supabase
        supabaseSync.loadTasks().then(cloudTasks => {
          if (cloudTasks.length > 0) {
            setTasks(prev => {
              // Merge local unsynced tasks with cloud tasks
              const unsynced = prev.filter(t => !t.synced);
              return [...cloudTasks, ...unsynced];
            });
          }
        });
        // Check for weekly report (Monday mornings)
        const reportService = new WeeklyReportService(user.id);
        if (reportService.shouldShowWeeklyReport()) {
          reportService.generateWeeklyReport().then(report => {
            setWeeklyReport(report);
            setShowWeeklyReport(true);
          }).catch(err => console.log('Report generation error:', err));
        }
      } else if (screen !== 'auth') {
        // User logged out
        setScreen('auth');
      }
    }
  }, [authLoading, user]);



  // Log energy changes to Supabase
  useEffect(() => {
    if (energy && user) {
      supabaseSync.logEnergy(energy, currentMood || undefined, undefined)
        .catch(err => console.log('Energy log error:', err));
    }
  }, [energy, user]);

  // Load data on mount
  useEffect(() => {
    loadData();
    requestNotificationPermission();
    initializeNativeServices();
  }, []);

  // Initialize native services
  const initializeNativeServices = async () => {
    // Initialize native push notifications
    const token = await nativeNotificationService.initialize();
    if (token) {
      setExpoPushToken(token);
      console.log('Push token:', token);
    }

    // Load saved Google tokens
    try {
      const savedTokens = await AsyncStorage.getItem('@uf/google_tokens');
      if (savedTokens) {
        const { accessToken, refreshToken, expiry } = JSON.parse(savedTokens);
        calendarService.setTokens(accessToken, refreshToken, Math.floor((expiry - Date.now()) / 1000));
        setProfile(p => ({ ...p, calendarConnected: true }));
      }
    } catch (e) {
      console.log('No saved Google tokens');
    }

    // Load AI feature data
    await initializeAIFeatures();
  };

  // ============ NEW: Initialize AI Features ============
  const initializeAIFeatures = async () => {
    try {
      // Load mood history
      const savedMoodHistory = await AsyncStorage.getItem('@uf/mood_history');
      if (savedMoodHistory) {
        const history = JSON.parse(savedMoodHistory);
        setMoodHistory(history);
        moodTrackingService.setMoodHistory(history);
      }

      // Load focus session history
      const savedFocusSessions = await AsyncStorage.getItem('@uf/focus_sessions');
      if (savedFocusSessions) {
        const sessions = JSON.parse(savedFocusSessions);
        setFocusSessionHistory(sessions);
        focusTimerService.setSessionHistory(sessions);
      }

      // Load check-in history
      const savedCheckIns = await AsyncStorage.getItem('@uf/checkin_history');
      if (savedCheckIns) {
        const history = JSON.parse(savedCheckIns);
        setCheckInHistory(history);
        proactiveCheckInService.setCheckInHistory(history);
      }

      // Load widget data
      await widgetService.loadWidgetData();
    } catch (e) {
      console.log('Failed to load AI feature data:', e);
    }
  };

  // ============ NEW: AI Feature Effects ============

  // Save mood history when it changes
  useEffect(() => {
    if (moodHistory.length > 0) {
      AsyncStorage.setItem('@uf/mood_history', JSON.stringify(moodHistory.slice(-100)));
    }
  }, [moodHistory]);

  // Save focus sessions when they change
  useEffect(() => {
    if (focusSessionHistory.length > 0) {
      AsyncStorage.setItem('@uf/focus_sessions', JSON.stringify(focusSessionHistory.slice(-50)));
    }
  }, [focusSessionHistory]);

  // Save check-in history
  useEffect(() => {
    if (checkInHistory.length > 0) {
      AsyncStorage.setItem('@uf/checkin_history', JSON.stringify(checkInHistory.slice(-50)));
    }
  }, [checkInHistory]);

  // Update widget data when tasks/energy change
  useEffect(() => {
    widgetService.updateTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    widgetService.updateEnergy(energy);
  }, [energy]);

  useEffect(() => {
    widgetService.updateMood(currentMood);
  }, [currentMood]);

  useEffect(() => {
    widgetService.updateStats(stats.streak, stats.totalPoints);
  }, [stats.streak, stats.totalPoints]);

  // Sync services with completion history
  useEffect(() => {
    if (completionHistory.length > 0) {
      proactiveCheckInService.setCompletionHistory(completionHistory);
      smartNotificationService.setCompletionHistory(completionHistory);
      contextSuggestionService.setCompletionHistory(completionHistory);
      moodTrackingService.setCompletionHistory(completionHistory);
      proactiveCheckInService.setHourlyStats(patternService.getHourlyStats());
    }
  }, [completionHistory]);

  // Sync calendar events with suggestion service
  useEffect(() => {
    contextSuggestionService.setCalendarEvents(calendarEvents);
  }, [calendarEvents]);

  // Check for proactive check-ins periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (profile.proactiveCheckinsEnabled !== false) {
        const checkIn = proactiveCheckInService.shouldCheckIn(energy, currentMood, profile);
        if (checkIn && !activeCheckIn) {
          setActiveCheckIn(checkIn);
          setCheckInHistory(prev => [...prev, checkIn]);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(checkInterval);
  }, [energy, currentMood, profile, activeCheckIn]);

  // Update task suggestions when context changes
  useEffect(() => {
    if (showSuggestions && tasks.filter(t => !t.completed).length > 0) {
      const suggestions = contextSuggestionService.getSuggestions(tasks, energy, currentMood);
      setTaskSuggestions(suggestions);
    }
  }, [tasks, energy, currentMood, showSuggestions]);

  // ============ NEW: AI Feature Handlers ============

  const handleMoodRecorded = (mood: MoodLevel) => {
    setCurrentMood(mood);
    const entry = moodTrackingService.recordMood(mood, energy || undefined, undefined, 'checkin');
    setMoodHistory(prev => [...prev, entry]);

    // Update smart notification service with mood
    smartNotificationService.setEnabled(profile.smartNotificationsEnabled !== false);

    // Record activity for check-in service
    proactiveCheckInService.recordActivity();
    contextSuggestionService.recordActivity();
  };

  const handleFocusSessionComplete = (session: FocusSession) => {
    setFocusSessionHistory(prev => [...prev, session]);

    // Celebrate completion
    if (session.completedPomodoros > 0) {
      setCelebText(`🎯 Focus session complete! ${session.completedPomodoros} pomodoro${session.completedPomodoros > 1 ? 's' : ''} done!`);
      setShowCeleb(true);
      Animated.sequence([
        Animated.timing(celebAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(celebAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowCeleb(false));
    }

    // Update widget
    widgetService.updateFocusSession(false);

    // Sync focus session to Supabase
    if (user && session.startTime && session.endTime) {
      supabaseSync.logFocusSession(
        new Date(session.startTime),
        new Date(session.endTime),
        session.taskId,
        `${session.completedPomodoros} pomodoros completed`
      ).catch(err => console.log('Focus session sync error:', err));
    }
  };

  const handleCheckInResponse = (response: string) => {
    if (activeCheckIn) {
      proactiveCheckInService.respondToCheckIn(activeCheckIn.id, response);
      setActiveCheckIn(null);

      // Handle specific responses
      if (response === 'ready' || response === 'back') {
        // User is ready to work
        const suggestions = contextSuggestionService.getSuggestions(tasks, energy, currentMood);
        if (suggestions.length > 0) {
          setTaskSuggestions(suggestions);
          setShowSuggestions(true);
        }
      } else if (response === 'tiny_task' || response === 'easy_tasks') {
        // Show low-energy tasks
        setFilter('low');
        setView('list');
      } else if (response === 'talk') {
        // Open conversation view
        setView('conversation');
      }
    }
  };

  const handleCheckInDismiss = () => {
    setActiveCheckIn(null);
  };

  // ============ STUCK/PARALYSIS MODE HANDLERS ============
  const enterStuckMode = () => {
    setIsStuckMode(true);
    setStuckStep(0);
    const initialMsg = STUCK_MODE_PROMPTS.initial[Math.floor(Math.random() * STUCK_MODE_PROMPTS.initial.length)];
    setStuckMessage(initialMsg);
  };

  const handleStuckAction = (action: 'body' | 'micro' | 'random' | 'validate' | 'exit') => {
    if (action === 'exit') {
      setIsStuckMode(false);
      setStuckStep(0);
      setStuckMessage('');
      return;
    }

    if (action === 'body') {
      const msg = STUCK_MODE_PROMPTS.bodyMovement[Math.floor(Math.random() * STUCK_MODE_PROMPTS.bodyMovement.length)];
      setStuckMessage(msg);
      setStuckStep(1);
    } else if (action === 'micro') {
      const msg = STUCK_MODE_PROMPTS.microSteps[Math.floor(Math.random() * STUCK_MODE_PROMPTS.microSteps.length)];
      setStuckMessage(msg);
      setStuckStep(2);
    } else if (action === 'random') {
      // Pick a random uncompleted task
      const pendingTasks = tasks.filter(t => !t.completed);
      if (pendingTasks.length > 0) {
        const randomTask = pendingTasks[Math.floor(Math.random() * pendingTasks.length)];
        setStuckMessage(`Okay, I picked this one for you: "${randomTask.title}". No thinking needed - just this one. 🎯`);
        setStuckStep(3);
      } else {
        setStuckMessage("You have no tasks right now - that's actually a win! Maybe add one tiny thing? 📝");
        setStuckStep(3);
      }
    } else if (action === 'validate') {
      const msg = STUCK_MODE_PROMPTS.validation[Math.floor(Math.random() * STUCK_MODE_PROMPTS.validation.length)];
      setStuckMessage(msg);
      setStuckStep(4);
    }
  };

  // ============ SWIPE GESTURE HANDLERS ============
  const handleSwipeComplete = (taskId: string) => {
    Animated.timing(swipeAnim, {
      toValue: 300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      completeTask(taskId);
      swipeAnim.setValue(0);
      setSwipingTaskId(null);
    });
  };

  const handleSwipeSkip = (taskId: string) => {
    Animated.timing(swipeAnim, {
      toValue: -300,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Move task to end of list (skip/snooze)
      setTasks(prev => {
        const task = prev.find(t => t.id === taskId);
        if (!task) return prev;
        const filtered = prev.filter(t => t.id !== taskId);
        return [...filtered, task];
      });
      swipeAnim.setValue(0);
      setSwipingTaskId(null);
    });
  };

  const createPanResponder = (taskId: string) => {
    return {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderGrant: () => {
        setSwipingTaskId(taskId);
        swipeValue.current = 0;
      },
      onResponderMove: (evt: any) => {
        const dx = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
        // Clamp the movement
        const clampedDx = Math.max(-100, Math.min(100, dx));
        swipeValue.current = clampedDx;
        swipeAnim.setValue(clampedDx);
      },
      onResponderRelease: () => {
        const dx = swipeValue.current;
        if (dx > 60) {
          handleSwipeComplete(taskId);
        } else if (dx < -60) {
          handleSwipeSkip(taskId);
        } else {
          // Reset position
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start(() => {
            setSwipingTaskId(null);
            swipeValue.current = 0;
          });
        }
      },
    };
  };

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleAuthSuccess(response.params.code);
    } else if (response?.type === 'error') {
      setGoogleAuthLoading(false);
      Alert.alert('Authentication Error', 'Failed to connect to Google Calendar. Please try again.');
    }
  }, [response]);

  // Exchange OAuth code for tokens
  const handleGoogleAuthSuccess = async (code: string) => {
    try {
      setGoogleAuthLoading(true);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: Platform.select({
            ios: GOOGLE_CLIENT_ID_IOS,
            android: GOOGLE_CLIENT_ID_ANDROID,
            default: GOOGLE_CLIENT_ID_WEB,
          }) || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: request?.codeVerifier || '',
        }).toString(),
      });

      if (!tokenResponse.ok) throw new Error('Token exchange failed');

      const tokens = await tokenResponse.json();
      
      // Save tokens
      calendarService.setTokens(tokens.access_token, tokens.refresh_token, tokens.expires_in);
      
      await AsyncStorage.setItem('@uf/google_tokens', JSON.stringify({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiry: Date.now() + (tokens.expires_in * 1000),
      }));

      setProfile(p => ({ ...p, calendarConnected: true }));
      await loadCalendarEvents();
      
      // Send welcome message
      const neroMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: "🎉 Google Calendar connected! I can now see your schedule and help you plan your day. Want me to find a good time slot for your tasks?",
        timestamp: Date.now(),
      };
      setMessages(m => [...m, neroMsg]);
      
      setGoogleAuthLoading(false);
    } catch (error) {
      console.error('OAuth error:', error);
      setGoogleAuthLoading(false);
      Alert.alert('Connection Failed', 'Could not connect to Google Calendar. Please try again.');
    }
  };

  // Google Calendar sign in
  const signInWithGoogle = async () => {
    if (!request) {
      Alert.alert('Setup Required', 'Google OAuth is not configured. Please add your Google Client IDs to the app.');
      return;
    }
    setGoogleAuthLoading(true);
    await promptAsync();
  };

  // Google Calendar sign out
  const signOutGoogle = async () => {
    calendarService.logout();
    await AsyncStorage.removeItem('@uf/google_tokens');
    setProfile(p => ({ ...p, calendarConnected: false }));
    setCalendarEvents([]);
  };

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

    // Sync to Supabase
    if (user) {
      supabaseSync.createTask(task).then(syncedTask => {
        if (syncedTask) {
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, id: syncedTask.id, synced: true } : t));
        }
      }).catch(err => console.log('Task sync error:', err));
    }

    return task;
  };

  // ============ VOICE INPUT FUNCTIONS ============

  const startVoiceInput = async () => {
    const started = await voiceService.startRecording();
    if (started) {
      setIsRecording(true);
      setVoiceTranscript('');
      // Add haptic feedback on native
      if (Platform.OS !== 'web') {
        // Vibrate to indicate recording started
      }
    } else {
      Alert.alert('Microphone Access', 'Please allow microphone access to use voice input.');
    }
  };

  const stopVoiceInput = async () => {
    setIsRecording(false);
    const audioUri = await voiceService.stopRecording();
    
    if (audioUri && anthropicKey) {
      // For now, we'll use a simple speech indicator
      // In production, integrate with Whisper API
      setVoiceTranscript('Processing voice...');
      
      // Simulate transcription (in production, use voiceService.transcribeWithWhisper)
      setTimeout(() => {
        setVoiceTranscript('');
        // For demo, add voice message to conversation
        const voiceMsg: Message = {
          id: genId(),
          role: 'user',
          content: '🎤 [Voice input captured - integrate Whisper API for transcription]',
          timestamp: Date.now(),
        };
        setMessages(m => [...m, voiceMsg]);
      }, 1000);
    }
  };

  const speakNeroResponse = (text: string) => {
    // Strip emojis and special characters for better speech
    const cleanText = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    if (cleanText) {
      setNeroSpeaking(true);
      voiceService.speak(cleanText, { rate: 0.95 });
      // Stop speaking indicator after estimated duration
      setTimeout(() => setNeroSpeaking(false), cleanText.length * 50);
    }
  };

  const stopNeroSpeaking = () => {
    voiceService.stopSpeaking();
    setNeroSpeaking(false);
  };

  // ============ CALENDAR SCHEDULING FUNCTIONS ============

  const scheduleTaskOnCalendar = async (taskId: string, startTime?: Date) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !calendarService.isAuthenticated()) {
      if (!calendarService.isAuthenticated()) {
        Alert.alert('Calendar Not Connected', 'Connect Google Calendar in settings to schedule tasks.');
      }
      return null;
    }

    setCalendarSyncStatus('syncing');
    
    // Find next available slot if no time specified
    const scheduleTime = startTime || await calendarService.findNextAvailableSlot(30);
    if (!scheduleTime) {
      setCalendarSyncStatus('error');
      Alert.alert('No Available Time', 'Could not find an available time slot today. Try scheduling manually.');
      return null;
    }

    const event = await calendarService.createEventFromTask(task, scheduleTime, 30);
    
    if (event) {
      setCalendarSyncStatus('success');
      setCalendarEvents(prev => [...prev, event]);
      
      // Update task with calendar link
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, calendarEventId: event.id } : t
      ));

      // Notify user
      const timeStr = scheduleTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const neroMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: `📅 Done! I've scheduled "${task.title}" for ${timeStr}. I'll remind you when it's time!`,
        timestamp: Date.now(),
      };
      setMessages(m => [...m, neroMsg]);

      // Schedule native notification
      const secondsUntil = Math.max(0, (scheduleTime.getTime() - Date.now()) / 1000 - 300); // 5 min before
      if (secondsUntil > 0) {
        const notifId = await nativeNotificationService.scheduleTaskReminder(task.title, secondsUntil);
        if (notifId) setScheduledReminders(prev => [...prev, notifId]);
      }

      setTimeout(() => setCalendarSyncStatus('idle'), 2000);
      return event;
    }

    setCalendarSyncStatus('error');
    return null;
  };

  const createFocusBlock = async (durationMinutes: number = 60) => {
    if (!calendarService.isAuthenticated()) {
      Alert.alert('Calendar Not Connected', 'Connect Google Calendar to create focus blocks.');
      return;
    }

    setCalendarSyncStatus('syncing');
    
    const startTime = await calendarService.findNextAvailableSlot(durationMinutes);
    if (!startTime) {
      setCalendarSyncStatus('error');
      Alert.alert('No Available Time', `Could not find a ${durationMinutes}-minute slot today.`);
      return;
    }

    const block = await calendarService.createTimeBlock('Focus Time', startTime, durationMinutes, '9');
    
    if (block) {
      setCalendarSyncStatus('success');
      setCalendarEvents(prev => [...prev, block]);
      
      const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const neroMsg: Message = {
        id: genId(),
        role: 'assistant',
        content: `🎯 Focus block created! You have ${durationMinutes} minutes blocked at ${timeStr}. I'll help you stay focused when it's time.`,
        timestamp: Date.now(),
      };
      setMessages(m => [...m, neroMsg]);
      
      setTimeout(() => setCalendarSyncStatus('idle'), 2000);
    } else {
      setCalendarSyncStatus('error');
    }
  };

  const syncCalendarEvents = async () => {
    if (!calendarService.isAuthenticated()) return;
    
    setCalendarSyncStatus('syncing');
    await loadCalendarEvents();
    setCalendarSyncStatus('success');
    setTimeout(() => setCalendarSyncStatus('idle'), 2000);
  };

  const completeTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task || task.completed) return;

    // Calculate completion time if task has createdAt
    const completedAt = new Date().toISOString();
    const completionTimeMs = task.createdAt ? Date.now() - new Date(task.createdAt).getTime() : undefined;

    // Update task as completed
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completedAt, completionTimeMs, synced: true } : t));
    
    // Sync completion to Supabase
    if (user) {
      supabaseSync.completeTask(id).catch(err => console.log('Sync error:', err));
    }

    // Record completion for pattern analysis
    const completedTask = { ...task, completedAt, completionTimeMs };
    const record = patternService.recordCompletion(completedTask);
    
    // Track task completion in breadcrumbs
    getContextBreadcrumbService().trackTaskComplete(id, task.title);
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

    // Speak response if voice enabled
    if (profile.neroVoiceEnabled) {
      speakNeroResponse(response.content);
    }
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

  
  // AUTH LOADING
  if (authLoading) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={S.loadText}>Checking authentication...</Text>
      </View>
    );
  }

  // AUTH SCREEN
  if (screen === 'auth') {
    return (
      <AuthScreen
        onSignIn={signIn}
        onSignUp={signUp}
        onSkip={() => {
          AsyncStorage.getItem('@uf/onb').then(onb => {
            setScreen(onb === 'true' ? 'main' : 'welcome');
          });
        }}
        loading={authLoading}
        error={authError}
        clearError={clearError}
      />
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
            <Text style={S.setSecT}>📅 Google Calendar Integration</Text>
            {!profile.calendarConnected ? (
              <TouchableOpacity
                style={[S.setOpt, googleAuthLoading && { opacity: 0.5 }]}
                onPress={signInWithGoogle}
                disabled={googleAuthLoading}
              >
                <Text style={S.setOptE}>🔗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.setOptT}>{googleAuthLoading ? 'Connecting...' : 'Connect Google Calendar'}</Text>
                  <Text style={S.setOptD}>OAuth 2.0 • Two-way sync • Time blocking</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <View style={[S.setOpt, S.setOptSel]}>
                  <Text style={S.setOptE}>✓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={S.setOptT}>Google Calendar Connected</Text>
                    <Text style={S.setOptD}>Real-time sync enabled</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[S.syncBtn, { flex: 1 }, calendarSyncStatus === 'syncing' && { opacity: 0.5 }]}
                    onPress={syncCalendarEvents}
                    disabled={calendarSyncStatus === 'syncing'}
                  >
                    <Text style={S.syncBtnT}>
                      {calendarSyncStatus === 'syncing' ? '⟳ Syncing...' : calendarSyncStatus === 'success' ? '✓ Synced!' : '⟳ Sync Now'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.syncBtn, { flex: 1, backgroundColor: C.error + '30' }]}
                    onPress={signOutGoogle}
                  >
                    <Text style={[S.syncBtnT, { color: C.error }]}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[S.setOpt, { marginTop: 12, backgroundColor: C.primary + '20' }]}
                  onPress={() => createFocusBlock(60)}
                >
                  <Text style={S.setOptE}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={S.setOptT}>Create Focus Block</Text>
                    <Text style={S.setOptD}>Block 1 hour for deep work</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Voice Input */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>🎤 Voice Input</Text>
            <View style={S.setOpt}>
              <Text style={S.setOptE}>🗣️</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.setOptT}>Voice Commands</Text>
                <Text style={S.setOptD}>Tap the mic button to add tasks by voice</Text>
              </View>
              <Switch
                value={profile.voiceEnabled !== false}
                onValueChange={(v) => setProfile(p => ({ ...p, voiceEnabled: v }))}
                trackColor={{ false: C.surface, true: C.primary }}
              />
            </View>
            <View style={S.setOpt}>
              <Text style={S.setOptE}>🔊</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.setOptT}>Nero Voice Responses</Text>
                <Text style={S.setOptD}>Let Nero read responses aloud</Text>
              </View>
              <Switch
                value={profile.neroVoiceEnabled === true}
                onValueChange={(v) => setProfile(p => ({ ...p, neroVoiceEnabled: v }))}
                trackColor={{ false: C.surface, true: C.primary }}
              />
            </View>
          </View>

          {/* Push Notifications */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>🔔 Native Notifications</Text>
            {expoPushToken ? (
              <View style={[S.setOpt, S.setOptSel]}>
                <Text style={S.setOptE}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.setOptT}>Push Notifications Enabled</Text>
                  <Text style={S.setOptD}>You'll receive reminders even when the app is closed</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={S.setOpt}
                onPress={() => nativeNotificationService.initialize().then(setExpoPushToken)}
              >
                <Text style={S.setOptE}>🔕</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.setOptT}>Enable Push Notifications</Text>
                  <Text style={S.setOptD}>Get reminders on your device</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[S.setOpt, { marginTop: 8 }]}
              onPress={() => nativeNotificationService.scheduleDailyCheckIn(9, 0)}
            >
              <Text style={S.setOptE}>☀️</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.setOptT}>Daily Morning Check-in</Text>
                <Text style={S.setOptD}>Get a gentle nudge at 9 AM</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Account & Sync */}
          <View style={S.setSec}>
            <Text style={S.setSecT}>👤 Account</Text>
            {user ? (
              <>
                <View style={[S.setOpt, S.setOptSel]}>
                  <Text style={S.setOptE}>✓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={S.setOptT}>Signed In</Text>
                    <Text style={S.setOptD}>{user.email}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={[S.setOpt, { marginTop: 8, backgroundColor: C.primary + '20' }]}
                  onPress={() => setShowNudgeSetup(true)}
                >
                  <Text style={S.setOptE}>⏰</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={S.setOptT}>Smart Nudge Setup</Text>
                    <Text style={S.setOptD}>Configure personalized notification timing</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[S.dangerBtn, { marginTop: 12 }]}
                  onPress={() => {
                    signOut();
                    setScreen('auth');
                  }}
                >
                  <Text style={S.dangerBtnT}>Sign Out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity 
                style={S.setOpt}
                onPress={() => setScreen('auth')}
              >
                <Text style={S.setOptE}>🔐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={S.setOptT}>Sign In</Text>
                  <Text style={S.setOptD}>Sync data across devices</Text>
                </View>
              </TouchableOpacity>
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
            {/* Focus Timer Button */}
            <TouchableOpacity
              style={[S.headBtn, focusTimerService.getCurrentSession() && { backgroundColor: C.primary }]}
              onPress={() => setShowFocusTimer(true)}
            >
              <Text>{focusTimerService.getCurrentSession() ? '⏱️' : '🎯'}</Text>
            </TouchableOpacity>
            {/* Mood Badge */}
            {currentMood && (
              <TouchableOpacity style={S.headBtn} onPress={() => setCurrentMood(null)}>
                <Text>{currentMood === 'low' ? '😔' : currentMood === 'neutral' ? '😐' : '😊'}</Text>
              </TouchableOpacity>
            )}
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

        {/* PROACTIVE CHECK-IN */}
        {activeCheckIn && (
          <ProactiveCheckInCard
            checkIn={activeCheckIn}
            onRespond={handleCheckInResponse}
            onDismiss={handleCheckInDismiss}
          />
        )}

        {/* MOOD TRACKER - Show after energy is set */}
        {energy && !currentMood && view !== 'minimal' && (
          <View style={S.moodPrompt}>
            <Text style={S.moodPromptT}>How are you feeling?</Text>
            <View style={S.moodBtns}>
              {(['low', 'neutral', 'high'] as MoodLevel[]).map((mood) => (
                <TouchableOpacity
                  key={mood}
                  style={S.moodBtn}
                  onPress={() => handleMoodRecorded(mood)}
                >
                  <Text style={S.moodBtnE}>
                    {mood === 'low' ? '😔' : mood === 'neutral' ? '😐' : '😊'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
                  {/* Voice Input Button */}
                  {profile.voiceEnabled !== false && (
                    <TouchableOpacity 
                      style={[S.iconBtn, isRecording && { backgroundColor: C.error + '40' }]} 
                      onPress={isRecording ? stopVoiceInput : startVoiceInput}
                    >
                      <Text>{isRecording ? '⏹️' : '🎤'}</Text>
                    </TouchableOpacity>
                  )}
                  <TextInput
                    style={S.tIn}
                    value={voiceTranscript || input}
                    onChangeText={setInput}
                    placeholder={isRecording ? 'Listening...' : `Talk to ${profile.neroName}...`}
                    placeholderTextColor={isRecording ? C.error : C.textMuted}
                    multiline
                    onSubmitEditing={sendMessage}
                  />
                  <TouchableOpacity style={S.sendBtn} onPress={sendMessage} disabled={typing}>
                    <Text style={S.sendBtnT}>{typing ? '...' : '→'}</Text>
                  </TouchableOpacity>
                </View>
                {/* Nero Speaking Indicator */}
                {neroSpeaking && (
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: C.primary + '20', borderRadius: 8, marginTop: 4 }}
                    onPress={stopNeroSpeaking}
                  >
                    <Text style={{ color: C.primary, marginRight: 8 }}>🔊</Text>
                    <Text style={{ color: C.text, flex: 1 }}>{profile.neroName} is speaking...</Text>
                    <Text style={{ color: C.textMuted }}>Tap to stop</Text>
                  </TouchableOpacity>
                )}
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

              {/* Swipe hint */}
              <View style={S.swipeHint}>
                <Text style={S.swipeHintT}>← Skip • Swipe tasks • Complete →</Text>
              </View>

              <ScrollView style={S.taskList}>
                {filteredTasks.map(task => (
                  <View key={task.id} style={S.swipeContainer}>
                    {/* Background actions revealed on swipe */}
                    <View style={S.swipeBgLeft}>
                      <Text style={S.swipeBgText}>⏭️ Skip</Text>
                    </View>
                    <View style={S.swipeBgRight}>
                      <Text style={S.swipeBgText}>✓ Done</Text>
                    </View>

                    {/* Swipeable task */}
                    <Animated.View
                      style={[
                        S.taskI,
                        task.isMicroStep && S.taskIMicro,
                        swipingTaskId === task.id && { transform: [{ translateX: swipeAnim }] }
                      ]}
                      {...(!task.completed ? createPanResponder(task.id) : {})}
                    >
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
                      {task.calendarEventId && <Text style={S.microL}>📅</Text>}
                      {!task.completed && profile.calendarConnected && !task.calendarEventId && (
                        <TouchableOpacity onPress={() => scheduleTaskOnCalendar(task.id)}>
                          <Text style={S.taskA}>📅</Text>
                        </TouchableOpacity>
                      )}
                      {!task.isMicroStep && !task.completed && (
                        <TouchableOpacity onPress={() => breakdownTask(task.id)}>
                          <Text style={S.taskA}>🔨</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => setTasks(p => p.filter(t => t.id !== task.id))}>
                        <Text style={S.taskA}>🗑️</Text>
                      </TouchableOpacity>
                    </Animated.View>
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

          {/* INSIGHTS VIEW (Combined Timeline + Dashboard) */}
          {view === 'insights' && (
            <ScrollView style={S.dashC}>
              {/* Quick Stats - Simplified */}
              <View style={S.dashStats}>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{completedToday}</Text>
                  <Text style={S.dashSL}>Today</Text>
                </View>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.tasksCompleted}</Text>
                  <Text style={S.dashSL}>Total</Text>
                </View>
                <View style={S.dashS}>
                  <Text style={S.dashSV}>{stats.lowEnergyWins}</Text>
                  <Text style={S.dashSL}>Low E Wins</Text>
                </View>
              </View>
              {/* CONTEXT BREADCRUMB TRAIL - Where You Left Off */}
              <BreadcrumbTrail
                compact={true}
                maxItems={5}
                onTaskSelect={(taskId, taskTitle) => {
                  // Find and highlight the task
                  const task = tasks.find(t => t.id === taskId);
                  if (task && !task.completed) {
                    setView('oneThing');
                  }
                }}
                onSnapshotRestore={(snapshot) => {
                  celebrate('Context restored! 🔄');
                }}
              />

              {/* Simple Pattern Insight - One Key Message */}
              <View style={[S.insightCard, { marginBottom: 16 }]}>
                <Text style={S.insightEmoji}>⚡</Text>
                <View style={S.insightContent}>
                  <Text style={S.insightTitle}>Your Best Time</Text>
                  <Text style={S.insightText}>
                    {patternService.getPeakHours().length > 0
                      ? `You work best around ${patternService.getPeakHours().map(h => {
                          const hour12 = h % 12 || 12;
                          const ampm = h >= 12 ? 'PM' : 'AM';
                          return `${hour12}${ampm}`;
                        }).slice(0, 2).join(' and ')}`
                      : 'Complete some tasks to discover your patterns!'}
                  </Text>
                </View>
              </View>

              {/* Today's Schedule - Compact */}
              <Text style={S.timeTitle}>Today's Schedule</Text>
              <Text style={S.timeSubtitle}>{calendarEvents.length} events</Text>

              {profile.calendarConnected && (
                <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                  <TouchableOpacity
                    style={[S.syncBtn, { flex: 1 }]}
                    onPress={() => createFocusBlock(30)}
                  >
                    <Text style={S.syncBtnT}>🎯 30min</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.syncBtn, { flex: 1 }]}
                    onPress={() => createFocusBlock(60)}
                  >
                    <Text style={S.syncBtnT}>🎯 1hr</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[S.syncBtn, { flex: 1, backgroundColor: C.surface }]}
                    onPress={syncCalendarEvents}
                  >
                    <Text style={[S.syncBtnT, { color: C.text }]}>⟳</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Simplified Timeline - Only show 6 hours around now */}
              {(() => {
                const now = new Date();
                const currentHour = now.getHours();
                const startHour = Math.max(6, currentHour - 2);
                const endHour = Math.min(22, currentHour + 4);
                const hours = [];
                for (let h = startHour; h <= endHour; h++) hours.push(h);

                return hours.map(hour => {
                  const isNow = currentHour === hour;
                  const isPast = currentHour > hour;
                  const event = calendarEvents.find(e => new Date(e.start).getHours() === hour);

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
                });
              })()}

              {/* Weekly Trend - Simple */}
              <View style={[S.insightCard, { marginTop: 16 }]}>
                <Text style={S.insightEmoji}>
                  {patternService.getWeeklyTrend() === 'improving' ? '📈' : patternService.getWeeklyTrend() === 'declining' ? '📉' : '➡️'}
                </Text>
                <View style={S.insightContent}>
                  <Text style={S.insightTitle}>This Week</Text>
                  <Text style={S.insightText}>
                    {patternService.getWeeklyTrend() === 'improving'
                      ? "Better than last week! 🎉"
                      : patternService.getWeeklyTrend() === 'declining'
                      ? "Slower week - that's okay! 💙"
                      : "Steady pace! ✨"}
                  </Text>
                </View>
              </View>

              {/* Achievements - Compact, only unlocked */}
              <Text style={[S.achT, { marginTop: 16 }]}>
                Achievements ({achievements.length})
              </Text>
              <View style={S.achG}>
                {ACHIEVEMENTS.filter(a => achievements.includes(a.id)).slice(0, 6).map(a => (
                  <View key={a.id} style={S.achI}>
                    <Text style={S.achE}>{a.emoji}</Text>
                    <Text style={S.achN}>{a.name}</Text>
                  </View>
                ))}
                {achievements.length === 0 && (
                  <Text style={S.emptyListT}>Complete tasks to unlock achievements! 🏆</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>

        {/* FLOATING "I'M STUCK" BUTTON */}
        {!isStuckMode && view !== 'conversation' && (
          <TouchableOpacity
            style={S.stuckFab}
            onPress={enterStuckMode}
            activeOpacity={0.8}
          >
            <Text style={S.stuckFabT}>😵‍💫</Text>
            <Text style={S.stuckFabL}>Stuck?</Text>
          </TouchableOpacity>
        )}


        {/* VOICE INPUT FLOATING BUTTON */}
        <VoiceInputButton
          apiKey={profile.apiKey || ''}
          onTaskCaptured={(text) => {
            // Add the task
            const newT: Task = {
              id: genId(),
              title: text,
              energy: energy || 'medium',
              completed: false,
              isMicroStep: false,
              createdAt: new Date().toISOString(),
            };
            setTasks(prev => [newT, ...prev]);
            // Track breadcrumb
            getContextBreadcrumbService().trackTaskStart(newT.id, newT.title, newT.energy);
            celebrate('Task captured! ✨');
          }}
          onThoughtCaptured={(text) => {
            // Add to thought dumps
            setThoughtDumps(prev => [{ id: genId(), text, timestamp: new Date().toISOString() }, ...prev]);
            getContextBreadcrumbService().trackThought(text);
            celebrate('Thought captured! 💭');
          }}
          onReminderCaptured={(text) => {
            // Add as high-priority task
            const newT: Task = {
              id: genId(),
              title: `⏰ ${text}`,
              energy: 'low',
              completed: false,
              isMicroStep: false,
              createdAt: new Date().toISOString(),
            };
            setTasks(prev => [newT, ...prev]);
            celebrate('Reminder set! ⏰');
          }}
          position="bottomLeft"
          disabled={!profile.apiKey}
        />

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

        {/* Focus Timer Modal */}
        <Modal visible={showFocusTimer} transparent animationType="slide">
          <View style={S.mO}>
            <View style={[S.mC, { maxHeight: '90%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={S.mT}>⏱️ Focus Timer</Text>
                <TouchableOpacity onPress={() => setShowFocusTimer(false)}>
                  <Text style={{ fontSize: 24, color: C.textMuted }}>×</Text>
                </TouchableOpacity>
              </View>
              <FocusTimer
                service={focusTimerService}
                currentTaskId={nextTask?.id}
                currentTaskTitle={nextTask?.title}
                energy={energy}
                mood={currentMood}
                onSessionComplete={handleFocusSessionComplete}
                onBreakStart={() => {
                  // Optional: notification for break
                  nativeNotificationService.scheduleNotification(
                    '☕ Break Time!',
                    'Great work! Take a well-deserved break.',
                    { seconds: 1 }
                  );
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Task Suggestions Modal */}
        {showSuggestions && taskSuggestions.length > 0 && view === 'oneThing' && (
          <View style={S.suggestionsOverlay}>
            <TaskSuggestions
              service={contextSuggestionService}
              tasks={tasks}
              energy={energy}
              mood={currentMood}
              onSelectTask={(taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                  // Move selected task to top
                  setTasks(prev => [task, ...prev.filter(t => t.id !== taskId)]);
                }
                setShowSuggestions(false);
              }}
              onCompleteTask={(taskId) => {
                completeTask(taskId);
                setShowSuggestions(false);
              }}
            />
            <TouchableOpacity
              style={S.dismissSuggestions}
              onPress={() => setShowSuggestions(false)}
            >
              <Text style={S.dismissSuggestionsT}>Dismiss suggestions</Text>
            </TouchableOpacity>
          </View>
        )}


        {/* Weekly Report Modal */}
        <Modal visible={showWeeklyReport} transparent animationType="slide">
          <View style={S.mO}>
            <View style={[S.mC, { maxHeight: '90%' }]}>
              {weeklyReport && (
                <WeeklyReportCard
                  report={weeklyReport}
                  onDismiss={() => setShowWeeklyReport(false)}
                  onViewDetails={() => {
                    setShowWeeklyReport(false);
                    setView('dashboard');
                  }}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* Smart Nudge Setup Modal */}
        <Modal visible={showNudgeSetup} transparent animationType="slide">
          <View style={S.mO}>
            <View style={[S.mC, { maxHeight: '90%' }]}>
              {user && (
                <SmartNudgeSetup
                  userId={user.id}
                  onClose={() => setShowNudgeSetup(false)}
                  onNudgesUpdated={() => {
                    // Refresh nudges or show confirmation
                    console.log('Nudges updated');
                  }}
                />
              )}
            </View>
          </View>
        </Modal>

        {/* STUCK/PARALYSIS MODE MODAL */}
        <Modal visible={isStuckMode} transparent animationType="fade">
          <View style={S.stuckOverlay}>
            <View style={S.stuckCard}>
              <TouchableOpacity style={S.stuckClose} onPress={() => handleStuckAction('exit')}>
                <Text style={S.stuckCloseT}>×</Text>
              </TouchableOpacity>

              <Text style={S.stuckEmoji}>😵‍💫</Text>
              <Text style={S.stuckTitle}>Feeling Stuck?</Text>
              <Text style={S.stuckMessage}>{stuckMessage}</Text>

              {stuckStep === 0 && (
                <View style={S.stuckActions}>
                  <TouchableOpacity style={S.stuckBtn} onPress={() => handleStuckAction('body')}>
                    <Text style={S.stuckBtnE}>🚶</Text>
                    <Text style={S.stuckBtnT}>Move my body</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.stuckBtn} onPress={() => handleStuckAction('micro')}>
                    <Text style={S.stuckBtnE}>🔬</Text>
                    <Text style={S.stuckBtnT}>Tiny step</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.stuckBtn} onPress={() => handleStuckAction('random')}>
                    <Text style={S.stuckBtnE}>🎲</Text>
                    <Text style={S.stuckBtnT}>Pick for me</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.stuckBtn} onPress={() => handleStuckAction('validate')}>
                    <Text style={S.stuckBtnE}>💙</Text>
                    <Text style={S.stuckBtnT}>Just validate me</Text>
                  </TouchableOpacity>
                </View>
              )}

              {stuckStep > 0 && stuckStep < 4 && (
                <View style={S.stuckActions}>
                  <TouchableOpacity style={S.stuckBtnPrimary} onPress={() => handleStuckAction('exit')}>
                    <Text style={S.stuckBtnPrimaryT}>I'll try that</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.stuckBtnSec} onPress={() => setStuckStep(0)}>
                    <Text style={S.stuckBtnSecT}>Something else</Text>
                  </TouchableOpacity>
                </View>
              )}

              {stuckStep === 4 && (
                <View style={S.stuckActions}>
                  <TouchableOpacity style={S.stuckBtnPrimary} onPress={() => handleStuckAction('exit')}>
                    <Text style={S.stuckBtnPrimaryT}>Thanks, I needed that 💙</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={S.stuckBtnSec} onPress={() => setStuckStep(0)}>
                    <Text style={S.stuckBtnSecT}>I want to try something</Text>
                  </TouchableOpacity>
                </View>
              )}
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

  // Task Suggestions Overlay
  suggestionsOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  dismissSuggestions: { alignItems: 'center', paddingVertical: 12, marginHorizontal: 16 },
  dismissSuggestionsT: { color: C.textMuted, fontSize: 14 },

  // Mood Prompt
  moodPrompt: { backgroundColor: C.card, marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border },
  moodPromptT: { color: C.text, fontSize: 14, marginBottom: 12, textAlign: 'center' },
  moodBtns: { flexDirection: 'row', justifyContent: 'space-around' },
  moodBtn: { padding: 12, borderRadius: 12, backgroundColor: C.surface, minWidth: 60, alignItems: 'center' },
  moodBtnE: { fontSize: 24 },

  // Focus Timer Button
  focusTimerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, marginHorizontal: 16, marginBottom: 16, paddingVertical: 14, borderRadius: 16, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  focusTimerBtnT: { color: C.text, fontSize: 16, fontWeight: '700', marginLeft: 8 },

  // ============ STUCK MODE STYLES ============
  stuckFab: { position: 'absolute', right: 16, bottom: 90, backgroundColor: C.card, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, borderWidth: 1, borderColor: C.border },
  stuckFabT: { fontSize: 20, marginRight: 6 },
  stuckFabL: { color: C.textSec, fontSize: 12, fontWeight: '600' },

  stuckOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  stuckCard: { backgroundColor: C.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  stuckClose: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center' },
  stuckCloseT: { color: C.textMuted, fontSize: 24, lineHeight: 26 },
  stuckEmoji: { fontSize: 56, marginBottom: 16 },
  stuckTitle: { color: C.text, fontSize: 24, fontWeight: '700', marginBottom: 8 },
  stuckMessage: { color: C.textSec, fontSize: 16, textAlign: 'center', marginBottom: 24, lineHeight: 24 },

  stuckActions: { width: '100%', gap: 10 },
  stuckBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  stuckBtnE: { fontSize: 24, marginRight: 12 },
  stuckBtnT: { color: C.text, fontSize: 15, fontWeight: '500' },

  stuckBtnPrimary: { backgroundColor: C.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  stuckBtnPrimaryT: { color: C.text, fontSize: 16, fontWeight: '700' },
  stuckBtnSec: { backgroundColor: 'transparent', borderRadius: 14, padding: 14, alignItems: 'center' },
  stuckBtnSecT: { color: C.textSec, fontSize: 14 },

  // ============ SWIPE GESTURE STYLES ============
  swipeHint: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: C.surface, borderRadius: 8, marginHorizontal: 16, marginBottom: 8, alignItems: 'center' },
  swipeHintT: { color: C.textMuted, fontSize: 11, fontWeight: '500' },

  swipeContainer: { position: 'relative', marginBottom: 8, overflow: 'hidden', borderRadius: 14 },
  swipeBgLeft: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, backgroundColor: C.warning, justifyContent: 'center', paddingLeft: 16, borderRadius: 14 },
  swipeBgRight: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, backgroundColor: C.success, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 16, borderRadius: 14 },
  swipeBgText: { color: C.bg, fontSize: 14, fontWeight: '700' },
});

