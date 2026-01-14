// Authentication Hook for Supabase
// Manages user authentication state and provides auth methods

import { useState, useEffect, useCallback } from 'react';
import { supabase, AuthAPI } from '../services/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export interface AuthActions {
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (mounted) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          
          if (event === 'SIGNED_IN') {
            console.log('User signed in:', newSession?.user?.email);
          } else if (event === 'SIGNED_OUT') {
            console.log('User signed out');
          } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed');
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await AuthAPI.signUp(email, password);

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return false;
      }

      if (data?.user && !data.session) {
        // Email confirmation required
        setError('Please check your email to confirm your account');
        setLoading(false);
        return false;
      }

      setLoading(false);
      return true;
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
      return false;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await AuthAPI.signIn(email, password);

      if (signInError) {
        // User-friendly error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please confirm your email address first');
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return false;
      }

      setLoading(false);
      return true;
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
      return false;
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await AuthAPI.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    clearError,
  };
}

export default useAuth;
