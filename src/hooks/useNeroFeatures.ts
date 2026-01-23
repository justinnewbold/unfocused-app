/**
 * useNeroFeatures - Integration hook for Voice Input, Context Breadcrumbs & Push Notifications
 * 
 * This hook provides easy integration of the new ADHD-friendly features:
 * - Voice capture with Whisper transcription
 * - Context breadcrumb tracking
 * - Push notifications for Smart Nudges
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { 
  VoiceInputService, 
  TranscriptionResult, 
  createVoiceInputHandler 
} from '../services/VoiceInputService';

import { 
  getContextBreadcrumbService, 
  initializeContextBreadcrumbs,
  ContextBreadcrumbService,
  Breadcrumb,
  ContextSnapshot 
} from '../services/ContextBreadcrumbService';

import { 
  getPushNotificationService, 
  initializePushNotifications,
  PushNotificationService,
  ScheduledNotification,
  NudgeNotificationType 
} from '../services/PushNotificationService';

export interface NeroFeaturesConfig {
  apiKey?: string; // OpenAI API key for Whisper transcription
  enableVoice?: boolean;
  enableBreadcrumbs?: boolean;
  enableNotifications?: boolean;
  onTaskCapture?: (text: string) => void;
  onThoughtCapture?: (text: string) => void;
  onReminderCapture?: (text: string) => void;
  onNotificationReceived?: (type: NudgeNotificationType, data?: any) => void;
}

export interface NeroFeaturesState {
  // Voice
  isRecording: boolean;
  isTranscribing: boolean;
  lastTranscription: TranscriptionResult | null;
  voiceError: string | null;
  
  // Breadcrumbs
  recentBreadcrumbs: Breadcrumb[];
  breadcrumbSummary: string;
  savedSnapshots: ContextSnapshot[];
  
  // Notifications
  notificationsEnabled: boolean;
  scheduledNotifications: ScheduledNotification[];
  pushToken: string | null;
}

export interface NeroFeaturesActions {
  // Voice actions
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<TranscriptionResult | null>;
  cancelRecording: () => Promise<void>;
  
  // Breadcrumb actions
  trackTaskStart: (taskId: string, taskTitle: string, energy?: 'low' | 'medium' | 'high') => Promise<void>;
  trackTaskComplete: (taskId: string, taskTitle: string) => Promise<void>;
  trackInterruption: (description: string, currentTaskId?: string, currentTaskTitle?: string) => Promise<void>;
  trackSpawn: (newTaskTitle: string, parentTaskId: string, parentTaskTitle: string) => Promise<void>;
  trackThought: (thought: string) => Promise<void>;
  saveContext: (label: string, activeTaskId?: string, activeTaskTitle?: string) => Promise<ContextSnapshot | null>;
  restoreContext: (snapshotId: string) => Promise<ContextSnapshot | null>;
  getLastTaskContext: () => { taskId: string; taskTitle: string } | null;
  
  // Notification actions
  scheduleFocusTimeNudge: (hour: number, minute?: number) => Promise<ScheduledNotification | null>;
  scheduleEnergyCheck: (hour: number, minute?: number) => Promise<ScheduledNotification | null>;
  scheduleBreakReminder: (afterMinutes: number) => Promise<ScheduledNotification | null>;
  scheduleDailyPlanning: (hour?: number, minute?: number) => Promise<ScheduledNotification | null>;
  scheduleWeeklyReview: (dayOfWeek?: number, hour?: number) => Promise<ScheduledNotification | null>;
  cancelNotification: (id: string) => Promise<boolean>;
  cancelAllNotifications: () => Promise<void>;
  sendCelebration: (message: string) => Promise<void>;
}

export function useNeroFeatures(config: NeroFeaturesConfig = {}): [NeroFeaturesState, NeroFeaturesActions] {
  const {
    apiKey = '',
    enableVoice = true,
    enableBreadcrumbs = true,
    enableNotifications = true,
    onTaskCapture,
    onThoughtCapture,
    onReminderCapture,
    onNotificationReceived,
  } = config;

  // Services
  const voiceServiceRef = useRef<VoiceInputService | null>(null);
  const breadcrumbServiceRef = useRef<ContextBreadcrumbService | null>(null);
  const notificationServiceRef = useRef<PushNotificationService | null>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [lastTranscription, setLastTranscription] = useState<TranscriptionResult | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Breadcrumb state
  const [recentBreadcrumbs, setRecentBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [breadcrumbSummary, setBreadcrumbSummary] = useState('');
  const [savedSnapshots, setSavedSnapshots] = useState<ContextSnapshot[]>([]);

  // Notification state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [pushToken, setPushToken] = useState<string | null>(null);

  // Initialize services
  useEffect(() => {
    const init = async () => {
      // Initialize Voice Service
      if (enableVoice && apiKey) {
        voiceServiceRef.current = new VoiceInputService({
          apiKey,
          onRecordingStart: () => setIsRecording(true),
          onRecordingStop: () => setIsRecording(false),
          onTranscriptionComplete: (result) => {
            setLastTranscription(result);
            setIsTranscribing(false);
            
            // Route to appropriate handler
            if (result.type === 'task') onTaskCapture?.(result.text);
            else if (result.type === 'thought') onThoughtCapture?.(result.text);
            else if (result.type === 'reminder') onReminderCapture?.(result.text);
          },
          onError: (error) => {
            setVoiceError(error);
            setIsTranscribing(false);
            setTimeout(() => setVoiceError(null), 5000);
          },
        });
      }

      // Initialize Breadcrumb Service
      if (enableBreadcrumbs) {
        breadcrumbServiceRef.current = await initializeContextBreadcrumbs();
        updateBreadcrumbState();
        
        // Subscribe to changes
        breadcrumbServiceRef.current.subscribe(() => {
          updateBreadcrumbState();
        });
      }

      // Initialize Notification Service
      if (enableNotifications) {
        notificationServiceRef.current = await initializePushNotifications();
        setNotificationsEnabled(true);
        setPushToken(notificationServiceRef.current.getPushToken() || null);
        setScheduledNotifications(notificationServiceRef.current.getScheduledNotifications());
        
        // Set up notification handler
        notificationServiceRef.current.setOnNotificationResponse((response) => {
          const data = response.notification.request.content.data;
          if (data?.type) {
            onNotificationReceived?.(data.type as NudgeNotificationType, data);
          }
        });
      }
    };

    init();

    // Track app state changes for breadcrumbs
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (enableBreadcrumbs && breadcrumbServiceRef.current) {
        if (nextAppState === 'background') {
          breadcrumbServiceRef.current.trackAppState('background');
        } else if (nextAppState === 'active') {
          breadcrumbServiceRef.current.trackAppState('foreground');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      notificationServiceRef.current?.cleanup();
    };
  }, [apiKey, enableVoice, enableBreadcrumbs, enableNotifications]);

  const updateBreadcrumbState = () => {
    if (breadcrumbServiceRef.current) {
      setRecentBreadcrumbs(breadcrumbServiceRef.current.getRecentBreadcrumbs(10));
      setBreadcrumbSummary(breadcrumbServiceRef.current.generateSummary());
      setSavedSnapshots(breadcrumbServiceRef.current.getSnapshots());
    }
  };

  // Voice actions
  const startRecording = useCallback(async () => {
    if (!voiceServiceRef.current) {
      setVoiceError('Voice input not available');
      return false;
    }
    setVoiceError(null);
    return voiceServiceRef.current.startRecording();
  }, []);

  const stopRecording = useCallback(async () => {
    if (!voiceServiceRef.current) return null;
    setIsTranscribing(true);
    return voiceServiceRef.current.stopRecording();
  }, []);

  const cancelRecording = useCallback(async () => {
    if (voiceServiceRef.current) {
      await voiceServiceRef.current.cancelRecording();
    }
  }, []);

  // Breadcrumb actions
  const trackTaskStart = useCallback(async (taskId: string, taskTitle: string, energy?: 'low' | 'medium' | 'high') => {
    await breadcrumbServiceRef.current?.trackTaskStart(taskId, taskTitle, energy);
  }, []);

  const trackTaskComplete = useCallback(async (taskId: string, taskTitle: string) => {
    await breadcrumbServiceRef.current?.trackTaskComplete(taskId, taskTitle);
  }, []);

  const trackInterruption = useCallback(async (description: string, currentTaskId?: string, currentTaskTitle?: string) => {
    await breadcrumbServiceRef.current?.trackInterruption(description, currentTaskId, currentTaskTitle);
  }, []);

  const trackSpawn = useCallback(async (newTaskTitle: string, parentTaskId: string, parentTaskTitle: string) => {
    await breadcrumbServiceRef.current?.trackSpawn(newTaskTitle, parentTaskId, parentTaskTitle);
  }, []);

  const trackThought = useCallback(async (thought: string) => {
    await breadcrumbServiceRef.current?.trackThought(thought);
  }, []);

  const saveContext = useCallback(async (label: string, activeTaskId?: string, activeTaskTitle?: string) => {
    return breadcrumbServiceRef.current?.saveContext(label, { activeTaskId, activeTaskTitle }) || null;
  }, []);

  const restoreContext = useCallback(async (snapshotId: string) => {
    return breadcrumbServiceRef.current?.restoreContext(snapshotId) || null;
  }, []);

  const getLastTaskContext = useCallback(() => {
    const context = breadcrumbServiceRef.current?.getLastTaskContext();
    return context ? { taskId: context.taskId, taskTitle: context.taskTitle } : null;
  }, []);

  // Notification actions
  const scheduleFocusTimeNudge = useCallback(async (hour: number, minute = 0) => {
    return notificationServiceRef.current?.scheduleFocusTimeNudge(hour, minute) || null;
  }, []);

  const scheduleEnergyCheck = useCallback(async (hour: number, minute = 0) => {
    return notificationServiceRef.current?.scheduleEnergyCheck(hour, minute) || null;
  }, []);

  const scheduleBreakReminder = useCallback(async (afterMinutes: number) => {
    return notificationServiceRef.current?.scheduleBreakReminder(afterMinutes) || null;
  }, []);

  const scheduleDailyPlanning = useCallback(async (hour = 9, minute = 0) => {
    return notificationServiceRef.current?.scheduleDailyPlanning(hour, minute) || null;
  }, []);

  const scheduleWeeklyReview = useCallback(async (dayOfWeek = 0, hour = 10) => {
    return notificationServiceRef.current?.scheduleWeeklyReview(dayOfWeek, hour) || null;
  }, []);

  const cancelNotification = useCallback(async (id: string) => {
    const result = await notificationServiceRef.current?.cancelNotification(id);
    if (result) {
      setScheduledNotifications(notificationServiceRef.current?.getScheduledNotifications() || []);
    }
    return result || false;
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    await notificationServiceRef.current?.cancelAllNotifications();
    setScheduledNotifications([]);
  }, []);

  const sendCelebration = useCallback(async (message: string) => {
    await notificationServiceRef.current?.sendCelebration(message);
  }, []);

  // Return state and actions
  const state: NeroFeaturesState = {
    isRecording,
    isTranscribing,
    lastTranscription,
    voiceError,
    recentBreadcrumbs,
    breadcrumbSummary,
    savedSnapshots,
    notificationsEnabled,
    scheduledNotifications,
    pushToken,
  };

  const actions: NeroFeaturesActions = {
    startRecording,
    stopRecording,
    cancelRecording,
    trackTaskStart,
    trackTaskComplete,
    trackInterruption,
    trackSpawn,
    trackThought,
    saveContext,
    restoreContext,
    getLastTaskContext,
    scheduleFocusTimeNudge,
    scheduleEnergyCheck,
    scheduleBreakReminder,
    scheduleDailyPlanning,
    scheduleWeeklyReview,
    cancelNotification,
    cancelAllNotifications,
    sendCelebration,
  };

  return [state, actions];
}

export default useNeroFeatures;