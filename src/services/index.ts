// ============ SERVICE EXPORTS ============

// Core Services
export { FocusTimerService } from './FocusTimerService';
export { MoodTrackingService } from './MoodTrackingService';
export { ProactiveCheckInService } from './ProactiveCheckInService';
export { SmartNotificationService } from './SmartNotificationService';
export { ContextAwareSuggestionService } from './ContextAwareSuggestionService';
export { PatternAnalysisService } from './PatternAnalysisService';
export { DataSyncService } from './DataSyncService';
export { ContextBreadcrumbService } from './ContextBreadcrumbService';
export { SmartNudgeService } from './SmartNudgeService';
export { VoiceInputService } from './VoiceInputService';
export { PushNotificationService, initializePushNotifications, getPushNotificationService } from './PushNotificationService';

// New Feature Services
export { CalendarService, getCalendarService, initializeCalendarService } from './CalendarService';
export { RecurringTaskService, getRecurringTaskService, initializeRecurringTaskService } from './RecurringTaskService';
export { QuickAddWidgetService, getQuickAddWidgetService, initializeQuickAddWidgetService } from './QuickAddWidgetService';
export { FocusMusicService, getFocusMusicService, initializeFocusMusicService } from './FocusMusicService';
export { TaskEstimationService, getTaskEstimationService, initializeTaskEstimationService } from './TaskEstimationService';
export { ConversationalTaskService, getConversationalTaskService, initializeConversationalTaskService } from './ConversationalTaskService';
export { DailyPlanningService, getDailyPlanningService, initializeDailyPlanningService } from './DailyPlanningService';
export { BodyDoublingService, getBodyDoublingService, initializeBodyDoublingService } from './BodyDoublingService';
export { DopamineMenuService, getDopamineMenuService, initializeDopamineMenuService } from './DopamineMenuService';
export { TimeBlindnessService, getTimeBlindnessService, initializeTimeBlindnessService } from './TimeBlindnessService';
export { TransitionService, getTransitionService, initializeTransitionService } from './TransitionService';
export { AccountabilityService, getAccountabilityService, initializeAccountabilityService } from './AccountabilityService';
export { TeamService, getTeamService, initializeTeamService } from './TeamService';
export { CommunityService, getCommunityService, initializeCommunityService } from './CommunityService';
export { DataExportService, getDataExportService, initializeDataExportService } from './DataExportService';
export { MedicationService, getMedicationService, initializeMedicationService } from './MedicationService';
export { SleepService, getSleepService, initializeSleepService } from './SleepService';
export { WeatherService, getWeatherService, initializeWeatherService } from './WeatherService';
export { AccessibilityService, getAccessibilityService, initializeAccessibilityService } from './AccessibilityService';

// Additional Feature Services (Part 3)
export { PanicModeService, getPanicModeService, initializePanicModeService } from './PanicModeService';
export { TaskFreshnessService, getTaskFreshnessService, initializeTaskFreshnessService } from './TaskFreshnessService';
export { TaskImportService, getTaskImportService, initializeTaskImportService } from './TaskImportService';
export { WellnessService, getWellnessService, initializeWellnessService } from './WellnessService';
export { ScreenTimeService, getScreenTimeService, initializeScreenTimeService } from './ScreenTimeService';
export { OfflineQueueService, getOfflineQueueService, initializeOfflineQueueService } from './OfflineQueueService';
export { EncryptionService, getEncryptionService, initializeEncryptionService } from './EncryptionService';
export { DataPortabilityService, getDataPortabilityService, initializeDataPortabilityService } from './DataPortabilityService';
export { PremiumService, getPremiumService, initializePremiumService } from './PremiumService';
export { SystemIntegrationService, getSystemIntegrationService, initializeSystemIntegrationService } from './SystemIntegrationService';

// Re-export types for convenience
export type {
  FocusSession,
  FocusTimerSettings,
  FocusTimerStatus,
  MoodEntry,
  MoodLevel,
  MoodPattern,
  ProactiveCheckIn,
  SmartNotificationContext,
  NotificationHistoryEntry,
  TaskSuggestion,
  SuggestionContext,
  // New types
  RecurrenceRule,
  RecurringTask,
  CalendarProvider,
  CalendarAccount,
  CalendarSettings,
  MusicProvider,
  MusicCategory,
  FocusPlaylist,
  MusicSettings,
  TaskEstimate,
  EstimationPattern,
  DailyPlan,
  DailyReflection,
  BodyDoublingMode,
  BodyDoublingSettings,
  DopamineActivity,
  DopamineMenuItem,
  TimeAnchor,
  TimeVisualization,
  TimeBlindnessSettings,
  TransitionType,
  TransitionPrompt,
  TransitionSettings,
  AccountabilityPartner,
  AccountabilitySettings,
  Team,
  TeamMember,
  SharedTask,
  CommunityPost,
  CommunitySettings,
  ExportFormat,
  ExportOptions,
  ExportResult,
  Medication,
  MedicationLog,
  MedicationCorrelation,
  SleepEntry,
  SleepSettings,
  WeatherData,
  WeatherCorrelation,
  WeatherSettings,
  ColorTheme,
  FontSize,
  HapticSettings,
  AccessibilitySettings,
} from '../types';
