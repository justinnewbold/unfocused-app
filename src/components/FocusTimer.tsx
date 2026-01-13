import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
} from 'react-native';
import { C, getEE, getEC } from '../constants';
import { FocusTimerService } from '../services/FocusTimerService';
import { EnergyLevel, FocusSession, FocusTimerSettings, MoodLevel } from '../types';

interface FocusTimerProps {
  service: FocusTimerService;
  currentTaskId?: string;
  currentTaskTitle?: string;
  energy: EnergyLevel | null;
  mood: MoodLevel | null;
  onSessionComplete: (session: FocusSession) => void;
  onBreakStart: () => void;
}

export function FocusTimer({
  service,
  currentTaskId,
  currentTaskTitle,
  energy,
  mood,
  onSessionComplete,
  onBreakStart,
}: FocusTimerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<FocusTimerSettings>(service.getSettings());

  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    service.setCallbacks({
      onTick: (remaining) => {
        setRemainingSeconds(remaining);
        // Update progress animation
        const total = isBreak
          ? settings.shortBreakDuration * 60
          : settings.focusDuration * 60;
        const progress = remaining / total;
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 900,
          useNativeDriver: false,
        }).start();
      },
      onComplete: (session) => {
        setIsRunning(false);
        setIsPaused(false);
        setCompletedPomodoros(session.completedPomodoros);
        onSessionComplete(session);
      },
      onBreakStart: () => {
        setIsBreak(true);
        onBreakStart();
      },
    });
  }, [service, settings, isBreak]);

  // Pulse animation for running timer
  useEffect(() => {
    if (isRunning && !isPaused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRunning, isPaused]);

  const startSession = () => {
    // Suggest optimal duration based on energy
    const optimalDuration = energy ? service.suggestOptimalDuration(energy) : 25;
    service.setSettings({ focusDuration: optimalDuration });
    setSettings(service.getSettings());

    service.startFocusSession(currentTaskId, mood || undefined);
    setIsRunning(true);
    setIsPaused(false);
    setIsBreak(false);
    setRemainingSeconds(optimalDuration * 60);
    progressAnim.setValue(1);
  };

  const togglePause = () => {
    if (isPaused) {
      service.resume();
      setIsPaused(false);
    } else {
      service.pause();
      setIsPaused(true);
    }
  };

  const stopSession = () => {
    const session = service.stop();
    setIsRunning(false);
    setIsPaused(false);
    setIsBreak(false);
    if (session) {
      onSessionComplete(session);
    }
  };

  const startBreak = (isLong: boolean = false) => {
    service.startBreak(isLong);
    setIsBreak(true);
    const breakDuration = isLong
      ? settings.longBreakDuration
      : settings.shortBreakDuration;
    setRemainingSeconds(breakDuration * 60);
  };

  const skipBreak = () => {
    service.skipBreak();
    setIsBreak(false);
    setRemainingSeconds(settings.focusDuration * 60);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (!isRunning) {
    // Start screen
    return (
      <View style={styles.container}>
        <View style={styles.idleContainer}>
          <Text style={styles.idleEmoji}>⏱️</Text>
          <Text style={styles.idleTitle}>Focus Timer</Text>
          <Text style={styles.idleSubtitle}>
            {energy
              ? `Suggested: ${service.suggestOptimalDuration(energy)} minutes for ${energy} energy`
              : 'Set your energy level for personalized timing'}
          </Text>

          {currentTaskTitle && (
            <View style={styles.taskPreview}>
              <Text style={styles.taskLabel}>Working on:</Text>
              <Text style={styles.taskTitle} numberOfLines={2}>
                {currentTaskTitle}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.startButton} onPress={startSession}>
            <Text style={styles.startButtonText}>Start Focus Session</Text>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{service.getTotalPomodoros()}</Text>
              <Text style={styles.statLabel}>Pomodoros</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{service.getTotalFocusMinutes()}</Text>
              <Text style={styles.statLabel}>Total Minutes</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsButtonText}>⚙️ Timer Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Modal */}
        <Modal visible={showSettings} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Timer Settings</Text>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Focus Duration</Text>
                <View style={styles.durationPicker}>
                  {[10, 15, 20, 25, 30, 45].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.durationOption,
                        settings.focusDuration === mins && styles.durationOptionActive,
                      ]}
                      onPress={() => {
                        service.setSettings({ focusDuration: mins });
                        setSettings(service.getSettings());
                      }}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          settings.focusDuration === mins && styles.durationTextActive,
                        ]}
                      >
                        {mins}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Short Break</Text>
                <View style={styles.durationPicker}>
                  {[3, 5, 10].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[
                        styles.durationOption,
                        settings.shortBreakDuration === mins && styles.durationOptionActive,
                      ]}
                      onPress={() => {
                        service.setSettings({ shortBreakDuration: mins });
                        setSettings(service.getSettings());
                      }}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          settings.shortBreakDuration === mins && styles.durationTextActive,
                        ]}
                      >
                        {mins}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // Active timer screen
  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.timerContainer,
          { transform: [{ scale: pulseAnim }] },
          isBreak && styles.breakContainer,
        ]}
      >
        <View style={styles.progressBg}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth },
              isBreak && styles.breakProgress,
            ]}
          />
        </View>

        <Text style={styles.timerLabel}>
          {isBreak ? '☕ Break Time' : '🎯 Focus Mode'}
        </Text>

        <Text style={styles.timerDisplay}>{formatTime(remainingSeconds)}</Text>

        {currentTaskTitle && !isBreak && (
          <Text style={styles.currentTask} numberOfLines={1}>
            {currentTaskTitle}
          </Text>
        )}

        <View style={styles.pomodoroIndicator}>
          {Array.from({ length: settings.pomodorosUntilLongBreak }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pomodoroDot,
                i < completedPomodoros && styles.pomodoroDotComplete,
              ]}
            />
          ))}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={togglePause}>
            <Text style={styles.controlText}>{isPaused ? '▶️' : '⏸️'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={stopSession}
          >
            <Text style={styles.controlText}>⏹️</Text>
          </TouchableOpacity>

          {isBreak && (
            <TouchableOpacity style={styles.controlButton} onPress={skipBreak}>
              <Text style={styles.controlText}>⏭️</Text>
            </TouchableOpacity>
          )}
        </View>

        {isPaused && !isBreak && (
          <View style={styles.pausedActions}>
            <TouchableOpacity
              style={styles.breakButton}
              onPress={() => startBreak(false)}
            >
              <Text style={styles.breakButtonText}>Take Short Break</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.breakButton, styles.longBreakButton]}
              onPress={() => startBreak(true)}
            >
              <Text style={styles.breakButtonText}>Take Long Break</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  idleContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  idleEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  idleTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  idleSubtitle: {
    fontSize: 14,
    color: C.textSec,
    textAlign: 'center',
    marginBottom: 24,
  },
  taskPreview: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  taskLabel: {
    fontSize: 12,
    color: C.textMuted,
    marginBottom: 4,
  },
  taskTitle: {
    fontSize: 16,
    color: C.text,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: C.primary,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 48,
    marginBottom: 32,
  },
  startButtonText: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
  },
  statLabel: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 4,
  },
  settingsButton: {
    padding: 12,
  },
  settingsButtonText: {
    color: C.textSec,
    fontSize: 14,
  },
  timerContainer: {
    backgroundColor: C.card,
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  breakContainer: {
    backgroundColor: C.teal + '20',
    borderWidth: 2,
    borderColor: C.teal,
  },
  progressBg: {
    width: '100%',
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 4,
  },
  breakProgress: {
    backgroundColor: C.teal,
  },
  timerLabel: {
    fontSize: 16,
    color: C.textSec,
    marginBottom: 8,
  },
  timerDisplay: {
    fontSize: 72,
    fontWeight: '200',
    color: C.text,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  currentTask: {
    fontSize: 14,
    color: C.textSec,
    marginBottom: 16,
  },
  pomodoroIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  pomodoroDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.border,
  },
  pomodoroDotComplete: {
    backgroundColor: C.gold,
  },
  controls: {
    flexDirection: 'row',
    gap: 16,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: C.error + '30',
  },
  controlText: {
    fontSize: 24,
  },
  pausedActions: {
    marginTop: 24,
    gap: 12,
    width: '100%',
  },
  breakButton: {
    backgroundColor: C.teal + '30',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  longBreakButton: {
    backgroundColor: C.teal + '20',
  },
  breakButtonText: {
    color: C.teal,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  settingRow: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 14,
    color: C.textSec,
    marginBottom: 12,
  },
  durationPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  durationOptionActive: {
    borderColor: C.primary,
    backgroundColor: C.primary + '20',
  },
  durationText: {
    color: C.textSec,
    fontSize: 16,
    fontWeight: '600',
  },
  durationTextActive: {
    color: C.primary,
  },
  closeButton: {
    backgroundColor: C.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
