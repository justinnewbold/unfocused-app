import { Achievement, FocusTimerSettings, NotificationStyle, Personality } from '../types';

// ============ COLORS ============
export const C = {
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  bg: '#0F0F1A',
  card: '#252542',
  surface: '#1A1A2E',
  text: '#FFFFFF',
  textSec: '#B8B8D1',
  textMuted: '#6C6C8A',
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF7675',
  border: '#3D3D5C',
  gold: '#F9CA24',
  teal: '#00CEC9',
  pink: '#FD79A8',
  blue: '#0984E3',
};

// Supabase Config (User will add their own keys in settings)
export const SUPABASE_URL = 'https://wektbfkzbxvtxsremnnk.supabase.co';

// ============ PERSONALITIES (Simplified to 4 - more ADHD-friendly options) ============
export const PERSONALITIES: Record<string, { name: string; emoji: string; desc: string; color: string; greetings: string[]; systemPrompt: string }> = {
  loyalFriend: {
    name: 'Friend', emoji: '🤗', desc: 'Warm, supportive, casual', color: C.primary,
    greetings: ["Hey there! 💙", "Hi friend!", "Hey! 👋", "Good to see you!"],
    systemPrompt: "You are Nero, a warm and supportive AI companion for someone with ADHD. Be friendly, use casual language, light humor. Always be encouraging. Never guilt or shame."
  },
  coach: {
    name: 'Coach', emoji: '🏆', desc: 'Motivating, gentle push', color: C.gold,
    greetings: ["Let's go! 💪", "Ready to crush it?", "Champion! Let's do this!"],
    systemPrompt: "You are Nero, a motivating coach for someone with ADHD. Be encouraging, push gently, celebrate wins enthusiastically. Help them see their potential."
  },
  playful: {
    name: 'Playful', emoji: '😄', desc: 'Jokes, light, fun', color: C.pink,
    greetings: ["Heyyy! 😄", "Look who showed up!", "The legend returns!"],
    systemPrompt: "You are Nero, a playful and funny AI companion for someone with ADHD. Use humor, puns, and keep things light while being helpful. Laughter helps with dopamine!"
  },
  calm: {
    name: 'Calm', emoji: '🧘', desc: 'Soft, gentle, zen', color: C.teal,
    greetings: ["Welcome 🌿", "Peace, friend.", "Breathe. You're here now."],
    systemPrompt: "You are Nero, a calm and zen AI companion for someone with ADHD. Be gentle, soft-spoken, never rush. Create a peaceful space. Anxiety is real."
  },
};

// ============ VIEWS (Simplified to 4 for less overwhelm) ============
export const VIEWS: Record<string, { name: string; emoji: string; desc: string }> = {
  conversation: { name: 'Chat', emoji: '💬', desc: 'Talk with Nero' },
  oneThing: { name: 'Focus', emoji: '🎯', desc: 'One task at a time' },
  list: { name: 'List', emoji: '📝', desc: 'All your tasks' },
  insights: { name: 'Insights', emoji: '📊', desc: 'Patterns & schedule' },
};

