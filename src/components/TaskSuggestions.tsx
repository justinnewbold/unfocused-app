import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { C, getEC, getEE } from '../constants';
import { ContextAwareSuggestionService } from '../services/ContextAwareSuggestionService';
import { Task, EnergyLevel, MoodLevel, TaskSuggestion } from '../types';

interface TaskSuggestionsProps {
  service: ContextAwareSuggestionService;
  tasks: Task[];
  energy: EnergyLevel | null;
  mood: MoodLevel | null;
  onSelectTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

export function TaskSuggestions({
  service,
  tasks,
  energy,
  mood,
  onSelectTask,
  onCompleteTask,
}: TaskSuggestionsProps) {
  const suggestions = service.getSuggestions(tasks, energy, mood, 3);

  if (suggestions.length === 0) {
    return null;
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence > 0.8) return C.success;
    if (confidence > 0.6) return C.gold;
    return C.textSec;
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence > 0.8) return 'Great match';
    if (confidence > 0.6) return 'Good fit';
    return 'Could work';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Suggested for you</Text>
        <Text style={styles.subtitle}>Based on your patterns and current context</Text>
      </View>

      {suggestions.map((suggestion, index) => {
        const task = tasks.find(t => t.id === suggestion.taskId);
        if (!task) return null;

        const isTop = index === 0;

        return (
          <TouchableOpacity
            key={suggestion.id}
            style={[
              styles.suggestionCard,
              isTop && styles.topSuggestion,
            ]}
            onPress={() => onSelectTask(task.id)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.energyDot, { backgroundColor: getEC(task.energy) }]} />
              <View style={styles.cardContent}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {task.title}
                </Text>
                <Text style={styles.reason}>{suggestion.reason}</Text>
              </View>
              {isTop && (
                <View style={styles.topBadge}>
                  <Text style={styles.topBadgeText}>Top Pick</Text>
                </View>
              )}
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.confidenceContainer}>
                <View
                  style={[
                    styles.confidenceBar,
                    { width: `${suggestion.confidence * 100}%` },
                    { backgroundColor: getConfidenceColor(suggestion.confidence) },
                  ]}
                />
              </View>
              <Text style={[styles.confidenceLabel, { color: getConfidenceColor(suggestion.confidence) }]}>
                {getConfidenceLabel(suggestion.confidence)}
              </Text>

              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => onCompleteTask(task.id)}
              >
                <Text style={styles.completeButtonText}>✓</Text>
              </TouchableOpacity>
            </View>

            {isTop && suggestion.context.isPeakHour && (
              <View style={styles.peakIndicator}>
                <Text style={styles.peakText}>⚡ You're in a peak productivity hour!</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Context summary */}
      <View style={styles.contextSummary}>
        <Text style={styles.contextText}>
          {suggestions[0]?.context?.timeOfDay === 'morning' && '🌅 Morning mode • '}
          {suggestions[0]?.context?.timeOfDay === 'afternoon' && '☀️ Afternoon mode • '}
          {suggestions[0]?.context?.timeOfDay === 'evening' && '🌆 Evening mode • '}
          {suggestions[0]?.context?.timeOfDay === 'night' && '🌙 Night mode • '}
          {energy && `${getEE(energy)} ${energy} energy`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: C.textMuted,
  },
  suggestionCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  topSuggestion: {
    borderColor: C.primary,
    borderWidth: 2,
    backgroundColor: C.primary + '10',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  energyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: C.text,
    marginBottom: 4,
  },
  reason: {
    fontSize: 13,
    color: C.textSec,
    lineHeight: 18,
  },
  topBadge: {
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 8,
  },
  topBadgeText: {
    color: C.text,
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  confidenceContainer: {
    flex: 1,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  confidenceBar: {
    height: '100%',
    borderRadius: 2,
  },
  confidenceLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 12,
  },
  completeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeButtonText: {
    color: C.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  peakIndicator: {
    marginTop: 12,
    backgroundColor: C.gold + '20',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  peakText: {
    fontSize: 12,
    color: C.gold,
    fontWeight: '600',
    textAlign: 'center',
  },
  contextSummary: {
    alignItems: 'center',
    marginTop: 8,
  },
  contextText: {
    fontSize: 12,
    color: C.textMuted,
  },
});
