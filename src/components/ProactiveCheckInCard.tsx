import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { C } from '../constants';
import { ProactiveCheckIn } from '../types';

interface ProactiveCheckInCardProps {
  checkIn: ProactiveCheckIn;
  onRespond: (response: string) => void;
  onDismiss: () => void;
}

export function ProactiveCheckInCard({
  checkIn,
  onRespond,
  onDismiss,
}: ProactiveCheckInCardProps) {
  const getTypeIcon = (): string => {
    switch (checkIn.type) {
      case 'energy_dip':
        return '🌙';
      case 'peak_time':
        return '⚡';
      case 'long_inactivity':
        return '👋';
      case 'scheduled':
        return '📋';
      case 'mood_based':
        return '💙';
      case 'pattern_based':
        return '📊';
      default:
        return '🔔';
    }
  };

  const getQuickResponses = (): { label: string; response: string }[] => {
    switch (checkIn.type) {
      case 'energy_dip':
        return [
          { label: "I'm okay", response: 'okay' },
          { label: 'Need a break', response: 'break' },
          { label: 'Show easy tasks', response: 'easy_tasks' },
        ];
      case 'peak_time':
        return [
          { label: "Let's do it!", response: 'ready' },
          { label: 'Not right now', response: 'later' },
          { label: 'Show suggestions', response: 'suggestions' },
        ];
      case 'long_inactivity':
        return [
          { label: "I'm back!", response: 'back' },
          { label: 'Taking a break', response: 'break' },
          { label: 'Just checking', response: 'checking' },
        ];
      case 'mood_based':
        return [
          { label: 'Talk to Nero', response: 'talk' },
          { label: 'One tiny task', response: 'tiny_task' },
          { label: 'Just resting', response: 'rest' },
        ];
      default:
        return [
          { label: 'Ready to work', response: 'ready' },
          { label: 'Need more time', response: 'later' },
        ];
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{getTypeIcon()}</Text>
        <Text style={styles.title}>Check-in</Text>
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>×</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.message}>{checkIn.message}</Text>

      <View style={styles.responseButtons}>
        {getQuickResponses().map((response, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.responseButton,
              index === 0 && styles.primaryResponse,
            ]}
            onPress={() => onRespond(response.response)}
          >
            <Text
              style={[
                styles.responseButtonText,
                index === 0 && styles.primaryResponseText,
              ]}
            >
              {response.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 20,
    color: C.textMuted,
    fontWeight: '300',
    marginTop: -2,
  },
  message: {
    fontSize: 16,
    color: C.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  responseButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  responseButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  primaryResponse: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  responseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.textSec,
  },
  primaryResponseText: {
    color: C.text,
  },
});
