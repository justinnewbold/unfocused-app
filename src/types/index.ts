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

// ============ RECURRING TASKS TYPES ============
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';
export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // Every X days/weeks/months
  daysOfWeek?: DayOfWeek[]; // For weekly recurrence
  dayOfMonth?: number; // For monthly recurrence
  endDate?: string;
  maxOccurrences?: number;
  occurrencesCompleted?: number;
}

export interface RecurringTask extends Task {
  recurrence: RecurrenceRule;
  nextOccurrence?: string;
  lastCompleted?: string;
}

// ============ CALENDAR TYPES (Extended for Apple Calendar) ============
export type CalendarProvider = 'google' | 'apple' | 'outlook' | 'local';

export interface CalendarAccount {
  id: string;
  provider: CalendarProvider;
  email?: string;
  displayName: string;
  connected: boolean;
  lastSynced?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export interface CalendarSettings {
  defaultProvider: CalendarProvider;
  accounts: CalendarAccount[];
  syncEnabled: boolean;
  autoTimeBlocking: boolean;
  travelTimeBuffer: number; // minutes
}

// ============ FOCUS MUSIC TYPES ============
export type MusicProvider = 'spotify' | 'apple_music' | 'youtube_music' | 'local';
export type MusicCategory = 'focus' | 'lofi' | 'nature' | 'white_noise' | 'brown_noise' | 'binaural' | 'classical';

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  duration: number; // seconds
  category: MusicCategory;
  provider: MusicProvider;
  uri?: string;
}

export interface FocusPlaylist {
  id: string;
  name: string;
  category: MusicCategory;
  tracks: MusicTrack[];
  provider: MusicProvider;
  isDefault?: boolean;
}

export interface MusicSettings {
  enabled: boolean;
  defaultCategory: MusicCategory;
  volume: number; // 0-1
  autoPlayOnFocus: boolean;
  fadeInDuration: number; // seconds
  fadeOutOnBreak: boolean;
  connectedProviders: MusicProvider[];
}

// ============ TASK ESTIMATION LEARNING TYPES ============
export interface TaskEstimate {
  taskId: string;
  estimatedMinutes: number;
  actualMinutes?: number;
  energy: EnergyLevel;
  category?: string;
  completedAt?: string;
}

export interface EstimationPattern {
  category: string;
  avgEstimate: number;
  avgActual: number;
  accuracy: number; // percentage
  sampleSize: number;
  energyModifiers: Record<EnergyLevel, number>; // multipliers
}

export interface EstimationLearning {
  patterns: EstimationPattern[];
  overallAccuracy: number;
  tendencyToOverestimate: boolean;
  suggestedMultiplier: number;
}

// ============ DAILY PLANNING & REFLECTION TYPES ============
export interface DailyPlan {
  id: string;
  date: string;
  topPriority?: string;
  plannedTasks: string[]; // task IDs
  energyPrediction: EnergyLevel;
  intentions: string[];
  createdAt: string;
  reflectionCompleted?: boolean;
}

export interface DailyReflection {
  id: string;
  date: string;
  planId?: string;
  accomplishments: string[];
  challenges: string[];
  gratitude?: string;
  tomorrowFocus?: string;
  mood: MoodLevel;
  energyRating: number; // 1-5
  productivityRating: number; // 1-5
  createdAt: string;
}

// ============ BODY DOUBLING MODE TYPES ============
export type BodyDoublingMode = 'ambient' | 'virtual_coworking' | 'study_stream' | 'focus_sounds';

export interface BodyDoublingSession {
  id: string;
  mode: BodyDoublingMode;
  startTime: string;
  endTime?: string;
  duration?: number; // minutes
  ambientSoundId?: string;
  virtualRoomId?: string;
}

export interface BodyDoublingSettings {
  preferredMode: BodyDoublingMode;
  ambientSounds: string[];
  autoStartWithFocus: boolean;
  showAvatars: boolean;
  muteByDefault: boolean;
}

// ============ DOPAMINE MENU TYPES ============
export type DopamineActivity =
  | 'stretch'
  | 'hydrate'
  | 'snack'
  | 'walk'
  | 'music'
  | 'breathe'
  | 'joke'
  | 'mini_game'
  | 'pet_photo'
  | 'nature_video'
  | 'dance_break';

export interface DopamineMenuItem {
  id: string;
  activity: DopamineActivity;
  title: string;
  description: string;
  emoji: string;
  durationSeconds: number;
  energyBoost: number; // 1-5
  lastUsed?: string;
  useCount: number;
  isFavorite: boolean;
}

export interface DopamineMenuSettings {
  enabledActivities: DopamineActivity[];
  showAfterTaskCompletion: boolean;
  showOnLowEnergy: boolean;
  customItems: DopamineMenuItem[];
}

// ============ TIME BLINDNESS HELPERS TYPES ============
export interface TimeAnchor {
  id: string;
  label: string;
  time: string; // HH:MM format
  isRecurring: boolean;
  days?: DayOfWeek[];
  reminderMinutes: number; // minutes before
  enabled: boolean;
}

