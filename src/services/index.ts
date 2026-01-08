// ============ SERVICE EXPORTS ============
export { FocusTimerService } from './FocusTimerService';
export { MoodTrackingService } from './MoodTrackingService';
export { ProactiveCheckInService } from './ProactiveCheckInService';
export { SmartNotificationService } from './SmartNotificationService';
export { ContextAwareSuggestionService } from './ContextAwareSuggestionService';
export { PatternAnalysisService } from './PatternAnalysisService';

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
} from '../types';
