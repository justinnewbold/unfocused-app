/**
 * OfflineQueueService - Offline-first architecture
 *
 * Features:
 * - Queue actions when offline
 * - Auto-sync when back online
 * - Conflict resolution
 * - Optimistic updates
 * - Sync status tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

const STORAGE_KEY = 'nero_offline_queue';

export type QueuedActionType =
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'complete_task'
  | 'create_focus_session'
  | 'log_mood'
  | 'log_energy'
  | 'update_settings';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
  conflictResolution?: 'client_wins' | 'server_wins' | 'merge';
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncTime?: string;
  pendingCount: number;
  failedCount: number;
  syncInProgress: boolean;
  lastError?: string;
}

export interface OfflineSettings {
  enabled: boolean;
  autoSyncOnReconnect: boolean;
  maxQueueSize: number;
  maxRetries: number;
  retryDelayMs: number;
  conflictResolution: 'client_wins' | 'server_wins' | 'ask';
  syncIntervalMs: number;
}

const DEFAULT_SETTINGS: OfflineSettings = {
  enabled: true,
  autoSyncOnReconnect: true,
  maxQueueSize: 1000,
  maxRetries: 3,
  retryDelayMs: 5000,
  conflictResolution: 'client_wins',
  syncIntervalMs: 30000,
};

export class OfflineQueueService {
  private settings: OfflineSettings = DEFAULT_SETTINGS;
  private queue: QueuedAction[] = [];
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private lastSyncTime?: string;
  private lastError?: string;
  private syncInterval: NodeJS.Timeout | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;

  // Callbacks
  private onStatusChange?: (status: SyncStatus) => void;
  private onConflict?: (action: QueuedAction, serverData: any) => Promise<'client' | 'server' | 'merge'>;
  private syncHandler?: (action: QueuedAction) => Promise<any>;

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        this.queue = parsed.queue || [];
        this.lastSyncTime = parsed.lastSyncTime;
      }

      // Set up network monitoring
      this.setupNetworkListener();

      // Check initial network state
      const state = await NetInfo.fetch();
      this.handleConnectivityChange(state);

      // Start sync interval
      this.startSyncInterval();
    } catch (error) {
      console.error('Failed to initialize OfflineQueueService:', error);
    }
  }

  // ============ NETWORK MONITORING ============

  private setupNetworkListener(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      this.handleConnectivityChange(state);
    });
  }

  private async handleConnectivityChange(state: NetInfoState): Promise<void> {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected ?? false;

    this.notifyStatusChange();

    // Auto-sync when coming back online
    if (wasOffline && this.isOnline && this.settings.autoSyncOnReconnect) {
      await this.processQueue();
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // ============ QUEUE MANAGEMENT ============

  async enqueue(
    type: QueuedActionType,
    payload: any,
    options?: {
      conflictResolution?: QueuedAction['conflictResolution'];
      immediate?: boolean;
    }
  ): Promise<QueuedAction> {
    const action: QueuedAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: this.settings.maxRetries,
      status: 'pending',
      conflictResolution: options?.conflictResolution,
    };

    // Check queue size
    if (this.queue.length >= this.settings.maxQueueSize) {
      // Remove oldest failed or synced actions
      this.queue = this.queue.filter(a => a.status === 'pending' || a.status === 'syncing');
    }

    this.queue.push(action);
    await this.saveQueue();

    this.notifyStatusChange();

    // Try immediate sync if online and requested
    if (options?.immediate && this.isOnline) {
      await this.processQueue();
    }

    return action;
  }

  async removeFromQueue(actionId: string): Promise<boolean> {
    const index = this.queue.findIndex(a => a.id === actionId);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    await this.saveQueue();
    this.notifyStatusChange();

    return true;
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.notifyStatusChange();
  }

  async clearFailedActions(): Promise<number> {
    const failedCount = this.queue.filter(a => a.status === 'failed').length;
    this.queue = this.queue.filter(a => a.status !== 'failed');
    await this.saveQueue();
    this.notifyStatusChange();
    return failedCount;
  }

  getQueue(): QueuedAction[] {
    return [...this.queue];
  }

  getPendingActions(): QueuedAction[] {
    return this.queue.filter(a => a.status === 'pending' || a.status === 'failed');
  }

  getFailedActions(): QueuedAction[] {
    return this.queue.filter(a => a.status === 'failed');
  }

  // ============ SYNC PROCESSING ============

  async processQueue(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    if (!this.isOnline || this.syncInProgress || !this.syncHandler) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.syncInProgress = true;
    this.notifyStatusChange();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const pendingActions = this.queue.filter(
      a => a.status === 'pending' || (a.status === 'failed' && a.retryCount < a.maxRetries)
    );

    for (const action of pendingActions) {
      try {
        action.status = 'syncing';
        this.notifyStatusChange();

        await this.syncHandler(action);

        action.status = 'synced';
        succeeded++;
      } catch (error: any) {
        action.status = 'failed';
        action.retryCount++;
        action.error = error.message || 'Sync failed';
        failed++;
        this.lastError = action.error;
      }

      processed++;
    }

    // Remove successfully synced actions
    this.queue = this.queue.filter(a => a.status !== 'synced');

    this.lastSyncTime = new Date().toISOString();
    this.syncInProgress = false;

    await this.saveQueue();
    this.notifyStatusChange();

    return { processed, succeeded, failed };
  }

  private startSyncInterval(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && this.getPendingActions().length > 0) {
        await this.processQueue();
      }
    }, this.settings.syncIntervalMs);
  }

  async forceSync(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    return this.processQueue();
  }

  // ============ CONFLICT RESOLUTION ============

  async resolveConflict(
    action: QueuedAction,
    serverData: any
  ): Promise<'client' | 'server' | 'merge'> {
    // Check action-specific resolution
    if (action.conflictResolution) {
      if (action.conflictResolution === 'client_wins') return 'client';
      if (action.conflictResolution === 'server_wins') return 'server';
      if (action.conflictResolution === 'merge') return 'merge';
    }

    // Check global setting
    if (this.settings.conflictResolution === 'client_wins') return 'client';
    if (this.settings.conflictResolution === 'server_wins') return 'server';

    // Ask callback if available
    if (this.onConflict) {
      return this.onConflict(action, serverData);
    }

    // Default to client wins
    return 'client';
  }

  // ============ STATUS ============

  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSyncTime: this.lastSyncTime,
      pendingCount: this.queue.filter(a => a.status === 'pending').length,
      failedCount: this.queue.filter(a => a.status === 'failed').length,
      syncInProgress: this.syncInProgress,
      lastError: this.lastError,
    };
  }

  private notifyStatusChange(): void {
    this.onStatusChange?.(this.getStatus());
  }

  // ============ OPTIMISTIC UPDATES ============

  /**
   * Apply an action optimistically (immediately) and queue for sync
   */
  async applyOptimistically<T>(
    type: QueuedActionType,
    payload: any,
    localApply: () => T
  ): Promise<{ result: T; action: QueuedAction }> {
    // Apply locally first
    const result = localApply();

    // Queue for server sync
    const action = await this.enqueue(type, payload, { immediate: true });

    return { result, action };
  }

  /**
   * Rollback an optimistic update if sync fails
   */
  async rollbackOptimistic(
    actionId: string,
    rollback: () => void
  ): Promise<void> {
    const action = this.queue.find(a => a.id === actionId);
    if (action && action.status === 'failed') {
      rollback();
      await this.removeFromQueue(actionId);
    }
  }

  // ============ CALLBACKS ============

  setSyncHandler(handler: (action: QueuedAction) => Promise<any>): void {
    this.syncHandler = handler;
  }

  setOnStatusChange(callback: (status: SyncStatus) => void): void {
    this.onStatusChange = callback;
  }

  setOnConflict(
    callback: (action: QueuedAction, serverData: any) => Promise<'client' | 'server' | 'merge'>
  ): void {
    this.onConflict = callback;
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<OfflineSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveQueue();

    // Restart sync interval if changed
    if (updates.syncIntervalMs) {
      this.startSyncInterval();
    }
  }

  getSettings(): OfflineSettings {
    return { ...this.settings };
  }

  // ============ STORAGE ============

  private async saveQueue(): Promise<void> {
    try {
      const data = {
        settings: this.settings,
        queue: this.queue,
        lastSyncTime: this.lastSyncTime,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  // ============ CLEANUP ============

  cleanup(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

// Singleton instance
let serviceInstance: OfflineQueueService | null = null;

export function getOfflineQueueService(): OfflineQueueService {
  if (!serviceInstance) {
    serviceInstance = new OfflineQueueService();
  }
  return serviceInstance;
}

export async function initializeOfflineQueueService(): Promise<OfflineQueueService> {
  const service = getOfflineQueueService();
  await service.initialize();
  return service;
}