export interface TimeVisualization {
  type: 'countdown' | 'progress_bar' | 'pie_chart' | 'analog_clock';
  showRemaining: boolean;
  showElapsed: boolean;
  colorCoded: boolean;
  soundAlerts: boolean;
  vibrationAlerts: boolean;
}

export interface TimeBlindnessSettings {
  anchors: TimeAnchor[];
  visualization: TimeVisualization;
  showRelativeTime: boolean; // "started 2 hours ago"
  periodicTimeReminders: boolean;
  reminderIntervalMinutes: number;
}

// ============ TRANSITION PROMPTS TYPES ============
export type TransitionType = 'task_to_task' | 'break_to_work' | 'work_to_break' | 'context_switch';

export interface TransitionPrompt {
  id: string;
  type: TransitionType;
  message: string;
  action?: string;
  duration: number; // seconds to show
}

export interface TransitionSettings {
  enabled: boolean;
  showBetweenTasks: boolean;
  showBreakTransitions: boolean;
  includeBreathingExercise: boolean;
  transitionDuration: number; // seconds
  customPrompts: TransitionPrompt[];
}

// ============ ACCOUNTABILITY PARTNER TYPES ============
export interface AccountabilityPartner {
  id: string;
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  relationship: 'friend' | 'coach' | 'family' | 'colleague';
  shareLevel: 'summary' | 'detailed' | 'full';
  connectedAt: string;
  lastActive?: string;
}

export interface AccountabilitySettings {
  enabled: boolean;
  partners: AccountabilityPartner[];
  shareCompletions: boolean;
  shareStruggleMoments: boolean;
  allowNudges: boolean;
  dailySummary: boolean;
  weeklySummary: boolean;
}

export interface AccountabilityUpdate {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: 'completion' | 'start' | 'struggle' | 'milestone' | 'nudge' | 'encouragement';
  message: string;
  taskTitle?: string;
  timestamp: string;
  read: boolean;
}

// ============ TEAM/FAMILY MODE TYPES ============
export interface Team {
  id: string;
  name: string;
  type: 'family' | 'work' | 'study_group' | 'custom';
  createdBy: string;
  members: TeamMember[];
  sharedTasks: string[];
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  canAssignTasks: boolean;
  canViewAllTasks: boolean;
}

export interface SharedTask extends Task {
  teamId: string;
  assignedTo?: string[];
  visibility: 'team' | 'assigned_only';
}

// ============ ANONYMOUS COMMUNITY TYPES ============
export interface CommunityPost {
  id: string;
  anonymousId: string;
  type: 'win' | 'struggle' | 'tip' | 'question';
  content: string;
  taskCategory?: string;
  timestamp: string;
  reactions: CommunityReaction[];
  replies: CommunityReply[];
}

export interface CommunityReaction {
  type: 'celebrate' | 'relate' | 'support' | 'helpful';
  count: number;
  hasUserReacted: boolean;
}

export interface CommunityReply {
  id: string;
  anonymousId: string;
  content: string;
  timestamp: string;
  isHelpful: boolean;
}

export interface CommunitySettings {
  enabled: boolean;
  showWins: boolean;
  showStruggles: boolean;
  autoShareMilestones: boolean;
  anonymousName?: string;
}

// ============ DATA EXPORT TYPES ============
export type ExportFormat = 'json' | 'csv' | 'pdf';
export type ExportDataType = 'tasks' | 'focus_sessions' | 'mood' | 'energy' | 'patterns' | 'all';

export interface ExportOptions {
  format: ExportFormat;
  dataTypes: ExportDataType[];
  dateRange: {
    start: string;
    end: string;
  };
  includeAnalytics: boolean;
  includeCharts: boolean;
  anonymize: boolean;
}

export interface ExportResult {
  id: string;
  format: ExportFormat;
  dataTypes: ExportDataType[];
  createdAt: string;
  fileSize: number;
  downloadUrl?: string;
  expiresAt?: string;
}

// ============ MEDICATION TRACKING TYPES ============
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: 'daily' | 'twice_daily' | 'as_needed' | 'weekly';
  scheduledTimes: string[]; // HH:MM format
  notes?: string;
  active: boolean;
  startDate: string;
  endDate?: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  scheduledTime: string;
  takenAt?: string;
  skipped: boolean;
  notes?: string;
  sideEffects?: string[];
  effectivenessRating?: number; // 1-5
}

export interface MedicationCorrelation {
  medicationId: string;
  focusScoreAvg: number;
  energyLevelAvg: number;
  moodAvg: number;
  tasksCompletedAvg: number;
  sampleDays: number;
}

// ============ SLEEP INTEGRATION TYPES ============
export type SleepDataSource = 'apple_health' | 'google_fit' | 'fitbit' | 'oura' | 'manual';

export interface SleepEntry {
  id: string;
  source: SleepDataSource;
  date: string;
  bedTime: string;
  wakeTime: string;
  totalMinutes: number;
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  lightSleepMinutes?: number;
  awakeMinutes?: number;
  sleepQuality?: number; // 1-5
  notes?: string;
}

