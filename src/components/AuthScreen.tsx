import React, { useState } from 'react';
import { supabase } from '../services/supabase';

interface AuthScreenProps {
  onAuthSuccess: (userId: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        if (data.user) {
          onAuthSuccess(data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data.user && !data.session) {
          setMessage('Check your email for the confirmation link!');
        } else if (data.user) {
          onAuthSuccess(data.user.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    // Generate a temporary guest ID for demo purposes
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    onAuthSuccess(guestId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Nero Avatar */}
        <div style={styles.avatarContainer}>
          <div style={styles.avatar}>
            <span style={styles.avatarEmoji}>🧠</span>
          </div>
          <h1 style={styles.title}>UnFocused</h1>
          <p style={styles.subtitle}>Your AI Companion for the ADHD Brain</p>
        </div>

        {/* Welcome Message from Nero */}
        <div style={styles.neroMessage}>
          <p style={styles.neroText}>
            Hey there! I'm Nero, your new focus companion. 
            {isLogin 
              ? " Welcome back! Let's pick up where we left off." 
              : " I'm excited to learn about you and help you work with your brain, not against it."}
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuth} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
              minLength={6}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? 'Working on it...' : isLogin ? "Let's Go!" : 'Create Account'}
          </button>
        </form>

        {/* Toggle Login/Signup */}
        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setMessage(null);
          }}
          style={styles.toggleButton}
        >
          {isLogin ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        {/* Guest Mode */}
        <button onClick={handleGuestMode} style={styles.guestButton}>
          🎯 Try as Guest (no account needed)
        </button>

        <p style={styles.guestNote}>
          Guest mode is great for trying things out, but your data won't sync across devices.
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    padding: '40px',
    maxWidth: '420px',
    width: '100%',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
  },
  avatarContainer: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.4)',
  },
  avatarEmoji: {
    fontSize: '40px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#ffffff',
    margin: '0 0 8px 0',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
    margin: 0,
  },
  neroMessage: {
    background: 'rgba(102, 126, 234, 0.15)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '24px',
    borderLeft: '3px solid #667eea',
  },
  neroText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    lineHeight: 1.6,
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    fontSize: '16px',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  button: {
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  toggleButton: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '16px',
    padding: '8px',
    width: '100%',
    transition: 'color 0.2s ease',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
  },
  dividerText: {
    flex: 1,
    textAlign: 'center' as const,
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '13px',
    position: 'relative' as const,
  },
  guestButton: {
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '15px',
    cursor: 'pointer',
    width: '100%',
    transition: 'all 0.2s ease',
  },
  guestNote: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center' as const,
    marginTop: '12px',
    lineHeight: 1.4,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
  },
  success: {
    background: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#86efac',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
  },
};

export default AuthScreen;
