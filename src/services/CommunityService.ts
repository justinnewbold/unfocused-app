/**
 * CommunityService - Anonymous community for sharing wins and struggles
 *
 * Features:
 * - Anonymous posting
 * - Share wins and struggles
 * - React to others' posts
 * - Get/give tips
 * - Community support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CommunityPost,
  CommunityReaction,
  CommunityReply,
  CommunitySettings,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_community_settings',
  MY_POSTS: 'nero_community_my_posts',
  FEED_CACHE: 'nero_community_feed_cache',
};

const DEFAULT_SETTINGS: CommunitySettings = {
  enabled: false,
  showWins: true,
  showStruggles: true,
  autoShareMilestones: false,
  anonymousName: undefined,
};

// Generate fun anonymous names
const ADJECTIVES = [
  'Focused', 'Brave', 'Creative', 'Curious', 'Determined', 'Energetic',
  'Friendly', 'Hopeful', 'Inspired', 'Joyful', 'Kind', 'Lively',
  'Mindful', 'Noble', 'Optimistic', 'Patient', 'Quiet', 'Radiant',
  'Steady', 'Thoughtful', 'Unique', 'Vibrant', 'Wise', 'Zealous',
];

const ANIMALS = [
  'Panda', 'Fox', 'Owl', 'Bear', 'Wolf', 'Rabbit', 'Dolphin', 'Eagle',
  'Lion', 'Tiger', 'Penguin', 'Koala', 'Otter', 'Hedgehog', 'Sloth',
  'Deer', 'Squirrel', 'Badger', 'Beaver', 'Falcon', 'Hummingbird',
];

export class CommunityService {
  private settings: CommunitySettings = DEFAULT_SETTINGS;
  private myPosts: CommunityPost[] = [];
  private feedCache: CommunityPost[] = [];
  private anonymousId: string = '';

  async initialize(): Promise<void> {
    try {
      const [settingsJson, postsJson, feedJson] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
        AsyncStorage.getItem(STORAGE_KEYS.MY_POSTS),
        AsyncStorage.getItem(STORAGE_KEYS.FEED_CACHE),
      ]);

      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }
      if (postsJson) {
        this.myPosts = JSON.parse(postsJson);
      }
      if (feedJson) {
        this.feedCache = JSON.parse(feedJson);
      }

      // Generate or restore anonymous ID
      this.anonymousId = await this.getOrCreateAnonymousId();

      // Generate anonymous name if not set
      if (!this.settings.anonymousName) {
        this.settings.anonymousName = this.generateAnonymousName();
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to initialize CommunityService:', error);
    }
  }

  // ============ ANONYMOUS IDENTITY ============

  private async getOrCreateAnonymousId(): Promise<string> {
    const key = 'nero_anonymous_id';
    let id = await AsyncStorage.getItem(key);

    if (!id) {
      id = `anon_${Math.random().toString(36).substr(2, 12)}`;
      await AsyncStorage.setItem(key, id);
    }

    return id;
  }

  private generateAnonymousName(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${adjective}${animal}`;
  }

  getAnonymousName(): string {
    return this.settings.anonymousName || 'Anonymous';
  }

  async regenerateAnonymousName(): Promise<string> {
    this.settings.anonymousName = this.generateAnonymousName();
    await this.saveSettings();
    return this.settings.anonymousName;
  }

  // ============ POSTING ============

  async createPost(
    type: CommunityPost['type'],
    content: string,
    taskCategory?: string
  ): Promise<CommunityPost> {
    const post: CommunityPost = {
      id: `post_${Date.now()}`,
      anonymousId: this.anonymousId,
      type,
      content,
      taskCategory,
      timestamp: new Date().toISOString(),
      reactions: [
        { type: 'celebrate', count: 0, hasUserReacted: false },
        { type: 'relate', count: 0, hasUserReacted: false },
        { type: 'support', count: 0, hasUserReacted: false },
        { type: 'helpful', count: 0, hasUserReacted: false },
      ],
      replies: [],
    };

    this.myPosts.push(post);
    await this.saveMyPosts();

    // In a real app, this would send to a server
    return post;
  }

  async shareWin(content: string, taskCategory?: string): Promise<CommunityPost> {
    return this.createPost('win', content, taskCategory);
  }

  async shareStruggle(content: string): Promise<CommunityPost> {
    return this.createPost('struggle', content);
  }

  async shareTip(content: string, taskCategory?: string): Promise<CommunityPost> {
    return this.createPost('tip', content, taskCategory);
  }

  async askQuestion(content: string): Promise<CommunityPost> {
    return this.createPost('question', content);
  }

  getMyPosts(): CommunityPost[] {
    return [...this.myPosts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async deletePost(postId: string): Promise<boolean> {
    const initialLength = this.myPosts.length;
    this.myPosts = this.myPosts.filter(p => p.id !== postId);

    if (this.myPosts.length !== initialLength) {
      await this.saveMyPosts();
      return true;
    }
    return false;
  }

  // ============ FEED ============

  async getFeed(options?: {
    type?: CommunityPost['type'];
    limit?: number;
  }): Promise<CommunityPost[]> {
    // In a real app, this would fetch from a server
    // For now, return cached/mock data

    let feed = [...this.feedCache];

    if (options?.type) {
      feed = feed.filter(p => p.type === options.type);
    }

    // Sort by timestamp
    feed.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (options?.limit) {
      feed = feed.slice(0, options.limit);
    }

    return feed;
  }

  async getWinsFeed(limit?: number): Promise<CommunityPost[]> {
    return this.getFeed({ type: 'win', limit });
  }

  async getStrugglesFeed(limit?: number): Promise<CommunityPost[]> {
    return this.getFeed({ type: 'struggle', limit });
  }

  async getTipsFeed(limit?: number): Promise<CommunityPost[]> {
    return this.getFeed({ type: 'tip', limit });
  }

  async refreshFeed(): Promise<CommunityPost[]> {
    // In a real app, this would fetch fresh data from server
    // For demo, generate some sample posts
    this.feedCache = this.generateSamplePosts();
    await this.saveFeedCache();
    return this.feedCache;
  }

  private generateSamplePosts(): CommunityPost[] {
    const sampleWins = [
      'Finally finished that report I\'ve been putting off for weeks! 🎉',
      'Did a 25-minute focus session without checking my phone once!',
      'Managed to get out of bed before noon today 💪',
      'Used the 2-minute rule and it actually worked!',
      'Completed 5 tasks today - personal record!',
    ];

    const sampleStruggles = [
      'Having one of those days where everything feels impossible...',
      'Started 10 different tasks, finished none. Classic.',
      'Time blindness hit hard today - lost 3 hours somehow',
      'Executive dysfunction is rough today',
      'Can\'t seem to start anything, even fun stuff',
    ];

    const sampleTips = [
      'Try the "body double" trick - works wonders for me!',
      'Setting a timer for just 5 minutes helps me start',
      'I put my phone in another room during focus time',
      'Breaking tasks into embarrassingly small steps really helps',
      'Reward yourself with something small after each task',
    ];

    const posts: CommunityPost[] = [];

    // Generate sample posts
    [...sampleWins, ...sampleStruggles, ...sampleTips].forEach((content, i) => {
      const type: CommunityPost['type'] = i < 5 ? 'win' : i < 10 ? 'struggle' : 'tip';
      posts.push({
        id: `sample_${i}`,
        anonymousId: `sample_user_${i % 5}`,
        type,
        content,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(), // Spread over hours
        reactions: [
          { type: 'celebrate', count: Math.floor(Math.random() * 20), hasUserReacted: false },
          { type: 'relate', count: Math.floor(Math.random() * 30), hasUserReacted: false },
          { type: 'support', count: Math.floor(Math.random() * 15), hasUserReacted: false },
          { type: 'helpful', count: Math.floor(Math.random() * 10), hasUserReacted: false },
        ],
        replies: [],
      });
    });

    return posts;
  }

  // ============ REACTIONS ============

  async addReaction(
    postId: string,
    reactionType: CommunityReaction['type']
  ): Promise<boolean> {
    const post = this.feedCache.find(p => p.id === postId)
      || this.myPosts.find(p => p.id === postId);

    if (!post) return false;

    const reaction = post.reactions.find(r => r.type === reactionType);
    if (!reaction) return false;

    if (!reaction.hasUserReacted) {
      reaction.count++;
      reaction.hasUserReacted = true;

      await this.saveFeedCache();
      await this.saveMyPosts();
      return true;
    }

    return false;
  }

  async removeReaction(
    postId: string,
    reactionType: CommunityReaction['type']
  ): Promise<boolean> {
    const post = this.feedCache.find(p => p.id === postId)
      || this.myPosts.find(p => p.id === postId);

    if (!post) return false;

    const reaction = post.reactions.find(r => r.type === reactionType);
    if (!reaction) return false;

    if (reaction.hasUserReacted) {
      reaction.count = Math.max(0, reaction.count - 1);
      reaction.hasUserReacted = false;

      await this.saveFeedCache();
      await this.saveMyPosts();
      return true;
    }

    return false;
  }

  // ============ REPLIES ============

  async addReply(postId: string, content: string): Promise<CommunityReply | null> {
    const post = this.feedCache.find(p => p.id === postId);
    if (!post) return null;

    const reply: CommunityReply = {
      id: `reply_${Date.now()}`,
      anonymousId: this.anonymousId,
      content,
      timestamp: new Date().toISOString(),
      isHelpful: false,
    };

    post.replies.push(reply);
    await this.saveFeedCache();

    return reply;
  }

  async markReplyHelpful(postId: string, replyId: string): Promise<boolean> {
    const post = this.feedCache.find(p => p.id === postId);
    if (!post) return false;

    const reply = post.replies.find(r => r.id === replyId);
    if (!reply) return false;

    reply.isHelpful = true;
    await this.saveFeedCache();

    return true;
  }

  // ============ AUTO-SHARE ============

  async autoShareMilestone(milestone: string): Promise<CommunityPost | null> {
    if (!this.settings.autoShareMilestones) return null;

    return this.shareWin(`🏆 Milestone: ${milestone}`);
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<CommunitySettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): CommunitySettings {
    return { ...this.settings };
  }

  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.saveSettings();
  }

  // ============ STATISTICS ============

  getStatistics(): {
    totalPosts: number;
    totalReactionsReceived: number;
    totalRepliesReceived: number;
    postsByType: Record<CommunityPost['type'], number>;
  } {
    const postsByType: Record<CommunityPost['type'], number> = {
      win: 0,
      struggle: 0,
      tip: 0,
      question: 0,
    };

    let totalReactionsReceived = 0;
    let totalRepliesReceived = 0;

    for (const post of this.myPosts) {
      postsByType[post.type]++;
      totalReactionsReceived += post.reactions.reduce((sum, r) => sum + r.count, 0);
      totalRepliesReceived += post.replies.length;
    }

    return {
      totalPosts: this.myPosts.length,
      totalReactionsReceived,
      totalRepliesReceived,
      postsByType,
    };
  }

  // ============ STORAGE ============

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save community settings:', error);
    }
  }

  private async saveMyPosts(): Promise<void> {
    try {
      // Keep last 100 posts
      const toSave = this.myPosts.slice(-100);
      await AsyncStorage.setItem(STORAGE_KEYS.MY_POSTS, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save my posts:', error);
    }
  }

  private async saveFeedCache(): Promise<void> {
    try {
      // Keep last 100 posts in cache
      const toSave = this.feedCache.slice(-100);
      await AsyncStorage.setItem(STORAGE_KEYS.FEED_CACHE, JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save feed cache:', error);
    }
  }
}

// Singleton instance
let serviceInstance: CommunityService | null = null;

export function getCommunityService(): CommunityService {
  if (!serviceInstance) {
    serviceInstance = new CommunityService();
  }
  return serviceInstance;
}

export async function initializeCommunityService(): Promise<CommunityService> {
  const service = getCommunityService();
  await service.initialize();
  return service;
}
