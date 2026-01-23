/**
 * BreadcrumbTrail - Visual "where you left off" component
 * 
 * Shows recent context breadcrumbs so users can see what they
 * were doing and quickly restore context after interruptions.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  Breadcrumb,
  BreadcrumbType,
  getContextBreadcrumbService,
  ContextSnapshot,
} from '../services/ContextBreadcrumbService';

interface BreadcrumbTrailProps {
  maxItems?: number;
  onTaskSelect?: (taskId: string, taskTitle: string) => void;
  onSnapshotRestore?: (snapshot: ContextSnapshot) => void;
  compact?: boolean;
}

const COLORS = {
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  background: '#0F0F1A',
  card: '#252542',
  cardHover: '#2D2D4A',
  text: '#FFFFFF',
  textSecondary: '#B8B8D1',
  textMuted: '#6C6C8A',
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF6B6B',
  spawn: '#74B9FF',
};

const TYPE_CONFIG: Record<BreadcrumbType, { icon: string; color: string; label: string }> = {
  task_start: { icon: '▶️', color: COLORS.success, label: 'Started' },
  task_complete: { icon: '✅', color: COLORS.success, label: 'Completed' },
  task_pause: { icon: '⏸️', color: COLORS.warning, label: 'Paused' },
  interruption: { icon: '⚡', color: COLORS.error, label: 'Interrupted' },
  spawn: { icon: '🌱', color: COLORS.spawn, label: 'Spawned' },
  thought: { icon: '💭', color: COLORS.primaryLight, label: 'Thought' },
  energy_change: { icon: '⚡', color: COLORS.warning, label: 'Energy' },
  context_save: { icon: '💾', color: COLORS.primary, label: 'Saved' },
  app_background: { icon: '📱', color: COLORS.textMuted, label: 'Left app' },
  app_foreground: { icon: '📱', color: COLORS.textSecondary, label: 'Returned' },
};

export const BreadcrumbTrail: React.FC<BreadcrumbTrailProps> = ({
  maxItems = 5,
  onTaskSelect,
  onSnapshotRestore,
  compact = false,
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [snapshots, setSnapshots] = useState<ContextSnapshot[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [showAllModal, setShowAllModal] = useState(false);
  const [selectedBreadcrumb, setSelectedBreadcrumb] = useState<Breadcrumb | null>(null);

  useEffect(() => {
    const service = getContextBreadcrumbService();
    
    // Initial load
    updateData();
    
    // Subscribe to changes
    const unsubscribe = service.subscribe(() => {
      updateData();
    });

    return unsubscribe;
  }, [maxItems]);

  const updateData = () => {
    const service = getContextBreadcrumbService();
    setBreadcrumbs(service.getRecentBreadcrumbs(maxItems));
    setSnapshots(service.getSnapshots().slice(0, 3));
    setSummary(service.generateSummary());
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleBreadcrumbPress = (breadcrumb: Breadcrumb) => {
    if (breadcrumb.taskId && breadcrumb.taskTitle) {
      onTaskSelect?.(breadcrumb.taskId, breadcrumb.taskTitle);
    } else {
      setSelectedBreadcrumb(breadcrumb);
    }
  };

  const handleSnapshotPress = async (snapshot: ContextSnapshot) => {
    const service = getContextBreadcrumbService();
    const restored = await service.restoreContext(snapshot.id);
    if (restored) {
      onSnapshotRestore?.(restored);
    }
  };

  const renderBreadcrumbItem = (breadcrumb: Breadcrumb, index: number) => {
    const config = TYPE_CONFIG[breadcrumb.type];
    const isClickable = !!breadcrumb.taskId;

    return (
      <TouchableOpacity
        key={breadcrumb.id}
        style={[
          styles.breadcrumbItem,
          compact && styles.breadcrumbItemCompact,
          index === 0 && styles.breadcrumbItemFirst,
        ]}
        onPress={() => handleBreadcrumbPress(breadcrumb)}
        activeOpacity={isClickable ? 0.7 : 1}
      >
        {/* Timeline connector */}
        {index > 0 && <View style={styles.connector} />}
        
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
          <Text style={styles.icon}>{config.icon}</Text>
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.label} numberOfLines={1}>
            {breadcrumb.label}
          </Text>
          <Text style={styles.time}>{formatTime(breadcrumb.timestamp)}</Text>
        </View>
        
        {/* Tap indicator for tasks */}
        {isClickable && (
          <Text style={styles.tapIndicator}>→</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderCompact = () => (
    <View style={styles.compactContainer}>
      <TouchableOpacity 
        style={styles.compactHeader}
        onPress={() => setShowAllModal(true)}
      >
        <Text style={styles.compactTitle}>🧵 Context Trail</Text>
        <Text style={styles.compactSummary}>{summary}</Text>
        <Text style={styles.expandButton}>View all →</Text>
      </TouchableOpacity>
      
      {/* Last context */}
      {breadcrumbs.length > 0 && (
        <View style={styles.lastContext}>
          <Text style={styles.lastContextLabel}>Last activity:</Text>
          <Text style={styles.lastContextText}>{breadcrumbs[0].label}</Text>
        </View>
      )}
    </View>
  );

  const renderFull = () => (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🧵 Where You Left Off</Text>
        <TouchableOpacity onPress={() => setShowAllModal(true)}>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <Text style={styles.summary}>{summary}</Text>

      {/* Breadcrumb list */}
      <ScrollView 
        style={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {breadcrumbs.length === 0 ? (
          <Text style={styles.emptyText}>
            No activity tracked yet. Start a task to begin your trail!
          </Text>
        ) : (
          breadcrumbs.map((b, i) => renderBreadcrumbItem(b, i))
        )}
      </ScrollView>

      {/* Saved snapshots */}
      {snapshots.length > 0 && (
        <View style={styles.snapshotsSection}>
          <Text style={styles.snapshotsTitle}>💾 Saved Contexts</Text>
          {snapshots.map((snapshot) => (
            <TouchableOpacity
              key={snapshot.id}
              style={styles.snapshotItem}
              onPress={() => handleSnapshotPress(snapshot)}
            >
              <Text style={styles.snapshotLabel}>{snapshot.label}</Text>
              <Text style={styles.snapshotMeta}>
                {snapshot.breadcrumbCount} items • {formatTime(snapshot.savedAt)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <>
      {compact ? renderCompact() : renderFull()}

      {/* All breadcrumbs modal */}
      <Modal
        visible={showAllModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAllModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🧵 Full Context Trail</Text>
              <TouchableOpacity onPress={() => setShowAllModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalList}>
              {getContextBreadcrumbService()
                .getRecentBreadcrumbs(50)
                .map((b, i) => renderBreadcrumbItem(b, i))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Breadcrumb detail modal */}
      <Modal
        visible={!!selectedBreadcrumb}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedBreadcrumb(null)}
      >
        <TouchableOpacity 
          style={styles.detailOverlay}
          activeOpacity={1}
          onPress={() => setSelectedBreadcrumb(null)}
        >
          <View style={styles.detailContent}>
            {selectedBreadcrumb && (
              <>
                <Text style={styles.detailIcon}>
                  {TYPE_CONFIG[selectedBreadcrumb.type].icon}
                </Text>
                <Text style={styles.detailLabel}>{selectedBreadcrumb.label}</Text>
                {selectedBreadcrumb.description && (
                  <Text style={styles.detailDescription}>
                    {selectedBreadcrumb.description}
                  </Text>
                )}
                <Text style={styles.detailTime}>
                  {new Date(selectedBreadcrumb.timestamp).toLocaleString()}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  compactContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  compactSummary: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  expandButton: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  lastContext: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastContextLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginRight: 6,
  },
  lastContextText: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  viewAll: {
    fontSize: 13,
    color: COLORS.primary,
  },
  summary: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  list: {
    maxHeight: 200,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
  },
  breadcrumbItemCompact: {
    paddingVertical: 6,
  },
  breadcrumbItemFirst: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary,
  },
  connector: {
    position: 'absolute',
    left: 20,
    top: -8,
    width: 2,
    height: 16,
    backgroundColor: COLORS.textMuted + '40',
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  time: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  tapIndicator: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: 8,
  },
  snapshotsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  snapshotsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  snapshotItem: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  snapshotLabel: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 2,
  },
  snapshotMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalClose: {
    fontSize: 20,
    color: COLORS.textSecondary,
    padding: 4,
  },
  modalList: {
    padding: 16,
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  detailIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  detailTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});

export default BreadcrumbTrail;