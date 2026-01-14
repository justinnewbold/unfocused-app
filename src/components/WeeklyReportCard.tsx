// Weekly Report Card Component
// Displays the weekly focus report with stats, trends, and Nero's summary

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { WeeklyReportData } from '../services/WeeklyReportService';

interface WeeklyReportCardProps {
  report: WeeklyReportData;
  onDismiss: () => void;
  onViewDetails?: () => void;
}

const WeeklyReportCard: React.FC<WeeklyReportCardProps> = ({ report, onDismiss, onViewDetails }) => {
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTrendIcon = (change: number): string => {
    if (change > 0) return '↑';
    if (change < 0) return '↓';
    return '→';
  };

  const getTrendColor = (change: number): string => {
    if (change > 0) return '#4CAF50';
    if (change < 0) return '#FF9800';
    return '#9E9E9E';
  };

  const ComparisonBadge = ({ value, label }: { value: number; label: string }) => (
    <View style={[styles.badge, { borderColor: getTrendColor(value) }]}>
      <Text style={[styles.badgeIcon, { color: getTrendColor(value) }]}>
        {getTrendIcon(value)}
      </Text>
      <Text style={styles.badgeValue}>{Math.abs(value)}%</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Week in Focus</Text>
        <Text style={styles.dateRange}>
          {report.weekStart} - {report.weekEnd}
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{report.sessionCount}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatTime(report.totalFocusMinutes)}</Text>
          <Text style={styles.statLabel}>Focus Time</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{report.tasksCompleted}</Text>
          <Text style={styles.statLabel}>Tasks Done</Text>
        </View>
      </View>

      {/* Comparison Badges */}
      <View style={styles.comparisonRow}>
        <ComparisonBadge value={report.comparison.sessionChange} label="sessions" />
        <ComparisonBadge value={report.comparison.focusTimeChange} label="focus" />
        <ComparisonBadge value={report.comparison.tasksChange} label="tasks" />
      </View>

      {/* Best Day/Time */}
      <View style={styles.insightRow}>
        <View style={styles.insight}>
          <Text style={styles.insightEmoji}>📅</Text>
          <Text style={styles.insightText}>Best day: {report.bestDay}</Text>
        </View>
        <View style={styles.insight}>
          <Text style={styles.insightEmoji}>⏰</Text>
          <Text style={styles.insightText}>Peak: {report.bestTimeOfDay}</Text>
        </View>
      </View>

      {/* Nero's Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.neroAvatar}>
          <Text style={styles.neroAvatarText}>N</Text>
        </View>
        <View style={styles.summaryBubble}>
          <Text style={styles.summaryText}>{report.summary}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>Got it!</Text>
        </TouchableOpacity>
        {onViewDetails && (
          <TouchableOpacity style={styles.detailsButton} onPress={onViewDetails}>
            <Text style={styles.detailsText}>See details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  dateRange: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6C63FF',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: '#F8F9FA',
  },
  badgeIcon: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  badgeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
    marginRight: 4,
  },
  badgeLabel: {
    fontSize: 12,
    color: '#666',
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  insightText: {
    fontSize: 14,
    color: '#444',
  },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  neroAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  neroAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryBubble: {
    flex: 1,
    backgroundColor: '#F0EFFF',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
  },
  summaryText: {
    fontSize: 15,
    color: '#1A1A2E',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  dismissButton: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  dismissText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsButton: {
    backgroundColor: '#F0EFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  detailsText: {
    color: '#6C63FF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WeeklyReportCard;
