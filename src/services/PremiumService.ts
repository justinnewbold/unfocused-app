/**
 * PremiumService - Premium features and subscription management
 *
 * Features:
 * - Feature gating
 * - Subscription management
 * - Trial periods
 * - Premium tier definitions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'nero_premium';

export type PremiumTier = 'free' | 'plus' | 'pro';

export type PremiumFeature =
  // Free features
  | 'basic_tasks'
  | 'focus_timer'
  | 'mood_tracking'
  | 'energy_tracking'
  | 'nero_basic'
  // Plus features
  | 'recurring_tasks'
  | 'calendar_sync'
  | 'cloud_sync'
  | 'data_export'
  | 'custom_themes'
  | 'nero_personalities'
  | 'voice_input'
  | 'widgets'
  // Pro features
  | 'medication_tracking'
  | 'sleep_tracking'
  | 'weather_correlation'
  | 'team_sharing'
  | 'accountability_partners'
  | 'community_access'
  | 'api_access'
  | 'advanced_analytics'
  | 'priority_support';

export interface PremiumPlan {
  tier: PremiumTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PremiumFeature[];
  highlighted?: boolean;
}

export interface Subscription {
  tier: PremiumTier;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  billingCycle: 'monthly' | 'yearly';
  trialEndsAt?: string;
  cancelledAt?: string;
  source: 'app_store' | 'play_store' | 'stripe' | 'manual';
  receiptId?: string;
}

export interface PremiumSettings {
  hasSeenPremiumPrompt: boolean;
  lastPromptDate?: string;
  promptsShown: number;
  referralCode?: string;
  referralsCount: number;
}

// Feature definitions by tier
const TIER_FEATURES: Record<PremiumTier, PremiumFeature[]> = {
  free: [
    'basic_tasks',
    'focus_timer',
    'mood_tracking',
    'energy_tracking',
    'nero_basic',
  ],
  plus: [
    // Includes all free features
    'basic_tasks',
    'focus_timer',
    'mood_tracking',
    'energy_tracking',
    'nero_basic',
    // Plus features
    'recurring_tasks',
    'calendar_sync',
    'cloud_sync',
    'data_export',
    'custom_themes',
    'nero_personalities',
    'voice_input',
    'widgets',
  ],
  pro: [
    // Includes all plus features
    'basic_tasks',
    'focus_timer',
    'mood_tracking',
    'energy_tracking',
    'nero_basic',
    'recurring_tasks',
    'calendar_sync',
    'cloud_sync',
    'data_export',
    'custom_themes',
    'nero_personalities',
    'voice_input',
    'widgets',
    // Pro features
    'medication_tracking',
    'sleep_tracking',
    'weather_correlation',
    'team_sharing',
    'accountability_partners',
    'community_access',
    'api_access',
    'advanced_analytics',
    'priority_support',
  ],
};

// Plan definitions
const PLANS: PremiumPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    description: 'Essential ADHD support tools',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: TIER_FEATURES.free,
  },
  {
    tier: 'plus',
    name: 'Plus',
    description: 'Enhanced productivity features',
    monthlyPrice: 4.99,
    yearlyPrice: 39.99,
    features: TIER_FEATURES.plus,
    highlighted: true,
  },
  {
    tier: 'pro',
    name: 'Pro',
    description: 'Complete ADHD management suite',
    monthlyPrice: 9.99,
    yearlyPrice: 79.99,
    features: TIER_FEATURES.pro,
  },
];

const DEFAULT_SETTINGS: PremiumSettings = {
  hasSeenPremiumPrompt: false,
  promptsShown: 0,
  referralsCount: 0,
};

export class PremiumService {
  private subscription: Subscription | null = null;
  private settings: PremiumSettings = DEFAULT_SETTINGS;

  // Callbacks
  private onSubscriptionChange?: (subscription: Subscription | null) => void;

  async initialize(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.subscription = parsed.subscription;
        this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
      }

      // Check subscription validity
      if (this.subscription) {
        this.validateSubscription();
      }
    } catch (error) {
      console.error('Failed to initialize PremiumService:', error);
    }
  }

  // ============ FEATURE ACCESS ============

  hasFeature(feature: PremiumFeature): boolean {
    const tier = this.getCurrentTier();
    return TIER_FEATURES[tier].includes(feature);
  }

  getCurrentTier(): PremiumTier {
    if (!this.subscription || !this.subscription.isActive) {
      return 'free';
    }
    return this.subscription.tier;
  }

  isPremium(): boolean {
    return this.getCurrentTier() !== 'free';
  }

  isPlus(): boolean {
    return this.getCurrentTier() === 'plus' || this.getCurrentTier() === 'pro';
  }

  isPro(): boolean {
    return this.getCurrentTier() === 'pro';
  }

  getAvailableFeatures(): PremiumFeature[] {
    return TIER_FEATURES[this.getCurrentTier()];
  }

  getLockedFeatures(): PremiumFeature[] {
    const available = this.getAvailableFeatures();
    const allFeatures = TIER_FEATURES.pro;
    return allFeatures.filter(f => !available.includes(f));
  }

  getFeatureTier(feature: PremiumFeature): PremiumTier {
    if (TIER_FEATURES.free.includes(feature)) return 'free';
    if (TIER_FEATURES.plus.includes(feature)) return 'plus';
    return 'pro';
  }

  // ============ PLANS ============

  getPlans(): PremiumPlan[] {
    return [...PLANS];
  }

  getPlan(tier: PremiumTier): PremiumPlan | null {
    return PLANS.find(p => p.tier === tier) || null;
  }

  getUpgradePath(): PremiumPlan | null {
    const current = this.getCurrentTier();
    if (current === 'free') return this.getPlan('plus');
    if (current === 'plus') return this.getPlan('pro');
    return null;
  }

  // ============ SUBSCRIPTION MANAGEMENT ============

  getSubscription(): Subscription | null {
    return this.subscription ? { ...this.subscription } : null;
  }

  async setSubscription(subscription: Subscription): Promise<void> {
    this.subscription = subscription;
    await this.saveData();
    this.onSubscriptionChange?.(subscription);
  }

  async clearSubscription(): Promise<void> {
    this.subscription = null;
    await this.saveData();
    this.onSubscriptionChange?.(null);
  }

  private validateSubscription(): void {
    if (!this.subscription) return;

    // Check if subscription has ended
    if (this.subscription.endDate) {
      const endDate = new Date(this.subscription.endDate);
      if (endDate < new Date()) {
        this.subscription.isActive = false;
      }
    }

    // Check if trial has ended
    if (this.subscription.trialEndsAt) {
      const trialEnd = new Date(this.subscription.trialEndsAt);
      if (trialEnd < new Date() && !this.subscription.endDate) {
        this.subscription.isActive = false;
      }
    }
  }

  isInTrial(): boolean {
    if (!this.subscription?.trialEndsAt) return false;
    return new Date(this.subscription.trialEndsAt) > new Date();
  }

  getTrialDaysRemaining(): number {
    if (!this.subscription?.trialEndsAt) return 0;
    const trialEnd = new Date(this.subscription.trialEndsAt);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  // ============ TRIAL ============

  async startTrial(tier: PremiumTier, days: number = 7): Promise<Subscription> {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);

    const subscription: Subscription = {
      tier,
      startDate: new Date().toISOString(),
      isActive: true,
      billingCycle: 'monthly',
      trialEndsAt: trialEnd.toISOString(),
      source: 'manual',
    };

    await this.setSubscription(subscription);
    return subscription;
  }

  // ============ PURCHASE FLOW (Stubs) ============

  async purchaseMonthly(tier: PremiumTier): Promise<{
    success: boolean;
    error?: string;
  }> {
    // This would integrate with App Store / Play Store
    // For now, just simulate success
    const subscription: Subscription = {
      tier,
      startDate: new Date().toISOString(),
      isActive: true,
      billingCycle: 'monthly',
      source: 'manual',
    };

    await this.setSubscription(subscription);
    return { success: true };
  }

  async purchaseYearly(tier: PremiumTier): Promise<{
    success: boolean;
    error?: string;
  }> {
    const subscription: Subscription = {
      tier,
      startDate: new Date().toISOString(),
      isActive: true,
      billingCycle: 'yearly',
      source: 'manual',
    };

    await this.setSubscription(subscription);
    return { success: true };
  }

  async cancelSubscription(): Promise<boolean> {
    if (!this.subscription) return false;

    this.subscription.cancelledAt = new Date().toISOString();
    // Subscription remains active until end date
    await this.saveData();
    return true;
  }

  async restorePurchases(): Promise<{
    success: boolean;
    restored: boolean;
    error?: string;
  }> {
    // This would check App Store / Play Store for existing purchases
    // Stub implementation
    return { success: true, restored: false };
  }

  // ============ REFERRALS ============

  generateReferralCode(): string {
    return `NERO${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  async applyReferralCode(code: string): Promise<boolean> {
    // Validate and apply referral code
    // Stub implementation
    this.settings.referralCode = code;
    await this.saveData();
    return true;
  }

  getReferralStats(): { code?: string; count: number; reward: string } {
    return {
      code: this.settings.referralCode,
      count: this.settings.referralsCount,
      reward: this.settings.referralsCount >= 3 ? '1 month free Plus' : 'Invite 3 friends for 1 month free',
    };
  }

  // ============ PROMPTS ============

  shouldShowPremiumPrompt(): boolean {
    // Don't show if already premium
    if (this.isPremium()) return false;

    // Don't show if seen recently
    if (this.settings.lastPromptDate) {
      const lastPrompt = new Date(this.settings.lastPromptDate);
      const daysSince = (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return false;
    }

    // Don't show more than 5 times total
    if (this.settings.promptsShown >= 5) return false;

    return true;
  }

  async recordPromptShown(): Promise<void> {
    this.settings.hasSeenPremiumPrompt = true;
    this.settings.lastPromptDate = new Date().toISOString();
    this.settings.promptsShown++;
    await this.saveData();
  }

  // ============ FEATURE DESCRIPTIONS ============

  getFeatureInfo(feature: PremiumFeature): {
    name: string;
    description: string;
    tier: PremiumTier;
  } {
    const featureInfo: Record<PremiumFeature, { name: string; description: string }> = {
      basic_tasks: { name: 'Basic Tasks', description: 'Create and manage tasks' },
      focus_timer: { name: 'Focus Timer', description: 'Pomodoro-style focus sessions' },
      mood_tracking: { name: 'Mood Tracking', description: 'Track your daily mood' },
      energy_tracking: { name: 'Energy Tracking', description: 'Log energy levels' },
      nero_basic: { name: 'Nero AI', description: 'Basic AI companion support' },
      recurring_tasks: { name: 'Recurring Tasks', description: 'Create repeating tasks' },
      calendar_sync: { name: 'Calendar Sync', description: 'Sync with Google & Apple Calendar' },
      cloud_sync: { name: 'Cloud Sync', description: 'Sync across devices' },
      data_export: { name: 'Data Export', description: 'Export your data' },
      custom_themes: { name: 'Custom Themes', description: 'Personalize your app appearance' },
      nero_personalities: { name: 'Nero Personalities', description: 'Choose Nero\'s personality' },
      voice_input: { name: 'Voice Input', description: 'Add tasks by voice' },
      widgets: { name: 'Home Widgets', description: 'Quick-access home screen widgets' },
      medication_tracking: { name: 'Medication Tracking', description: 'Track ADHD medications' },
      sleep_tracking: { name: 'Sleep Tracking', description: 'Monitor sleep patterns' },
      weather_correlation: { name: 'Weather Insights', description: 'Weather-productivity correlation' },
      team_sharing: { name: 'Team Sharing', description: 'Share tasks with family/teams' },
      accountability_partners: { name: 'Accountability', description: 'Partner accountability features' },
      community_access: { name: 'Community', description: 'Anonymous community support' },
      api_access: { name: 'API Access', description: 'Integrate with other apps' },
      advanced_analytics: { name: 'Advanced Analytics', description: 'Deep productivity insights' },
      priority_support: { name: 'Priority Support', description: 'Fast customer support' },
    };

    const info = featureInfo[feature];
    return {
      ...info,
      tier: this.getFeatureTier(feature),
    };
  }

  // ============ CALLBACKS ============

  setOnSubscriptionChange(callback: (subscription: Subscription | null) => void): void {
    this.onSubscriptionChange = callback;
  }

  // ============ STORAGE ============

  private async saveData(): Promise<void> {
    try {
      const data = {
        subscription: this.subscription,
        settings: this.settings,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save premium data:', error);
    }
  }
}

// Singleton instance
let serviceInstance: PremiumService | null = null;

export function getPremiumService(): PremiumService {
  if (!serviceInstance) {
    serviceInstance = new PremiumService();
  }
  return serviceInstance;
}

export async function initializePremiumService(): Promise<PremiumService> {
  const service = getPremiumService();
  await service.initialize();
  return service;
}
