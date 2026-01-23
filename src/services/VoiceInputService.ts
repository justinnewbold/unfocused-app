/**
 * VoiceInputService - Quick voice capture for ADHD brains
 * 
 * Features:
 * - One-tap voice recording
 * - Whisper transcription via OpenAI
 * - Auto-categorization (task, thought, reminder)
 * - Web and native support
 */

import { Audio } from 'expo-av';
import { Platform } from 'react-native';

export type VoiceInputType = 'task' | 'thought' | 'reminder' | 'unknown';

export interface TranscriptionResult {
  text: string;
  type: VoiceInputType;
  confidence: number;
  duration: number;
  timestamp: string;
}

interface VoiceInputConfig {
  apiKey: string;
  onTranscriptionComplete?: (result: TranscriptionResult) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (error: string) => void;
}

export class VoiceInputService {
  private recording: Audio.Recording | null = null;
  private config: VoiceInputConfig;
  private isRecording = false;
  private recordingStartTime: number = 0;
  
  // Web-specific
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  constructor(config: VoiceInputConfig) {
    this.config = config;
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        return true;
      } catch {
        return false;
      }
    }
    
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }

  async startRecording(): Promise<boolean> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      this.config.onError?.('Microphone permission not granted');
      return false;
    }

    try {
      if (Platform.OS === 'web') {
        return this.startWebRecording();
      }
      return this.startNativeRecording();
    } catch (error) {
      this.config.onError?.(`Failed to start recording: ${error}`);
      return false;
    }
  }

  private async startWebRecording(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        await this.transcribeAudio(audioBlob, duration);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.config.onRecordingStart?.();
      return true;
    } catch (error) {
      this.config.onError?.(`Web recording error: ${error}`);
      return false;
    }
  }

  private async startNativeRecording(): Promise<boolean> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      this.recording = recording;
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      this.config.onRecordingStart?.();
      return true;
    } catch (error) {
      this.config.onError?.(`Native recording error: ${error}`);
      return false;
    }
  }

  async stopRecording(): Promise<TranscriptionResult | null> {
    if (!this.isRecording) return null;

    try {
      if (Platform.OS === 'web') {
        return this.stopWebRecording();
      }
      return this.stopNativeRecording();
    } catch (error) {
      this.config.onError?.(`Failed to stop recording: ${error}`);
      return null;
    }
  }

  private async stopWebRecording(): Promise<TranscriptionResult | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const duration = (Date.now() - this.recordingStartTime) / 1000;
        
        this.isRecording = false;
        this.config.onRecordingStop?.();
        
        const result = await this.transcribeAudio(audioBlob, duration);
        resolve(result);
      };

      this.mediaRecorder.stop();
    });
  }

  private async stopNativeRecording(): Promise<TranscriptionResult | null> {
    if (!this.recording) return null;

    await this.recording.stopAndUnloadAsync();
    const uri = this.recording.getURI();
    const duration = (Date.now() - this.recordingStartTime) / 1000;
    
    this.isRecording = false;
    this.config.onRecordingStop?.();

    if (!uri) return null;

    // Convert to blob for API
    const response = await fetch(uri);
    const blob = await response.blob();
    
    this.recording = null;
    return this.transcribeAudio(blob, duration);
  }

  private async transcribeAudio(audioBlob: Blob, duration: number): Promise<TranscriptionResult | null> {
    if (!this.config.apiKey) {
      this.config.onError?.('No API key configured');
      return null;
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = await response.json();
      const text = data.text?.trim() || '';

      if (!text) {
        this.config.onError?.('No speech detected');
        return null;
      }

      const result: TranscriptionResult = {
        text,
        type: this.categorizeInput(text),
        confidence: 0.9, // Whisper doesn't return confidence, using default
        duration,
        timestamp: new Date().toISOString(),
      };

      this.config.onTranscriptionComplete?.(result);
      return result;
    } catch (error) {
      this.config.onError?.(`Transcription error: ${error}`);
      return null;
    }
  }

  private categorizeInput(text: string): VoiceInputType {
    const lowerText = text.toLowerCase();

    // Task indicators
    const taskKeywords = [
      'need to', 'have to', 'should', 'must', 'want to',
      'todo', 'to do', 'task', 'finish', 'complete',
      'work on', 'start', 'do the', 'get the', 'make the',
      'call', 'email', 'send', 'buy', 'pick up', 'schedule'
    ];
    
    // Reminder indicators
    const reminderKeywords = [
      'remind me', 'remember to', "don't forget",
      'reminder', 'at ', 'tomorrow', 'later', 'tonight',
      'in the morning', 'by ', 'before '
    ];

    // Check for reminders first (more specific)
    if (reminderKeywords.some(kw => lowerText.includes(kw))) {
      return 'reminder';
    }

    // Check for tasks
    if (taskKeywords.some(kw => lowerText.includes(kw))) {
      return 'task';
    }

    // Default to thought (for thought dumps)
    return 'thought';
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  async cancelRecording(): Promise<void> {
    if (Platform.OS === 'web' && this.mediaRecorder) {
      this.mediaRecorder.stop();
    } else if (this.recording) {
      await this.recording.stopAndUnloadAsync();
      this.recording = null;
    }
    this.isRecording = false;
    this.config.onRecordingStop?.();
  }
}

// Helper hook for React components
export function createVoiceInputHandler(
  apiKey: string,
  onResult: (result: TranscriptionResult) => void,
  onError?: (error: string) => void
) {
  const service = new VoiceInputService({
    apiKey,
    onTranscriptionComplete: onResult,
    onError,
  });

  return {
    startRecording: () => service.startRecording(),
    stopRecording: () => service.stopRecording(),
    cancelRecording: () => service.cancelRecording(),
    isRecording: () => service.getIsRecording(),
  };
}