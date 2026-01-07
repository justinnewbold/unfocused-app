# UnFocused 🧠

**Your AI Companion for the ADHD Brain**

An AI-powered companion app designed specifically for people with ADHD. Unlike other productivity apps that treat ADHD as a discipline problem, UnFocused adapts to how ADHD brains actually work.

## ✨ Features

### 🤖 AI Companion (Nero)
- Personalized AI assistant with multiple personality modes
- Real Claude AI integration for smart responses
- Learns your patterns and preferences
- Transparent AI thinking display

### 📅 Google Calendar Integration (NEW!)
- **OAuth 2.0 Authentication** - Secure Google sign-in
- **Two-way Sync** - See events, create from tasks
- **Time Blocking** - Schedule focus blocks directly
- **Smart Scheduling** - Find available slots automatically
- **Travel Alerts** - Get notified when to leave

### 🎤 Voice Input (NEW!)
- **Voice Recording** - Add tasks by speaking
- **Nero Voice Responses** - Let Nero read responses aloud
- **Hands-free Mode** - Perfect for when typing is hard

### 🔔 Native Push Notifications (NEW!)
- **Expo Push Notifications** - Works even when app is closed
- **Daily Check-ins** - Morning reminders
- **Task Reminders** - Never forget scheduled tasks
- **Hyperfocus Alerts** - Break reminders during deep work

### 🧠 AI-Powered Pattern Analysis
- **Peak Hours Detection** - Know when you're most productive
- **Completion Tracking** - Track task completion times
- **Weekly Insights** - AI-generated recommendations
- **Energy Correlation** - Link energy levels to success

### 📊 6 View Modes
- **Conversation** - Chat with Nero naturally
- **One Thing** - Focus on single task
- **List** - Traditional task list
- **Timeline** - Visual day planner
- **Dashboard** - Stats and achievements
- **Minimal** - Low-energy simplified view

### 🎮 ADHD-Friendly Design
- Positive-only gamification (no streaks!)
- Satisfying completion animations
- Micro-step task breakdown
- Energy-aware suggestions
- Context saving/restoration
- Thought dump capture

## 🚀 Getting Started

### Web (Live Demo)
Visit: https://unfocused-app.vercel.app

### Mobile (iOS/Android)

#### Development Build
```bash
npm install
npx expo start
```

#### Production Build (EAS)
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

## 📱 App Store Submission

### iOS Requirements
1. Apple Developer Account ($99/year)
2. App Store Connect setup
3. Configure `app.json` with your Bundle ID
4. Run `eas submit --platform ios`

### Android Requirements
1. Google Play Developer Account ($25 one-time)
2. Google Play Console setup
3. Create service account for automated submission
4. Run `eas submit --platform android`

## 🔧 Configuration

### Google Calendar OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add your Client IDs to App.tsx:
```typescript
const GOOGLE_CLIENT_ID_WEB = 'your-web-client-id';
const GOOGLE_CLIENT_ID_IOS = 'your-ios-client-id';
const GOOGLE_CLIENT_ID_ANDROID = 'your-android-client-id';
```

### Claude API (Optional)
Add your Anthropic API key in Settings for enhanced AI responses.

### Supabase Sync (Optional)
Add your Supabase anon key in Settings for cloud sync.

## 🛠 Tech Stack

- **Framework**: React Native / Expo SDK 52
- **AI**: Claude API (Anthropic)
- **Notifications**: Expo Notifications
- **Voice**: expo-av, expo-speech
- **Calendar**: Google Calendar API
- **Auth**: expo-auth-session
- **Storage**: AsyncStorage + Supabase
- **Deployment**: Vercel (web) + EAS (native)

## 📁 Project Structure

```
unfocused-app/
├── App.tsx           # Main application
├── app.json          # Expo configuration
├── eas.json          # EAS Build configuration
├── package.json      # Dependencies
├── assets/           # Icons and splash screens
└── README.md
```

## 🎯 Core UX Laws

1. **ONE question at a time** - Never overwhelm
2. **MAXIMUM 3 options** - Prevent decision paralysis
3. **Positive only** - No punishment mechanics
4. **Adapt to user** - Not the other way around

## 🔒 Privacy

- Local-first data storage
- Optional cloud sync
- No tracking or analytics
- User controls all data

## 📄 License

MIT License - Use freely!

---

Built with 💜 for the ADHD community
