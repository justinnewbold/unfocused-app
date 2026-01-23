# EAS Build Setup Guide

This guide walks you through setting up EAS Build for UnFocused to test push notifications and voice input on physical devices.

## Prerequisites

1. **Expo Account** - Sign up at [expo.dev](https://expo.dev)
2. **Apple Developer Account** (for iOS) - Required for device testing
3. **Physical Device** - Push notifications don't work on simulators

## Quick Setup (5 minutes)

### Step 1: Link Project to EAS

1. Go to [expo.dev](https://expo.dev) and sign in
2. Create a new project called "unfocused"
3. Copy your project ID (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
4. Update `app.json` with your project ID:
   ```json
   "extra": {
     "eas": {
       "projectId": "YOUR_PROJECT_ID_HERE"
     }
   }
   ```

### Step 2: Add EXPO_TOKEN to GitHub

1. Go to [expo.dev/accounts/[you]/settings/access-tokens](https://expo.dev/settings/access-tokens)
2. Create a new token with "Read and write" access
3. Go to your GitHub repo → Settings → Secrets and variables → Actions
4. Add a new secret: `EXPO_TOKEN` with your token value

### Step 3: Trigger a Build

**Option A: Automatic (on push to main)**
- Just push code changes to main branch
- The workflow automatically builds when src/, app.json, package.json, or eas.json changes

**Option B: Manual trigger**
1. Go to your GitHub repo → Actions → "EAS Build"
2. Click "Run workflow"
3. Select platform (ios/android/all) and profile (development/preview/production)
4. Click "Run workflow"

### Step 4: Install on Device

1. Go to [expo.dev](https://expo.dev) → Your Project → Builds
2. Wait for build to complete (~10-15 minutes)
3. Scan the QR code with your device OR download the .apk/.ipa file

## Build Profiles

| Profile | Purpose | Output |
|---------|---------|--------|
| `development` | Testing with hot reload | Development client APK/IPA |
| `preview` | Beta testing | Installable APK/IPA |
| `production` | App Store release | AAB/IPA for stores |

## Testing Push Notifications

Once you have the development build installed:

1. Open the app on your physical device
2. Grant notification permissions when prompted
3. The app will automatically schedule test notifications
4. You should receive push notifications even when the app is backgrounded

## Testing Voice Input

1. Open the app on your device
2. Tap the floating microphone button
3. Grant microphone permissions when prompted
4. Speak your task - it will be transcribed and categorized

## Troubleshooting

### "Missing EAS project ID"
- Make sure `app.json` has the correct `projectId` under `extra.eas`

### "EXPO_TOKEN not found"
- Add the secret to GitHub repository settings

### iOS build fails with signing errors
- You need an Apple Developer account ($99/year)
- EAS will handle provisioning profiles automatically

### Notifications not working
- Must test on physical device (not simulator)
- Check that notification permissions are granted
- Verify push token is being registered (check console logs)

## Local Build Commands

If you prefer to build locally (requires Xcode/Android Studio):

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for development
eas build --profile development --platform ios
eas build --profile development --platform android

# Build for preview/testing
eas build --profile preview --platform all
```

## Next Steps After Setup

1. ✅ Build and install development client
2. ✅ Test push notifications on physical device
3. ✅ Test voice input transcription
4. 🔜 Configure Apple Developer account for iOS distribution
5. 🔜 Set up Google Play Console for Android distribution