// ============ ACHIEVEMENTS ============
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_task', name: 'First Step', emoji: '👣', description: 'Complete your first task', points: 10 },
  { id: 'five_tasks', name: 'Getting Going', emoji: '🚀', description: 'Complete 5 tasks', points: 25 },
  { id: 'ten_tasks', name: 'On a Roll', emoji: '🔥', description: 'Complete 10 tasks', points: 50 },
  { id: 'twenty_five', name: 'Unstoppable', emoji: '⚡', description: 'Complete 25 tasks', points: 100 },
  { id: 'fifty_tasks', name: 'Task Master', emoji: '👑', description: 'Complete 50 tasks', points: 200 },
  { id: 'first_chat', name: 'Hello Nero', emoji: '👋', description: 'Start a conversation', points: 10 },
  { id: 'ten_chats', name: 'Best Friends', emoji: '💙', description: 'Send 10 messages', points: 25 },
  { id: 'low_energy_win', name: 'Low Energy Hero', emoji: '🌙', description: 'Complete task on low energy', points: 30 },
  { id: 'micro_win', name: 'Micro Win', emoji: '✨', description: 'Complete a micro-step', points: 10 },
  { id: 'breakdown_master', name: 'Task Breaker', emoji: '🔨', description: 'Break down 3 tasks', points: 25 },
  { id: 'context_keeper', name: 'Context Keeper', emoji: '📌', description: 'Save your context', points: 15 },
  { id: 'thought_dumper', name: 'Brain Dump', emoji: '💭', description: 'Capture 5 thoughts', points: 20 },
  { id: 'comeback_kid', name: 'Comeback Kid', emoji: '🦸', description: 'Return after a day away', points: 30 },
  { id: 'early_bird', name: 'Early Bird', emoji: '🌅', description: 'Complete task before 9am', points: 20 },
  { id: 'night_owl', name: 'Night Owl', emoji: '🦉', description: 'Complete task after 10pm', points: 20 },
  { id: 'calendar_pro', name: 'Calendar Pro', emoji: '📅', description: 'Connect your calendar', points: 25 },
  { id: 'sync_master', name: 'Sync Master', emoji: '☁️', description: 'Enable cloud sync', points: 25 },
  { id: 'week_warrior', name: 'Week Warrior', emoji: '🗓️', description: 'Use app for 7 days', points: 75 },
  { id: 'focus_master', name: 'Focus Master', emoji: '⏱️', description: 'Complete 5 focus sessions', points: 50 },
  { id: 'mood_tracker', name: 'Mood Tracker', emoji: '🎭', description: 'Track mood for 7 days', points: 30 },
  { id: 'pattern_finder', name: 'Pattern Finder', emoji: '🔍', description: 'Discover 3 productivity patterns', points: 40 },
];

// ============ MESSAGES ============
export const CELEBRATIONS = ['Nice work! 🎉', 'Crushed it! 💪', 'Amazing! ⭐', "That's a win! 🏆", 'Boom! 💥', 'Yes! 🙌', 'Nailed it! 🎯', 'Fantastic! ✨', 'You did it! 🌟', 'Incredible! 💫'];

export const SURPRISES = [
  { emoji: '🌟', msg: "You're amazing!" },
  { emoji: '💎', msg: 'Rare focus achieved!' },
  { emoji: '🦄', msg: 'Unicorn productivity!' },
  { emoji: '🎁', msg: 'Surprise bonus!' },
  { emoji: '⭐', msg: 'Star performer!' },
  { emoji: '🔮', msg: 'Magic focus!' },
  { emoji: '🏅', msg: 'Gold medal moment!' },
];

export const NOTIFICATION_MESSAGES: Record<NotificationStyle, string[]> = {
  gentle: [
    "Hey, just checking in 💙",
    "No pressure, but you've got this!",
    "Tiny step whenever you're ready",
    "Your future self will thank you",
  ],
  variable: [
    "⚡ Quick! Do one tiny thing!",
    "🎯 Focus mode: activated?",
    "💪 You're stronger than the task!",
    "🚀 3... 2... 1... GO!",
  ],
  persistent: [
    "Task waiting for you!",
    "Don't forget your goal!",
    "Time to make progress!",
    "You committed to this!",
  ],
};

export const MICRO_STARTS = [
  "Just open it and look",
  "Set a 2-minute timer",
  "Do the tiniest first step",
  "Just read the first line",
  "Move one thing",
  "Write one word",
  "Take one breath, then start",
];

