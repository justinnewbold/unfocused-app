// ============ TYPES ============
export type EnergyLevel = 'low' | 'medium' | 'high';
export type ViewMode = 'conversation' | 'oneThing' | 'list' | 'insights';
export type Personality = 'loyalFriend' | 'coach' | 'playful' | 'calm';
export type ThinkingMode = 'off' | 'minimal' | 'full';
export type NotificationStyle = 'gentle' | 'variable' | 'persistent';
export type MoodLevel = 'low' | 'neutral' | 'high';

export interface Task {
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
export interface CompletionRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  energy: EnergyLevel;
  completedAt: string;
  hour: number;
  dayOfWeek: number;
  completionTimeMs?: number;
  mood?: MoodLevel;
}

export interface HourlyProductivity {
  hour: number;
  completions: number;
  avgEnergy: number;
  successRate: number;
}

export interface WeeklyInsight {
  id: string;
  type: 'peak_hours' | 'energy_pattern' | 'suggestion' | 'achievement' | 'warning' | 'proactive_checkin' | 'mood_correlation';
  title: string;
  message: string;
  emoji: string;
  generatedAt: string;
  priority: number;
}

export interface PatternData {
  hourlyStats: HourlyProductivity[];
  peakHours: number[];
  bestDays: number[];
  avgCompletionsByEnergy: Record<EnergyLevel, number>;
  totalCompletions: number;
  weeklyTrend: 'improving' | 'stable' | 'declining';
}

export interface Message {
  id: string;
  role: 'nero' | 'user';
  content: string;
  model?: string;
  thinking?: string;
  timestamp: string;
}

export interface Breadcrumb {
  id: string;
  text: string;
  timestamp: string;
}

export interface SavedContext {
  id: string;
  label: string;
  tasks: string[];
  breadcrumbs: string[];
  energy: EnergyLevel | null;
  timestamp: string;
}

export interface ThoughtDump {
  id: string;
  text: string;
  timestamp: string;
  processed: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  points: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  color?: string;
}

export interface UserProfile {
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
  proactiveCheckinsEnabled?: boolean;
  smartNotificationsEnabled?: boolean;
}

export interface NeroMemory {
  likes: string[];
  dislikes: string[];
  triggers: string[];
  patterns: string[];
}

// ============ FOCUS TIMER TYPES ============
export type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'break' | 'completed';

export interface FocusSession {
  id: string;
  taskId?: string;
  startTime: string;
  endTime?: string;
  duration: number; // in seconds
  breakDuration: number; // in seconds
  status: FocusTimerStatus;
  completedPomodoros: number;
  mood?: MoodLevel;
}

export interface FocusTimerSettings {
  focusDuration: number; // in minutes (default: 25)
  shortBreakDuration: number; // in minutes (default: 5)
  longBreakDuration: number; // in minutes (default: 15)
  pomodorosUntilLongBreak: number; // default: 4
  autoStartBreaks: boolean;
  autoStartNextPomodoro: boolean;
  playSound: boolean;
}

// ============ MOOD TRACKING TYPES ============
export interface MoodEntry {
  id: string;
  mood: MoodLevel;
  timestamp: string;
  notes?: string;
  energy?: EnergyLevel;
  context?: 'morning' | 'afternoon' | 'evening' | 'task_completion' | 'checkin';
}

export interface MoodPattern {
  averageMoodByHour: Record<number, number>;
  averageMoodByDay: Record<number, number>;
  moodEnergyCorrelation: number; // -1 to 1
  moodProductivityCorrelation: number; // -1 to 1
  lowMoodTriggers: string[];
  highMoodTriggers: string[];
}

// ============ PROACTIVE CHECK-IN TYPES ============
export interface ProactiveCheckIn {
  id: string;
  type: 'energy_dip' | 'peak_time' | 'long_inactivity' | 'scheduled' | 'mood_based' | 'pattern_based';
  message: string;
  scheduledTime: string;
  delivered: boolean;
  responded: boolean;
  response?: string;
}

// ============ SMART NOTIFICATION TYPES ============
export interface SmartNotificationContext {
  lastActivityTime: string;
  currentEnergy: EnergyLevel | null;
  currentMood: MoodLevel | null;
  recentCompletions: number;
  peakHours: number[];
  optimalNotificationTimes: number[];
  notificationHistory: NotificationHistoryEntry[];
}

export interface NotificationHistoryEntry {
  id: string;
  type: string;
  sentAt: string;
  acknowledgedAt?: string;
  dismissed: boolean;
  actionTaken: boolean;
}

// ============ CONTEXT-AWARE SUGGESTION TYPES ============
export interface TaskSuggestion {
  id: string;
  taskId: string;
  reason: string;
  confidence: number; // 0-1
  context: SuggestionContext;
}

export interface SuggestionContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  currentEnergy: EnergyLevel | null;
  currentMood: MoodLevel | null;
  isPeakHour: boolean;
  recentActivity: 'high' | 'medium' | 'low';
  calendarContext?: 'free' | 'busy_soon' | 'just_finished';
}
