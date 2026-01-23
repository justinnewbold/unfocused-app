/**
 * VoiceInputButton - One-tap voice capture for ADHD brains
 * 
 * A floating action button that lets users quickly capture
 * thoughts, tasks, or reminders via voice.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { VoiceInputService, TranscriptionResult, VoiceInputType } from '../services/VoiceInputService';

interface VoiceInputButtonProps {
  apiKey: string;
  onTaskCaptured?: (text: string) => void;
  onThoughtCaptured?: (text: string) => void;
  onReminderCaptured?: (text: string) => void;
  onError?: (error: string) => void;
  position?: 'bottomRight' | 'bottomLeft' | 'bottomCenter';
  disabled?: boolean;
}

const COLORS = {
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  background: '#0F0F1A',
  card: '#252542',
  text: '#FFFFFF',
  textSecondary: '#B8B8D1',
  success: '#00B894',
  error: '#FF6B6B',
  recording: '#FF6B6B',
};

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  apiKey,
  onTaskCaptured,
  onThoughtCaptured,
  onReminderCaptured,
  onError,
  position = 'bottomRight',
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const serviceRef = useRef<VoiceInputService | null>(null);

  useEffect(() => {
    // Initialize the voice input service
    serviceRef.current = new VoiceInputService({
      apiKey,
      onRecordingStart: () => setIsRecording(true),
      onRecordingStop: () => setIsRecording(false),
      onTranscriptionComplete: handleTranscriptionComplete,
      onError: handleError,
    });

    return () => {
      serviceRef.current?.cancelRecording();
    };
  }, [apiKey]);

  useEffect(() => {
    // Pulse animation while recording
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handleTranscriptionComplete = (result: TranscriptionResult) => {
    setIsProcessing(false);
    setLastResult(result);
    setShowModal(true);

    // Route to appropriate handler based on type
    switch (result.type) {
      case 'task':
        onTaskCaptured?.(result.text);
        break;
      case 'thought':
        onThoughtCaptured?.(result.text);
        break;
      case 'reminder':
        onReminderCaptured?.(result.text);
        break;
    }
  };

  const handleError = (errorMsg: string) => {
    setIsProcessing(false);
    setError(errorMsg);
    onError?.(errorMsg);
    
    // Auto-clear error after 3 seconds
    setTimeout(() => setError(null), 3000);
  };

  const handlePress = async () => {
    if (disabled || !serviceRef.current) return;

    if (isRecording) {
      // Stop recording and process
      setIsProcessing(true);
      await serviceRef.current.stopRecording();
    } else {
      // Start recording
      setError(null);
      const started = await serviceRef.current.startRecording();
      if (!started) {
        handleError('Could not start recording. Check microphone permissions.');
      }
    }
  };

  const handleLongPress = async () => {
    // Cancel recording if in progress
    if (isRecording && serviceRef.current) {
      await serviceRef.current.cancelRecording();
      setIsRecording(false);
    }
  };

  const getTypeIcon = (type: VoiceInputType): string => {
    switch (type) {
      case 'task': return '✅';
      case 'thought': return '💭';
      case 'reminder': return '⏰';
      default: return '🎤';
    }
  };

  const getTypeLabel = (type: VoiceInputType): string => {
    switch (type) {
      case 'task': return 'Task';
      case 'thought': return 'Thought';
      case 'reminder': return 'Reminder';
      default: return 'Captured';
    }
  };

  const getPositionStyle = () => {
    switch (position) {
      case 'bottomLeft':
        return { left: 20, right: undefined };
      case 'bottomCenter':
        return { left: '50%', marginLeft: -30, right: undefined };
      default:
        return { right: 20, left: undefined };
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          getPositionStyle(),
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.button,
            isRecording && styles.buttonRecording,
            disabled && styles.buttonDisabled,
          ]}
          onPress={handlePress}
          onLongPress={handleLongPress}
          disabled={disabled || isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Text style={styles.buttonIcon}>
              {isRecording ? '⏹️' : '🎤'}
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        )}
        
        {/* Error indicator */}
        {error && (
          <View style={styles.errorIndicator}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </Animated.View>

      {/* Result Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {lastResult && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalIcon}>{getTypeIcon(lastResult.type)}</Text>
                  <Text style={styles.modalType}>{getTypeLabel(lastResult.type)}</Text>
                </View>
                
                <Text style={styles.modalText}>{lastResult.text}</Text>
                
                <View style={styles.modalMeta}>
                  <Text style={styles.metaText}>
                    {lastResult.duration.toFixed(1)}s • {new Date(lastResult.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.modalButtonText}>Got it!</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    position: 'absolute',
    bottom: 100,
    zIndex: 1000,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonRecording: {
    backgroundColor: COLORS.recording,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 28,
  },
  recordingIndicator: {
    position: 'absolute',
    top: -40,
    left: -20,
    right: -20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.recording,
    marginRight: 6,
  },
  recordingText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  errorIndicator: {
    position: 'absolute',
    top: -40,
    left: -60,
    right: -60,
    backgroundColor: COLORS.error,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 11,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  modalType: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  modalMeta: {
    marginBottom: 20,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default VoiceInputButton;