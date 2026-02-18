/**
 * AccountabilityService - Accountability partner connections
 *
 * Features:
 * - Connect with accountability partners
 * - Share progress summaries
 * - Send/receive encouragement
 * - Privacy controls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AccountabilityPartner,
  AccountabilitySettings,
  AccountabilityUpdate,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_accountability_settings',
  UPDATES: 'nero_accountability_updates',
  PENDING: 'nero_accountability_pending',
};

const DEFAULT_SETTINGS: AccountabilitySettings = {
  enabled: false,
  partners: [],
  shareCompletions: true,
  shareStruggleMoments: false,
  allowNudges: true,
  dailySummary: true,
  weeklySummary: true,
};

export class AccountabilityService {
  private settings: AccountabilitySettings = DEFAULT_SETTINGS;
  private updates: AccountabilityUpdate[] = [];
  private pendingUpdates: AccountabilityUpdate[] = [];

  async initialize(): Promise<void> {
    try {
      const [settingsJson, updatesJson, pendingJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.UPDATES),
        AsyncStorage.getItem(STORAGE_KEYS.PENDING),
      ]);

      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }
      if (updatesJson) {
        this.updates = JSON.parse(updatesJson);
      }
      if (pendingJson) {
        this.pendingUpdates = JSON.parse(pendingJson);
      }
    } catch (error) {
      console.error('Failed to initialize AccountabilityService:', error);
    }
  }

  // ============ PARTNER MANAGEMENT ============

  getPartners(): AccountabilityPartner[] {
    return [...this.settings.partners];
  }

  async addPartner(
    displayName: string,
    relationship: AccountabilityPartner['relationship'],
    options?: {
      email?: string;
      shareLevel?: AccountabilityPartner['shareLevel'];
    }
  ): Promise<AccountabilityPartner> {
    const partner: AccountabilityPartner = {
      id: `partner_${Date.now()}`,
      userId: `pending_${Date.now()}`, // Would be set when partner accepts
      displayName,
      email: options?.email,
      relationship,
      shareLevel: options?.shareLevel || 'summary',
      connectedAt: new Date().toISOString(),
    };

    this.settings.partners.push(partner);
    await this.saveSettings();

    return partner;
  }

  async updatePartner(
    partnerId: string,
    updates: Partial<AccountabilityPartner>
  ): Promise<AccountabilityPartner | null> {
    const partner = this.settings.partners.find(p => p.id === partnerId);
    if (!partner) return null;

    Object.assign(partner, updates);
    await this.saveSettings();
    return partner;
  }

  async removePartner(partnerId: string): Promise<boolean> {
    const initialLength = this.settings.partners.length;
    this.settings.partners = this.settings.partners.filter(p => p.id !== partnerId);

    if (this.settings.partners.length !== initialLength) {
      await this.saveSettings();
      return true;
    }
    return false;
  }

  // ============ UPDATES ============

  async sendUpdate(
    toPartnerId: string,
    type: AccountabilityUpdate['type'],
    message: string,
    taskTitle?: string
  ): Promise<AccountabilityUpdate | null> {
    const partner = this.settings.partners.find(p => p.id === toPartnerId);
    if (!partner) return null;

    // Check privacy settings
    if (type === 'completion' && !this.settings.shareCompletions) return null;
    if (type === 'struggle' && !this.settings.shareStruggleMoments) return null;

    const update: AccountabilityUpdate = {
      id: `update_${Date.now()}`,
      fromUserId: 'me', // Would be actual user ID
      toUserId: partner.userId,
      type,
      message,
      taskTitle,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // In a real app, this would send to a server
    // For now, store locally as pending
    this.pendingUpdates.push(update);
    await this.savePending();

    return update;
  }

  async sendCompletionUpdate(
    taskTitle: string,
    toPartnerIds?: string[]
  ): Promise<void> {
    if (!this.settings.shareCompletions) return;

    const partners = toPartnerIds
      ? this.settings.partners.filter(p => toPartnerIds.includes(p.id))
      : this.settings.partners;

    const messages = [
      `Completed: ${taskTitle} 🎉`,
      `Just finished: ${taskTitle} ✅`,
      `Done with: ${taskTitle} 💪`,
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];

    for (const partner of partners) {
      await this.sendUpdate(partner.id, 'completion', message, taskTitle);
    }
  }

  async sendStruggleUpdate(message: string): Promise<void> {
    if (!this.settings.shareStruggleMoments) return;

    for (const partner of this.settings.partners) {
      if (partner.shareLevel === 'full' || partner.shareLevel === 'detailed') {
        await this.sendUpdate(partner.id, 'struggle', message);
      }
    }
  }

  async sendNudge(toPartnerId: string, message?: string): Promise<AccountabilityUpdate | null> {
    const defaultMessages = [
      'Hey! Just checking in 💙',
      'You got this! 💪',
      'Thinking of you! 🌟',
      'Small steps count! ✨',
    ];

    const nudgeMessage = message || defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
    return this.sendUpdate(toPartnerId, 'nudge', nudgeMessage);
  }

  async sendEncouragement(toPartnerId: string, message: string): Promise<AccountabilityUpdate | null> {
    return this.sendUpdate(toPartnerId, 'encouragement', message);
  }

  // ============ RECEIVED UPDATES ============

  getUpdates(unreadOnly: boolean = false): AccountabilityUpdate[] {
    if (unreadOnly) {
      return this.updates.filter(u => !u.read);
    }
    return [...this.updates];
  }

  getUpdatesFromPartner(partnerId: string): AccountabilityUpdate[] {
    const partner = this.settings.partners.find(p => p.id === partnerId);
    if (!partner) return [];

    return this.updates.filter(u => u.fromUserId === partner.userId);
  }

  async markUpdateRead(updateId: string): Promise<void> {
    const update = this.updates.find(u => u.id === updateId);
    if (update) {
      update.read = true;
      await this.saveUpdates();
    }
  }

  async markAllRead(): Promise<void> {
    for (const update of this.updates) {
      update.read = true;
    }
    await this.saveUpdates();
  }

  getUnreadCount(): number {
    return this.updates.filter(u => !u.read).length;
  }

  // ============ SUMMARIES ============

  async generateDailySummary(
    tasksCompleted: number,
    focusMinutes: number,
    topAccomplishment?: string
  ): Promise<string> {
    let summary = `📊 Daily Summary:\n`;
    summary += `✅ ${tasksCompleted} task${tasksCompleted !== 1 ? 's' : ''} completed\n`;
    summary += `⏱️ ${focusMinutes} minutes of focus time\n`;

    if (topAccomplishment) {
      summary += `🌟 Highlight: ${topAccomplishment}`;
    }

    return summary;
  }

  async generateWeeklySummary(
    tasksCompleted: number,
    focusMinutes: number,
    bestDay: string,
    improvementFromLastWeek: number
  ): Promise<string> {
    let summary = `📈 Weekly Summary:\n`;
    summary += `✅ ${tasksCompleted} tasks completed\n`;
    summary += `⏱️ ${Math.round(focusMinutes / 60)} hours of focus time\n`;
    summary += `🌟 Best day: ${bestDay}\n`;

    if (improvementFromLastWeek > 0) {
      summary += `📊 ${improvementFromLastWeek}% improvement from last week! 🎉`;
    } else if (improvementFromLastWeek < 0) {
      summary += `💙 ${Math.abs(improvementFromLastWeek)}% less than last week - that's okay!`;
    } else {
      summary += `📊 Consistent with last week - steady progress!`;
    }

    return summary;
  }

  async sendDailySummaryToPartners(
    tasksCompleted: number,
    focusMinutes: number,
    topAccomplishment?: string
  ): Promise<void> {
    if (!this.settings.dailySummary) return;

    const summary = await this.generateDailySummary(
      tasksCompleted,
      focusMinutes,
      topAccomplishment
    );

    for (const partner of this.settings.partners) {
      if (partner.shareLevel === 'none') continue;
      await this.sendUpdate(partner.id, 'milestone', summary);
    }
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<AccountabilitySettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): AccountabilitySettings {
    return { ...this.settings };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.saveSettings();
  }

  // ============ INVITATION SYSTEM ============

  generateInviteCode(): string {
    // Generate a simple invite code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async sendInvite(email: string, relationship: AccountabilityPartner['relationship']): Promise<{
    inviteCode: string;
    partner: AccountabilityPartner;
  }> {
    const inviteCode = this.generateInviteCode();

    const partner = await this.addPartner(
      email.split('@')[0], // Use email prefix as temp name
      relationship,
      { email }
    );

    // In a real app, this would send an email/notification
    console.log(`Invite sent to ${email} with code: ${inviteCode}`);

    return { inviteCode, partner };
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save accountability settings:', error);
    }
  }

  private async saveUpdates(): Promise<void> {
    try {
      // Keep last 200 updates
      const toSave = this.updates.slice(-200);
      await AsyncStorage.setItem(STORAGE_KEYS.UPDATES, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save updates:', error);
    }
  }

  private async savePending(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING, JSON.stringify(this.pendingUpdates));
    } catch (error) {
      console.error('Failed to save pending updates:', error);
    }
  }

  // ============ STATISTICS ============

  getStatistics(): {
    totalPartners: number;
    updatesSent: number;
    updatesReceived: number;
    nudgesSent: number;
    encouragementReceived: number;
  } {
    const sent = this.pendingUpdates.filter(u => u.fromUserId === 'me');
    const received = this.updates.filter(u => u.fromUserId !== 'me');

    return {
      totalPartners: this.settings.partners.length,
      updatesSent: sent.length,
      updatesReceived: received.length,
      nudgesSent: sent.filter(u => u.type === 'nudge').length,
      encouragementReceived: received.filter(u => u.type === 'encouragement').length,
    };
  }
}

// Singleton instance
let serviceInstance: AccountabilityService | null = null;

export function getAccountabilityService(): AccountabilityService {
  if (!serviceInstance) {
    serviceInstance = new AccountabilityService();
  }
  return serviceInstance;
}

export async function initializeAccountabilityService(): Promise<AccountabilityService> {
  const service = getAccountabilityService();
  await service.initialize();
  return service;
}
