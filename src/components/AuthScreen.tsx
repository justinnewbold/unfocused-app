// Authentication Screen for UnFocused
// Clean, ADHD-friendly login/signup interface

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Animated,
} from 'react-native';

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<boolean>;
  onSignUp: (email: string, password: string) => Promise<boolean>;
  onSkip: () => void;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function AuthScreen({ 
  onSignIn, 
  onSignUp, 
  onSkip, 
  loading, 
  error, 
  clearError 
}: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();

    // Validation
    if (!email.trim()) {
      setLocalError('Please enter your email');
      return;
    }
    if (!password) {
      setLocalError('Please enter a password');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('Passwords don\'t match');
      return;
    }

    if (mode === 'signin') {
      await onSignIn(email.trim(), password);
    } else {
      await onSignUp(email.trim(), password);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setLocalError(null);
    clearError();
    setPassword('');
    setConfirmPassword('');
  };

  const displayError = localError || error;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo & Title */}
          <View style={styles.header}>
            <Text style={styles.logo}>🧠</Text>
            <Text style={styles.title}>UnFocused</Text>
            <Text style={styles.subtitle}>
              {mode === 'signin' 
                ? 'Welcome back! Let\'s get you focused.' 
                : 'Create your account to sync across devices'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />

            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#888"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
            )}

            {displayError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>⚠️ {displayError}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.switchButton}
              onPress={switchMode}
              disabled={loading}
            >
              <Text style={styles.switchText}>
                {mode === 'signin' 
                  ? 'Don\'t have an account? Sign up' 
                  : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Skip Option */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={onSkip}
              disabled={loading}
            >
              <Text style={styles.skipText}>
                Skip for now (data stays local)
              </Text>
            </TouchableOpacity>
            <Text style={styles.skipNote}>
              You can sign in later to sync across devices
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    maxWidth: 280,
  },
  form: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    padding: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#6366f1',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  skipButton: {
    padding: 12,
  },
  skipText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  skipNote: {
    color: '#444',
    fontSize: 12,
    marginTop: 4,
  },
});

export default AuthScreen;
