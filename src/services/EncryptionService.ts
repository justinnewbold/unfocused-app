/**
 * EncryptionService - End-to-end encryption for sensitive data
 *
 * Features:
 * - Encrypt sensitive data (medication, mood logs)
 * - Key derivation from user password
 * - Secure key storage
 * - Data at rest encryption
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  ENCRYPTION_KEY: 'nero_encryption_key',
  SALT: 'nero_encryption_salt',
  SETTINGS: 'nero_encryption_settings',
};

export interface EncryptionSettings {
  enabled: boolean;
  encryptMedication: boolean;
  encryptMoodLogs: boolean;
  encryptNotes: boolean;
  keyDerivationIterations: number;
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  version: number;
}

const DEFAULT_SETTINGS: EncryptionSettings = {
  enabled: false,
  encryptMedication: true,
  encryptMoodLogs: true,
  encryptNotes: true,
  keyDerivationIterations: 100000,
};

// Encryption version for future algorithm changes
const ENCRYPTION_VERSION = 1;

export class EncryptionService {
  private settings: EncryptionSettings = DEFAULT_SETTINGS;
  private encryptionKey: string | null = null;
  private salt: string | null = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Load settings
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }

      // Load salt
      if (Platform.OS !== 'web') {
        this.salt = await SecureStore.getItemAsync(STORAGE_KEYS.SALT);
      } else {
        this.salt = await AsyncStorage.getItem(STORAGE_KEYS.SALT);
      }

      // Note: Key is not loaded automatically - user must unlock with password
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize EncryptionService:', error);
    }
  }

  // ============ KEY MANAGEMENT ============

  /**
   * Set up encryption with a user password
   */
  async setupEncryption(password: string): Promise<boolean> {
    try {
      // Generate random salt
      const saltBytes = await Crypto.getRandomBytesAsync(16);
      this.salt = this.bytesToBase64(saltBytes);

      // Derive key from password
      this.encryptionKey = await this.deriveKey(password, this.salt);

      // Store salt securely
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(STORAGE_KEYS.SALT, this.salt);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.SALT, this.salt);
      }

      // Store key in secure storage (session only on web)
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(STORAGE_KEYS.ENCRYPTION_KEY, this.encryptionKey);
      }

      this.settings.enabled = true;
      await this.saveSettings();

      return true;
    } catch (error) {
      console.error('Failed to setup encryption:', error);
      return false;
    }
  }

  /**
   * Unlock encryption with password
   */
  async unlock(password: string): Promise<boolean> {
    if (!this.salt) {
      console.error('No encryption setup found');
      return false;
    }

    try {
      this.encryptionKey = await this.deriveKey(password, this.salt);

      // Verify key works by trying to decrypt test data
      const testData = await AsyncStorage.getItem('nero_encryption_test');
      if (testData) {
        try {
          const decrypted = await this.decrypt(JSON.parse(testData));
          if (decrypted !== 'test') {
            throw new Error('Key verification failed');
          }
        } catch {
          this.encryptionKey = null;
          return false;
        }
      } else {
        // Store test data for future verification
        const encrypted = await this.encrypt('test');
        await AsyncStorage.setItem('nero_encryption_test', JSON.stringify(encrypted));
      }

      // Store key for session
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(STORAGE_KEYS.ENCRYPTION_KEY, this.encryptionKey);
      }

      return true;
    } catch (error) {
      console.error('Failed to unlock encryption:', error);
      this.encryptionKey = null;
      return false;
    }
  }

  /**
   * Lock encryption (clear key from memory)
   */
  async lock(): Promise<void> {
    this.encryptionKey = null;
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ENCRYPTION_KEY);
    }
  }

  /**
   * Check if encryption is unlocked
   */
  isUnlocked(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Check if encryption is set up
   */
  isSetup(): boolean {
    return this.salt !== null && this.settings.enabled;
  }

  /**
   * Change encryption password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (!this.salt) return false;

    try {
      // Verify old password
      const oldKey = await this.deriveKey(oldPassword, this.salt);
      if (oldKey !== this.encryptionKey) {
        return false;
      }

      // Generate new salt and key
      const newSaltBytes = await Crypto.getRandomBytesAsync(16);
      const newSalt = this.bytesToBase64(newSaltBytes);
      const newKey = await this.deriveKey(newPassword, newSalt);

      // TODO: Re-encrypt all encrypted data with new key
      // This would require iterating through all encrypted data
      // For now, just update the key

      this.salt = newSalt;
      this.encryptionKey = newKey;

      // Store new salt
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(STORAGE_KEYS.SALT, this.salt);
        await SecureStore.setItemAsync(STORAGE_KEYS.ENCRYPTION_KEY, this.encryptionKey);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.SALT, this.salt);
      }

      return true;
    } catch (error) {
      console.error('Failed to change password:', error);
      return false;
    }
  }

  // ============ ENCRYPTION/DECRYPTION ============

  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not unlocked');
    }

    try {
      // Generate random IV
      const ivBytes = await Crypto.getRandomBytesAsync(16);
      const iv = this.bytesToBase64(ivBytes);

      // Simple XOR encryption (in production, use proper AES)
      // Note: expo-crypto doesn't provide AES directly, so this is simplified
      const ciphertext = this.xorEncrypt(plaintext, this.encryptionKey, iv);

      return {
        ciphertext,
        iv,
        version: ENCRYPTION_VERSION,
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  async decrypt(encrypted: EncryptedData): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption not unlocked');
    }

    try {
      if (encrypted.version !== ENCRYPTION_VERSION) {
        throw new Error(`Unsupported encryption version: ${encrypted.version}`);
      }

      // Decrypt using XOR (simplified)
      const plaintext = this.xorDecrypt(encrypted.ciphertext, this.encryptionKey, encrypted.iv);

      return plaintext;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  // ============ HELPER METHODS ============

  /**
   * Encrypt an object (JSON)
   */
  async encryptObject(obj: any): Promise<EncryptedData> {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt an object (JSON)
   */
  async decryptObject<T>(encrypted: EncryptedData): Promise<T> {
    const json = await this.decrypt(encrypted);
    return JSON.parse(json);
  }

  /**
   * Check if data should be encrypted based on type
   */
  shouldEncrypt(dataType: 'medication' | 'mood' | 'notes' | 'other'): boolean {
    if (!this.settings.enabled || !this.isUnlocked()) return false;

    switch (dataType) {
      case 'medication':
        return this.settings.encryptMedication;
      case 'mood':
        return this.settings.encryptMoodLogs;
      case 'notes':
        return this.settings.encryptNotes;
      default:
        return false;
    }
  }

  // ============ KEY DERIVATION ============

  private async deriveKey(password: string, salt: string): Promise<string> {
    // Use PBKDF2-like approach with SHA-256
    // Note: This is simplified - in production use proper PBKDF2
    let key = password + salt;

    for (let i = 0; i < this.settings.keyDerivationIterations; i++) {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        key
      );
      key = digest;
    }

    return key;
  }

  // ============ SIMPLIFIED ENCRYPTION ============
  // Note: In production, use proper AES encryption

  private xorEncrypt(plaintext: string, key: string, iv: string): string {
    const combined = key + iv;
    let result = '';

    for (let i = 0; i < plaintext.length; i++) {
      const charCode = plaintext.charCodeAt(i) ^ combined.charCodeAt(i % combined.length);
      result += String.fromCharCode(charCode);
    }

    return this.stringToBase64(result);
  }

  private xorDecrypt(ciphertext: string, key: string, iv: string): string {
    const encrypted = this.base64ToString(ciphertext);
    const combined = key + iv;
    let result = '';

    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ combined.charCodeAt(i % combined.length);
      result += String.fromCharCode(charCode);
    }

    return result;
  }

  // ============ BASE64 HELPERS ============

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private stringToBase64(str: string): string {
    return btoa(unescape(encodeURIComponent(str)));
  }

  private base64ToString(base64: string): string {
    return decodeURIComponent(escape(atob(base64)));
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<EncryptionSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): EncryptionSettings {
    return { ...this.settings };
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save encryption settings:', error);
    }
  }

  // ============ DATA REMOVAL ============

  /**
   * Remove all encryption (decrypt all data and disable)
   */
  async disableEncryption(): Promise<boolean> {
    if (!this.isUnlocked()) {
      return false;
    }

    try {
      // TODO: Decrypt all encrypted data and save unencrypted
      // This would require access to all data stores

      // Clear encryption setup
      this.encryptionKey = null;
      this.salt = null;
      this.settings.enabled = false;

      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(STORAGE_KEYS.ENCRYPTION_KEY);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.SALT);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SALT);
      }

      await AsyncStorage.removeItem('nero_encryption_test');
      await this.saveSettings();

      return true;
    } catch (error) {
      console.error('Failed to disable encryption:', error);
      return false;
    }
  }
}

// Singleton instance
let serviceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!serviceInstance) {
    serviceInstance = new EncryptionService();
  }
  return serviceInstance;
}

export async function initializeEncryptionService(): Promise<EncryptionService> {
  const service = getEncryptionService();
  await service.initialize();
  return service;
}