export interface SleepEnergyCorrelation {
  avgSleepForHighEnergy: number;
  avgSleepForLowEnergy: number;
  optimalSleepRange: { min: number; max: number };
  sleepDebtImpact: number; // correlation coefficient
}

export interface SleepSettings {
  enabled: boolean;
  dataSource: SleepDataSource;
  idealSleepMinutes: number;
  trackSleepDebt: boolean;
  showSleepInsights: boolean;
  bedtimeReminder: boolean;
  bedtimeReminderTime?: string;
}

// ============ WEATHER CORRELATION TYPES ============
export interface WeatherData {
  date: string;
  location?: string;
  temperature: number;
  humidity: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
  uvIndex?: number;
  barometricPressure?: number;
}

export interface WeatherCorrelation {
  condition: string;
  avgProductivity: number;
  avgEnergy: number;
  avgMood: number;
  sampleSize: number;
}

export interface WeatherSettings {
  enabled: boolean;
  useLocation: boolean;
  manualLocation?: string;
  showWeatherInsights: boolean;
  adjustSuggestionsForWeather: boolean;
}

// ============ ACCESSIBILITY SETTINGS TYPES ============
export type ColorTheme = 'dark' | 'light' | 'high_contrast' | 'colorblind_deuteranopia' | 'colorblind_protanopia' | 'colorblind_tritanopia';
export type FontSize = 'small' | 'medium' | 'large' | 'extra_large';

export interface HapticSettings {
  enabled: boolean;
  taskCompletion: boolean;
  notifications: boolean;
  timerAlerts: boolean;
  intensity: 'light' | 'medium' | 'strong';
}

export interface AccessibilitySettings {
  colorTheme: ColorTheme;
  fontSize: FontSize;
  reducedMotion: boolean;
  haptics: HapticSettings;
  screenReaderOptimized: boolean;
  highContrastText: boolean;
  buttonSize: 'normal' | 'large';
  lineSpacing: number; // multiplier
}

// ============ OFFLINE MODE TYPES ============
export interface OfflineAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'task' | 'focus_session' | 'mood' | 'energy';
  data: any;
  timestamp: string;
  synced: boolean;
  retryCount: number;
  error?: string;
}

export interface OfflineSettings {
  enabled: boolean;
  maxQueueSize: number;
  autoSyncOnReconnect: boolean;
  conflictResolution: 'server_wins' | 'client_wins' | 'ask';
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime?: string;
  pendingActions: number;
  syncInProgress: boolean;
  lastError?: string;
}

// ============ DEVICE/PLATFORM TYPES ============
export type DevicePlatform = 'ios' | 'android' | 'web' | 'macos' | 'windows' | 'watchos' | 'wearos';

export interface DeviceSettings {
  platform: DevicePlatform;
  isTablet: boolean;
  supportsHaptics: boolean;
  supportsPushNotifications: boolean;
  supportsBackgroundTasks: boolean;
  preferredLayout: 'compact' | 'standard' | 'expanded';
}

// ============ WIDGET TYPES (Extended) ============
export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetType = 'quick_add' | 'current_task' | 'energy_check' | 'focus_timer' | 'stats';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  position?: number;
  settings?: Record<string, any>;
}

// ============ APPLE WATCH / WEAR OS TYPES ============
export interface WatchComplication {
  id: string;
  type: 'current_task' | 'focus_timer' | 'energy' | 'next_event';
  family: string; // complication family
}

export interface WatchSettings {
  enabled: boolean;
  syncTasks: boolean;
  syncFocusTimer: boolean;
  complications: WatchComplication[];
  hapticAlerts: boolean;
  quickActions: string[];
}

// ============ EXTENDED USER PROFILE ============
export interface ExtendedUserProfile extends UserProfile {
  // Recurring tasks
  recurringTasksEnabled?: boolean;

  // Calendar
  calendarSettings?: CalendarSettings;

  // Music
  musicSettings?: MusicSettings;

  // Planning & Reflection
  dailyPlanningEnabled?: boolean;
  dailyReflectionEnabled?: boolean;
  planningTime?: string; // HH:MM
  reflectionTime?: string; // HH:MM

  // Body doubling
  bodyDoublingSettings?: BodyDoublingSettings;

  // Dopamine menu
  dopamineMenuSettings?: DopamineMenuSettings;

  // Time blindness
  timeBlindnessSettings?: TimeBlindnessSettings;

  // Transitions
  transitionSettings?: TransitionSettings;

  // Accountability
  accountabilitySettings?: AccountabilitySettings;

  // Community
  communitySettings?: CommunitySettings;

  // Medication
  medicationTrackingEnabled?: boolean;
  medications?: Medication[];

  // Sleep
  sleepSettings?: SleepSettings;

  // Weather
  weatherSettings?: WeatherSettings;

  // Accessibility
  accessibilitySettings?: AccessibilitySettings;

  // Offline
  offlineSettings?: OfflineSettings;

  // Device
  deviceSettings?: DeviceSettings;

  // Watch
  watchSettings?: WatchSettings;
}
