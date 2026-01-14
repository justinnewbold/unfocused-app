// Smart Nudge Setup Component
// Allows users to configure intelligent nudges based on their patterns

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, ActivityIndicator } from 'react-native';
import SmartNudgeService, { OptimalTimeSlot, ScheduledNudge } from '../services/SmartNudgeService';

interface SmartNudgeSetupProps {
  userId: string;
  onClose: () => void;
  onNudgesUpdated?: () => void;
}

const SmartNudgeSetup: React.FC<SmartNudgeSetupProps> = ({ userId, onClose, onNudgesUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimalTimes, setOptimalTimes] = useState<OptimalTimeSlot[]>([]);
  const [recommendedNudges, setRecommendedNudges] = useState<ScheduledNudge[]>([]);
  const [enabledNudges, setEnabledNudges] = useState<Set<string>>(new Set());

  const nudgeService = new SmartNudgeService(userId);

  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    try {
      setLoading(true);
      const times = await nudgeService.findOptimalTimeSlots();
      const nudges = await nudgeService.generateRecommendedNudges();
      
      setOptimalTimes(times);
      setRecommendedNudges(nudges);
      setEnabledNudges(new Set(nudges.map(n => n.id)));
    } catch (error) {
      console.error('Failed to load nudge analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const toggleNudge = (nudgeId: string) => {
    const newEnabled = new Set(enabledNudges);
    if (newEnabled.has(nudgeId)) {
      newEnabled.delete(nudgeId);
    } else {
      newEnabled.add(nudgeId);
    }
    setEnabledNudges(newEnabled);
  };

  const saveNudges = async () => {
    try {
      setSaving(true);
      for (const nudge of recommendedNudges) {
        const isEnabled = enabledNudges.has(nudge.id);
        await nudgeService.saveNudge({ ...nudge, enabled: isEnabled });
      }
      onNudgesUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to save nudges:', error);
    } finally {
      setSaving(false);
    }
  };

  const getNudgeTypeIcon = (type: string): string => {
    switch (type) {
      case 'focus_reminder': return '🎯';
      case 'energy_check': return '⚡';
      case 'task_suggestion': return '✅';
      case 'break_reminder': return '☕';
      default: return '🔔';
    }
  };

  const getNudgeTypeLabel = (type: string): string => {
    switch (type) {
      case 'focus_reminder': return 'Focus Reminder';
      case 'energy_check': return 'Energy Check-in';
      case 'task_suggestion': return 'Task Suggestion';
      case 'break_reminder': return 'Break Reminder';
      default: return 'Notification';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Analyzing your patterns...</Text>
        <Text style={styles.loadingSubtext}>Finding your best times to focus</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Smart Nudges</Text>
        <Text style={styles.subtitle}>
          Based on your focus history, here are the best times for gentle reminders
        </Text>
      </View>

      {/* Optimal Times Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Peak Focus Times</Text>
        {optimalTimes.map((slot, index) => (
          <View key={index} style={styles.timeSlot}>
            <View style={styles.timeSlotLeft}>
              <Text style={styles.timeSlotRank}>#{index + 1}</Text>
              <View>
                <Text style={styles.timeSlotTime}>{formatHour(slot.hour)}</Text>
                <Text style={styles.timeSlotReason}>{slot.reason}</Text>
              </View>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{slot.confidence}%</Text>
              <Text style={styles.confidenceLabel}>match</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Recommended Nudges Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommended Nudges</Text>
        <Text style={styles.sectionSubtitle}>
          Toggle the ones you want. You can always change these later.
        </Text>

        {recommendedNudges.map((nudge) => (
          <View key={nudge.id} style={styles.nudgeItem}>
            <View style={styles.nudgeContent}>
              <View style={styles.nudgeHeader}>
                <Text style={styles.nudgeIcon}>{getNudgeTypeIcon(nudge.type)}</Text>
                <View style={styles.nudgeInfo}>
                  <Text style={styles.nudgeType}>{getNudgeTypeLabel(nudge.type)}</Text>
                  <Text style={styles.nudgeTime}>{nudge.scheduledTime}</Text>
                </View>
              </View>
              <Text style={styles.nudgeMessage}>{nudge.message}</Text>
            </View>
            <Switch
              value={enabledNudges.has(nudge.id)}
              onValueChange={() => toggleNudge(nudge.id)}
              trackColor={{ false: '#E0E0E0', true: '#D4D1FF' }}
              thumbColor={enabledNudges.has(nudge.id) ? '#6C63FF' : '#F4F4F4'}
            />
          </View>
        ))}
      </View>

      {/* Info Note */}
      <View style={styles.infoNote}>
        <Text style={styles.infoIcon}>💡</Text>
        <Text style={styles.infoText}>
          These times are based on your focus history. The more you use the app, 
          the smarter these suggestions get!
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={onClose}
          disabled={saving}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={saveNudges}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Save Nudges</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  header: {
    padding: 24,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeSlotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  timeSlotRank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C63FF',
    marginRight: 16,
    width: 30,
  },
  timeSlotTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  timeSlotReason: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
    maxWidth: 200,
  },
  confidenceBadge: {
    alignItems: 'center',
    backgroundColor: '#F0EFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6C63FF',
  },
  confidenceLabel: {
    fontSize: 10,
    color: '#6C63FF',
  },
  nudgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  nudgeContent: {
    flex: 1,
    marginRight: 12,
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nudgeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  nudgeInfo: {
    flex: 1,
  },
  nudgeType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  nudgeTime: {
    fontSize: 13,
    color: '#6C63FF',
    fontWeight: '500',
  },
  nudgeMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginLeft: 36,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  skipText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 140,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});

export default SmartNudgeSetup;
