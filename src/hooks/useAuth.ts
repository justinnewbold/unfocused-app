import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
  guestId: string | null;
}

interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>;
  userId: string | null;
  isAuthenticated: boolean;
}

export const useAuth = (): UseAuthReturn => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isGuest: false,
    guestId: null,
  });

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setState({
            user: session.user,
            session,
            loading: false,
            isGuest: false,
            guestId: null,
          });
        } else {
          // Check for guest ID in localStorage
          const storedGuestId = localStorage.getItem('unfocused_guest_id');
          if (storedGuestId) {
            setState({
              user: null,
              session: null,
              loading: false,
              isGuest: true,
              guestId: storedGuestId,
            });
          } else {
            setState({
              user: null,
              session: null,
              loading: false,
              isGuest: false,
              guestId: null,
            });
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (session?.user) {
          // Clear guest ID when logging in
          localStorage.removeItem('unfocused_guest_id');
          setState({
            user: session.user,
            session,
            loading: false,
            isGuest: false,
            guestId: null,
          });
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            session: null,
            loading: false,
            isGuest: false,
            guestId: null,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (state.isGuest) {
        // Clear guest data
        localStorage.removeItem('unfocused_guest_id');
        setState({
          user: null,
          session: null,
          loading: false,
          isGuest: false,
          guestId: null,
        });
      } else {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [state.isGuest]);

  // Helper to set guest mode (called from AuthScreen)
  const setGuestMode = useCallback((guestId: string) => {
    localStorage.setItem('unfocused_guest_id', guestId);
    setState({
      user: null,
      session: null,
      loading: false,
      isGuest: true,
      guestId,
    });
  }, []);

  return {
    ...state,
    signOut,
    userId: state.user?.id || state.guestId,
    isAuthenticated: !!(state.user || state.guestId),
  };
};

// Export helper to set guest mode
export const setGuestMode = (guestId: string) => {
  localStorage.setItem('unfocused_guest_id', guestId);
  // Trigger a re-render by dispatching a custom event
  window.dispatchEvent(new CustomEvent('guest-mode-set', { detail: { guestId } }));
};

export default useAuth;