// ============ STUCK/PARALYSIS MODE ============
export const STUCK_MODE_PROMPTS = {
  initial: [
    "I hear you. Being stuck is real and valid. Let's work through this gently. 💙",
    "Executive dysfunction is tough. I'm here with you. No pressure. 🌿",
    "It's okay. Your brain isn't broken - it just works differently. Let's try something tiny. ✨",
  ],
  bodyMovement: [
    "Can you stand up and touch a wall, then come back? Just that. 🚶",
    "Try wiggling your fingers for 5 seconds. Seriously, just that. ✋",
    "Take one deep breath. Just one. I'll wait. 🌬️",
    "Stretch your arms up for 3 seconds. That's it. 💪",
  ],
  microSteps: [
    "Can you just LOOK at the task? Not do it - just look at it. 👀",
    "What's the tiniest possible piece? Like, embarrassingly tiny? 🔬",
    "Forget the whole task. What's ONE word you could type? ⌨️",
    "Can you open the thing you need? Just open it, nothing else. 📂",
  ],
  randomTask: [
    "Want me to just pick something random for you? Remove the choice entirely? 🎲",
    "Sometimes any action beats no action. Should I pick one at random? 🎯",
    "Decision paralysis is real. I can choose for you if that helps. 🤝",
  ],
  validation: [
    "Some days the win is just being here. That counts. 💙",
    "You showed up. That's not nothing. 🌟",
    "Progress isn't always visible. You're still moving forward. 🐢",
    "It's okay to rest. You're not lazy - you're human. 🌙",
  ],
  exitPrompts: [
    "Ready to try something? Or need more time? Either is fine. 🌿",
    "No rush. When you're ready, I'm here. 💙",
    "Take all the time you need. I'm not going anywhere. 🤗",
  ],
};

// ============ PROACTIVE CHECK-IN MESSAGES ============
export const PROACTIVE_CHECKIN_MESSAGES = {
  energy_dip: [
    "I noticed you usually hit a bit of a slump around now. How's your energy? 🌙",
    "This time of day can be tricky. Want to try a low-energy task? 💙",
    "Energy feeling low? That's okay! Let's find something manageable. ✨",
  ],
  peak_time: [
    "This is usually your peak hour! Want to tackle something bigger? ⚡",
    "Your data shows you rock at this time! Ready for a challenge? 🚀",
    "Prime time! Let's make the most of your energy. 💪",
  ],
  long_inactivity: [
    "Hey, just checking in! Everything okay? 💙",
    "Been a while! No pressure, but I'm here when you're ready. 🤗",
    "Taking a break? That's valid! Let me know when you want to dive back in. 🌿",
  ],
  scheduled: [
    "Time for your check-in! How are you feeling? 📋",
    "Check-in time! What's on your mind? 💭",
    "Hey there! Ready to set your energy and plan your next move? 🎯",
  ],
  mood_based: [
    "I sense things might be feeling heavy. Want to talk or tackle something small? 💙",
    "Your mood pattern suggests now might be a good time for a win. One tiny task? ✨",
    "Checking in on how you're really doing. No task required - just here for you. 🤗",
  ],
  pattern_based: [
    "Based on your patterns, you often get things done around now. Ready? 📊",
    "Your data shows this is often a productive window for you! ⏰",
    "Historical you tends to crush it at this hour. Feeling it? 🎯",
  ],
};

// ============ FOCUS TIMER DEFAULTS ============
export const DEFAULT_FOCUS_TIMER_SETTINGS: FocusTimerSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  pomodorosUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartNextPomodoro: false,
  playSound: true,
};

// ============ MOOD MESSAGES ============
export const MOOD_PROMPTS = {
  low: [
    "It's okay to have low days. Let's find something gentle.",
    "Low mood is valid. What's one tiny thing that might help?",
    "Being here counts. Want to try a micro-task?",
  ],
  neutral: [
    "Steady is good! What feels doable right now?",
    "You're here and that's what matters. What's next?",
    "Neutral energy - perfect for a medium task!",
  ],
  high: [
    "Feeling good! Let's channel this energy!",
    "Great mood detected! Ready to tackle something big?",
    "You're on fire! What's the most impactful thing you could do?",
  ],
};

// ============ HELPER FUNCTIONS ============
export const genId = () => Math.random().toString(36).substr(2, 9) + Date.now();
export const getEC = (e: 'low' | 'medium' | 'high') => e === 'high' ? C.success : e === 'medium' ? C.warning : C.error;
export const getEE = (e: 'low' | 'medium' | 'high') => e === 'high' ? '⚡' : e === 'medium' ? '✨' : '🌙';
export const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const formatDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
export const getMoodEmoji = (mood: 'low' | 'neutral' | 'high') => mood === 'high' ? '😊' : mood === 'neutral' ? '😐' : '😔';
export const getMoodColor = (mood: 'low' | 'neutral' | 'high') => mood === 'high' ? C.success : mood === 'neutral' ? C.warning : C.error;
