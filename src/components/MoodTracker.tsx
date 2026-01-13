import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { C, getMoodEmoji, getMoodColor } from '../constants';
import { MoodTrackingService } from '../services/MoodTrackingService';
import { MoodLevel, EnergyLevel, MoodPattern } from '../types';

interface MoodTrackerProps {
  service: MoodTrackingService;
  energy: EnergyLevel | null;
  onMoodRecorded: (mood: MoodLevel) => void;
}

export function MoodTracker({
  service,
  energy,
  onMoodRecorded,
}: MoodTrackerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  const recentMood = service.getRecentMood();
  const pattern = service.getPatternData();
  const daysTracked = service.getDaysTracked();

  const recordMood = (mood: MoodLevel) => {
    setSelectedMood(mood);
    if (!showDetails) {
      // Quick record without notes
      service.recordMood(mood, energy || undefined, undefined, 'checkin');
      onMoodRecorded(mood);
    }
  };

  const submitWithNotes = () => {
    if (selectedMood) {
      service.recordMood(selectedMood, energy || undefined, notes || undefined, 'checkin');
      onMoodRecorded(selectedMood);
      setShowDetails(false);
      setNotes('');
      setSelectedMood(null);
    }
  };

  const formatCorrelation = (value: number): string => {
    if (value > 0.5) return 'Strong positive';
    if (value > 0.2) return 'Moderate positive';
    if (value > -0.2) return 'Neutral';
    if (value > -0.5) return 'Moderate negative';
    return 'Strong negative';
  };

  return (
    <View style={styles.container}>
      {/* Quick Mood Check */}
      <View style={styles.quickCheck}>
        <Text style={styles.label}>How are you feeling?</Text>
        <View style={styles.moodButtons}>
          {(['low', 'neutral', 'high'] as MoodLevel[]).map((mood) => (
            <TouchableOpacity
              key={mood}
              style={[
                styles.moodButton,
                recentMood === mood && styles.moodButtonActive,
                { borderColor: getMoodColor(mood) },
              ]}
              onPress={() => recordMood(mood)}
              onLongPress={() => {
                setSelectedMood(mood);
                setShowDetails(true);
              }}
            >
              <Text style={styles.moodEmoji}>{getMoodEmoji(mood)}</Text>
              <Text style={styles.moodLabel}>
                {mood === 'low' ? 'Low' : mood === 'neutral' ? 'Okay' : 'Good'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>Long press to add notes</Text>
      </View>

      {/* Mood Insight Card */}
      {daysTracked >= 3 && (
        <TouchableOpacity
          style={styles.insightCard}
          onPress={() => setShowInsights(true)}
        >
          <Text style={styles.insightEmoji}>🎭</Text>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Mood Insight</Text>
            <Text style={styles.insightText}>{service.getMoodInsight()}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Days Tracked Badge */}
      {daysTracked > 0 && (
        <View style={styles.trackingBadge}>
          <Text style={styles.trackingText}>
            📊 {daysTracked} day{daysTracked !== 1 ? 's' : ''} tracked
          </Text>
        </View>
      )}

      {/* Add Notes Modal */}
      <Modal visible={showDetails} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getMoodEmoji(selectedMood || 'neutral')} How are you feeling?
            </Text>

            <View style={styles.moodSelectRow}>
              {(['low', 'neutral', 'high'] as MoodLevel[]).map((mood) => (
                <TouchableOpacity
                  key={mood}
                  style={[
                    styles.moodSelectButton,
                    selectedMood === mood && styles.moodSelectActive,
                    { borderColor: getMoodColor(mood) },
                  ]}
                  onPress={() => setSelectedMood(mood)}
                >
                  <Text style={styles.moodSelectEmoji}>{getMoodEmoji(mood)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="What's on your mind? (optional)"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowDetails(false);
                  setNotes('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submitWithNotes}
              >
                <Text style={styles.submitButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Insights Modal */}
      <Modal visible={showInsights} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎭 Mood Patterns</Text>

            {/* Correlations */}
            <View style={styles.correlationSection}>
              <Text style={styles.sectionTitle}>Correlations</Text>

              <View style={styles.correlationRow}>
                <Text style={styles.correlationLabel}>Mood & Energy:</Text>
                <Text style={[
                  styles.correlationValue,
                  { color: pattern.moodEnergyCorrelation > 0.2 ? C.success : C.textSec }
                ]}>
                  {formatCorrelation(pattern.moodEnergyCorrelation)}
                </Text>
              </View>

              <View style={styles.correlationRow}>
                <Text style={styles.correlationLabel}>Mood & Productivity:</Text>
                <Text style={[
                  styles.correlationValue,
                  { color: pattern.moodProductivityCorrelation > 0.2 ? C.success : C.textSec }
                ]}>
                  {formatCorrelation(pattern.moodProductivityCorrelation)}
                </Text>
              </View>
            </View>

            {/* Triggers */}
            {pattern.highMoodTriggers.length > 0 && (
              <View style={styles.triggerSection}>
                <Text style={styles.sectionTitle}>😊 What helps your mood</Text>
                {pattern.highMoodTriggers.map((trigger, i) => (
                  <Text key={i} style={styles.triggerText}>• {trigger}</Text>
                ))}
              </View>
            )}

            {pattern.lowMoodTriggers.length > 0 && (
              <View style={styles.triggerSection}>
                <Text style={styles.sectionTitle}>😔 Watch out for</Text>
                {pattern.lowMoodTriggers.map((trigger, i) => (
                  <Text key={i} style={styles.triggerText}>• {trigger}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowInsights(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  quickCheck: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  moodButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  moodButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: C.surface,
    minWidth: 80,
  },
  moodButtonActive: {
    backgroundColor: C.primary + '20',
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: C.textSec,
  },
  hint: {
    fontSize: 11,
    color: C.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: C.primary + '15',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.primary + '30',
  },
  insightEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 13,
    color: C.textSec,
    lineHeight: 18,
  },
  trackingBadge: {
    alignSelf: 'center',
    backgroundColor: C.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  trackingText: {
    fontSize: 12,
    color: C.textMuted,
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
  moodSelectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  moodSelectButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moodSelectActive: {
    backgroundColor: C.primary + '20',
  },
  moodSelectEmoji: {
    fontSize: 28,
  },
  notesInput: {
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 16,
    color: C.text,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: C.bg,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: C.textSec,
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center',
  },
  submitButtonText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
  },
  correlationSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSec,
    marginBottom: 12,
  },
  correlationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  correlationLabel: {
    fontSize: 14,
    color: C.text,
  },
  correlationValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  triggerSection: {
    marginBottom: 16,
  },
  triggerText: {
    fontSize: 13,
    color: C.textSec,
    paddingVertical: 4,
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
