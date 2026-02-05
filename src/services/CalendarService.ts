/**
 * CalendarService - Unified calendar integration supporting multiple providers
 *
 * Supports:
 * - Apple Calendar (native via expo-calendar)
 * - Google Calendar (OAuth API)
 * - Local calendar storage
 *
 * Features:
 * - Two-way sync
 * - Time blocking
 * - Travel time alerts
 * - Smart scheduling
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CalendarProvider,
  CalendarAccount,
  CalendarSettings,
  CalendarEvent,
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'nero_calendar_settings',
  ACCOUNTS: 'nero_calendar_accounts',
  EVENTS_CACHE: 'nero_calendar_events_cache',
};

const DEFAULT_SETTINGS: CalendarSettings = {
  defaultProvider: 'local',
  accounts: [],
  syncEnabled: false,
  autoTimeBlocking: false,
  travelTimeBuffer: 30,
};

export class CalendarService {
  private settings: CalendarSettings = DEFAULT_SETTINGS;
  private eventsCache: Map<string, CalendarEvent[]> = new Map();

  async initialize(): Promise<boolean> {
    try {
      const settingsJson = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settingsJson) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsJson) };
      }

      // Load events cache
      const cacheJson = await AsyncStorage.getItem(STORAGE_KEYS.EVENTS_CACHE);
      if (cacheJson) {
        const cacheData = JSON.parse(cacheJson);
        this.eventsCache = new Map(Object.entries(cacheData));
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize CalendarService:', error);
      return false;
    }
  }

  // ============ APPLE CALENDAR INTEGRATION ============

  async connectAppleCalendar(): Promise<CalendarAccount | null> {
    if (Platform.OS === 'web') {
      console.log('Apple Calendar not available on web');
      return null;
    }

    try {
      // Request permissions
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        console.log('Calendar permission not granted');
        return null;
      }

      // Get calendars
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

      // Find the primary calendar
      const primaryCalendar = calendars.find(c => c.isPrimary) || calendars[0];

      if (!primaryCalendar) {
        console.log('No calendars found');
        return null;
      }

      const account: CalendarAccount = {
        id: `apple_${primaryCalendar.id}`,
        provider: 'apple',
        displayName: primaryCalendar.title || 'Apple Calendar',
        connected: true,
        lastSynced: new Date().toISOString(),
      };

      // Add to accounts
      this.settings.accounts = this.settings.accounts.filter(a => a.provider !== 'apple');
      this.settings.accounts.push(account);
      this.settings.syncEnabled = true;

      if (!this.settings.defaultProvider || this.settings.defaultProvider === 'local') {
        this.settings.defaultProvider = 'apple';
      }

      await this.saveSettings();
      return account;
    } catch (error) {
      console.error('Failed to connect Apple Calendar:', error);
      return null;
    }
  }

  async disconnectAppleCalendar(): Promise<void> {
    this.settings.accounts = this.settings.accounts.filter(a => a.provider !== 'apple');
    if (this.settings.defaultProvider === 'apple') {
      this.settings.defaultProvider = this.settings.accounts[0]?.provider || 'local';
    }
    await this.saveSettings();
  }

  async getAppleCalendarEvents(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    if (Platform.OS === 'web') return [];

    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      if (status !== 'granted') return [];

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendarIds = calendars.map(c => c.id);

      const events = await Calendar.getEventsAsync(
        calendarIds,
        startDate,
        endDate
      );

      return events.map(event => ({
        id: event.id,
        title: event.title,
        start: event.startDate,
        end: event.endDate,
        allDay: event.allDay,
        color: event.calendarId ? this.getCalendarColor(event.calendarId, calendars) : undefined,
      }));
    } catch (error) {
      console.error('Failed to get Apple Calendar events:', error);
      return [];
    }
  }

  private getCalendarColor(calendarId: string, calendars: Calendar.Calendar[]): string | undefined {
    const calendar = calendars.find(c => c.id === calendarId);
    return calendar?.color;
  }

  async createAppleCalendarEvent(
    title: string,
    startDate: Date,
    endDate: Date,
    options?: {
      notes?: string;
      location?: string;
      alerts?: number[]; // minutes before
    }
  ): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      if (status !== 'granted') return null;

      // Get default calendar
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(c => c.allowsModifications && c.isPrimary)
        || calendars.find(c => c.allowsModifications);

      if (!defaultCalendar) {
        console.log('No writable calendar found');
        return null;
      }

      const eventDetails: Partial<Calendar.Event> = {
        title,
        startDate,
        endDate,
        notes: options?.notes,
        location: options?.location,
        alarms: options?.alerts?.map(minutes => ({
          relativeOffset: -minutes,
          method: Calendar.AlarmMethod.ALERT,
        })),
      };

      const eventId = await Calendar.createEventAsync(defaultCalendar.id, eventDetails);
      return eventId;
    } catch (error) {
      console.error('Failed to create Apple Calendar event:', error);
      return null;
    }
  }

  async deleteAppleCalendarEvent(eventId: string): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      await Calendar.deleteEventAsync(eventId);
      return true;
    } catch (error) {
      console.error('Failed to delete Apple Calendar event:', error);
      return false;
    }
  }

  // ============ GOOGLE CALENDAR INTEGRATION ============
  // Note: Google Calendar requires OAuth and is handled separately in App.tsx
  // These methods provide a unified interface

  async connectGoogleCalendar(accessToken: string, refreshToken?: string): Promise<CalendarAccount | null> {
    try {
      // Verify token by fetching calendar list
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      const data = await response.json();
      const primaryCalendar = data.items?.find((c: any) => c.primary);

      const account: CalendarAccount = {
        id: `google_${primaryCalendar?.id || 'primary'}`,
        provider: 'google',
        email: primaryCalendar?.id,
        displayName: primaryCalendar?.summary || 'Google Calendar',
        connected: true,
        lastSynced: new Date().toISOString(),
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      };

      // Add to accounts
      this.settings.accounts = this.settings.accounts.filter(a => a.provider !== 'google');
      this.settings.accounts.push(account);
      this.settings.syncEnabled = true;

      if (!this.settings.defaultProvider || this.settings.defaultProvider === 'local') {
        this.settings.defaultProvider = 'google';
      }

      await this.saveSettings();
      return account;
    } catch (error) {
      console.error('Failed to connect Google Calendar:', error);
      return null;
    }
  }

  async getGoogleCalendarEvents(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    try {
      const timeMin = startDate.toISOString();
      const timeMax = endDate.toISOString();

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();

      return (data.items || []).map((event: any) => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        allDay: !!event.start?.date,
        color: event.colorId ? this.googleColorMap[event.colorId] : undefined,
      }));
    } catch (error) {
      console.error('Failed to get Google Calendar events:', error);
      return [];
    }
  }

  private googleColorMap: Record<string, string> = {
    '1': '#7986cb', // Lavender
    '2': '#33b679', // Sage
    '3': '#8e24aa', // Grape
    '4': '#e67c73', // Flamingo
    '5': '#f6bf26', // Banana
    '6': '#f4511e', // Tangerine
    '7': '#039be5', // Peacock
    '8': '#616161', // Graphite
    '9': '#3f51b5', // Blueberry
    '10': '#0b8043', // Basil
    '11': '#d50000', // Tomato
  };

  async createGoogleCalendarEvent(
    accessToken: string,
    title: string,
    startDate: Date,
    endDate: Date,
    options?: {
      description?: string;
      location?: string;
      reminders?: number[]; // minutes before
    }
  ): Promise<string | null> {
    try {
      const event = {
        summary: title,
        description: options?.description,
        location: options?.location,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        reminders: options?.reminders ? {
          useDefault: false,
          overrides: options.reminders.map(minutes => ({
            method: 'popup',
            minutes,
          })),
        } : { useDefault: true },
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create event');
      }

      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Failed to create Google Calendar event:', error);
      return null;
    }
  }

  // ============ UNIFIED INTERFACE ============

  async getEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = [];

    for (const account of this.settings.accounts) {
      if (!account.connected) continue;

      try {
        let events: CalendarEvent[] = [];

        if (account.provider === 'apple') {
          events = await this.getAppleCalendarEvents(startDate, endDate);
        } else if (account.provider === 'google' && account.accessToken) {
          events = await this.getGoogleCalendarEvents(account.accessToken, startDate, endDate);
        }

        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to get events from ${account.provider}:`, error);
      }
    }

    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return allEvents;
  }

  async createEvent(
    title: string,
    startDate: Date,
    endDate: Date,
    options?: {
      description?: string;
      location?: string;
      reminders?: number[];
      provider?: CalendarProvider;
    }
  ): Promise<string | null> {
    const provider = options?.provider || this.settings.defaultProvider;
    const account = this.settings.accounts.find(a => a.provider === provider && a.connected);

    if (provider === 'apple') {
      return this.createAppleCalendarEvent(title, startDate, endDate, {
        notes: options?.description,
        location: options?.location,
        alerts: options?.reminders,
      });
    } else if (provider === 'google' && account?.accessToken) {
      return this.createGoogleCalendarEvent(account.accessToken, title, startDate, endDate, options);
    }

    return null;
  }

  // ============ TIME BLOCKING ============

  async createTimeBlock(
    taskTitle: string,
    duration: number, // minutes
    preferredTime?: Date
  ): Promise<{ eventId: string; startTime: Date; endTime: Date } | null> {
    try {
      // Find available slot
      const slot = await this.findAvailableSlot(duration, preferredTime);
      if (!slot) {
        console.log('No available time slot found');
        return null;
      }

      const eventId = await this.createEvent(
        `🎯 Focus: ${taskTitle}`,
        slot.start,
        slot.end,
        {
          description: `UnFocused time block for: ${taskTitle}`,
          reminders: [5, 0],
        }
      );

      if (!eventId) return null;

      return {
        eventId,
        startTime: slot.start,
        endTime: slot.end,
      };
    } catch (error) {
      console.error('Failed to create time block:', error);
      return null;
    }
  }

  async findAvailableSlot(
    duration: number, // minutes
    preferredTime?: Date
  ): Promise<{ start: Date; end: Date } | null> {
    const now = new Date();
    const searchStart = preferredTime || now;
    const searchEnd = new Date(searchStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const events = await this.getEvents(searchStart, searchEnd);

    // Find gaps between events
    let currentTime = new Date(Math.max(searchStart.getTime(), now.getTime()));

    // Round to next 15 minutes
    currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / 15) * 15);
    currentTime.setSeconds(0, 0);

    for (const event of events) {
      const eventStart = new Date(event.start);
      const gapMinutes = (eventStart.getTime() - currentTime.getTime()) / (1000 * 60);

      if (gapMinutes >= duration) {
        // Found a slot
        return {
          start: currentTime,
          end: new Date(currentTime.getTime() + duration * 60 * 1000),
        };
      }

      // Move past this event
      const eventEnd = new Date(event.end);
      if (eventEnd > currentTime) {
        currentTime = new Date(eventEnd.getTime() + this.settings.travelTimeBuffer * 60 * 1000);
        currentTime.setMinutes(Math.ceil(currentTime.getMinutes() / 15) * 15);
      }
    }

    // No conflicts found, use next available time
    return {
      start: currentTime,
      end: new Date(currentTime.getTime() + duration * 60 * 1000),
    };
  }

  // ============ TRAVEL TIME ALERTS ============

  async getUpcomingEventsWithTravelTime(
    bufferMinutes?: number
  ): Promise<Array<CalendarEvent & { leaveBy: Date }>> {
    const buffer = bufferMinutes ?? this.settings.travelTimeBuffer;
    const now = new Date();
    const nextHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    const events = await this.getEvents(now, nextHours);

    return events
      .filter(event => !event.allDay)
      .map(event => {
        const eventStart = new Date(event.start);
        const leaveBy = new Date(eventStart.getTime() - buffer * 60 * 1000);
        return {
          ...event,
          leaveBy,
        };
      })
      .filter(event => event.leaveBy > now);
  }

  // ============ SETTINGS ============

  async updateSettings(updates: Partial<CalendarSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
  }

  getSettings(): CalendarSettings {
    return { ...this.settings };
  }

  getConnectedAccounts(): CalendarAccount[] {
    return this.settings.accounts.filter(a => a.connected);
  }

  isConnected(provider?: CalendarProvider): boolean {
    if (provider) {
      return this.settings.accounts.some(a => a.provider === provider && a.connected);
    }
    return this.settings.accounts.some(a => a.connected);
  }

  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save calendar settings:', error);
    }
  }
}

// Singleton instance
let serviceInstance: CalendarService | null = null;

export function getCalendarService(): CalendarService {
  if (!serviceInstance) {
    serviceInstance = new CalendarService();
  }
  return serviceInstance;
}

export async function initializeCalendarService(): Promise<CalendarService> {
  const service = getCalendarService();
  await service.initialize();
  return service;
}
