import * as Calendar from 'expo-calendar';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { saveActivity } from './api';
import { startOfDay, endOfDay, format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALENDAR_SYNC_KEY = 'calendar_sync_enabled';
const LAST_SYNC_KEY = 'last_calendar_sync';

export const requestCalendarPermissions = async () => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
};

export const getCalendarSyncEnabled = async () => {
  try {
    const value = await AsyncStorage.getItem(CALENDAR_SYNC_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error reading calendar sync setting:', error);
    return false;
  }
};

export const setCalendarSyncEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(CALENDAR_SYNC_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error saving calendar sync setting:', error);
  }
};

export const getLastSyncTime = async () => {
  try {
    const value = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return value ? new Date(value) : null;
  } catch (error) {
    console.error('Error reading last sync time:', error);
    return null;
  }
};

export const setLastSyncTime = async (date) => {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, date.toISOString());
  } catch (error) {
    console.error('Error saving last sync time:', error);
  }
};

const categorizeTitleWithAI = async (title) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing Gemini API Key");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a calendar event categorizer. Given a calendar event title, determine if it's significant enough to track, and if so, categorize it.

      Categories:
      - Work: meetings, work tasks, professional activities, classes, studying, important appointments
      - Sleep: sleep, nap, rest, bedtime
      - Exercise: gym, workout, run, sports, yoga, fitness, physical activity
      - Socializing: dinner with friends, party, hangout, coffee with someone, social events, dates
      - Discretionary: hobbies, entertainment, personal time, relaxation, meaningful leisure activities
      - SKIP: miscellaneous tasks that don't fit (errands, brushing teeth, quick chores, reminders, trivial events)

      Rules:
      - Only track activities that are meaningful and take significant time
      - Skip routine maintenance tasks, quick errands, personal hygiene, reminders
      - Skip vague or unclear events
      - Work includes professional meetings, classes, and study sessions
      - Socializing must involve other people
      - Discretionary is for intentional leisure/hobbies, not chores

      Event title: "${title}"

      Respond with ONLY one word: either the category name (Work, Sleep, Exercise, Socializing, Discretionary) or "SKIP" if it should not be tracked.
    `;

    const result = await model.generateContent(prompt);
    const category = result.response.text().trim();

    // If AI says to skip, return null
    if (category === 'SKIP') {
      return null;
    }

    // Validate the category
    const validCategories = ['Work', 'Sleep', 'Exercise', 'Socializing', 'Discretionary'];
    if (validCategories.includes(category)) {
      return category;
    }

    // If invalid response, skip it
    return null;
  } catch (error) {
    console.error('Error categorizing with AI:', error);
    return null; // Skip on error
  }
};

export const syncCalendarEvents = async (date = new Date()) => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      throw new Error('Calendar permission not granted');
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (calendars.length === 0) {
      return { success: true, count: 0, message: 'No calendars found' };
    }

    // Filter to only Google calendars (or primary calendar)
    const googleCalendars = calendars.filter(cal => 
      cal.source?.name?.toLowerCase().includes('google') || 
      cal.source?.type?.toLowerCase().includes('google') ||
      cal.isPrimary
    );

    if (googleCalendars.length === 0) {
      return { success: true, count: 0, message: 'No Google Calendar found' };
    }

    const startDate = startOfDay(date);
    const endDate = endOfDay(date);

    const events = await Calendar.getEventsAsync(
      googleCalendars.map(cal => cal.id),
      startDate,
      endDate
    );

    if (events.length === 0) {
      return { success: true, count: 0, message: 'No events found for this day' };
    }

    // Get existing activities to check for duplicates
    const { fetchActivitiesByDate } = await import('./api');
    const existingActivities = await fetchActivitiesByDate(date);
    const existingEventIds = new Set(
      existingActivities
        .filter(act => act.calendarEventId)
        .map(act => act.calendarEventId)
    );

    let syncedCount = 0;
    const errors = [];

    for (const event of events) {
      try {
        // Skip if already synced
        if (existingEventIds.has(event.id)) {
          continue;
        }

        // Skip all-day events or events without proper times
        if (event.allDay || !event.startDate || !event.endDate) {
          continue;
        }

        const startTime = new Date(event.startDate);
        const endTime = new Date(event.endDate);
        const durationHours = (endTime - startTime) / (1000 * 60 * 60);

        // Skip very short events (less than 5 minutes)
        if (durationHours < 0.083) {
          continue;
        }

        // Categorize using AI
        const category = await categorizeTitleWithAI(event.title || 'Untitled Event');

        // Skip if AI determined it's not worth tracking
        if (!category) {
          continue;
        }

        const startTimeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
        const endTimeStr = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;

        const payload = {
          category,
          startTime: startTimeStr,
          endTime: endTimeStr,
          durationHours,
          date: date.toISOString(),
          timestamp: Date.now(),
          calendarEventId: event.id,
          calendarEventTitle: event.title || 'Untitled Event'
        };

        await saveActivity(payload);
        syncedCount++;
      } catch (err) {
        console.error('Error syncing event:', event.title, err);
        errors.push({ event: event.title, error: err.message });
      }
    }

    await setLastSyncTime(new Date());

    return {
      success: true,
      count: syncedCount,
      total: events.length,
      errors: errors.length > 0 ? errors : null,
      message: `Synced ${syncedCount} of ${events.length} events`
    };
  } catch (error) {
    console.error('Calendar sync error:', error);
    return {
      success: false,
      count: 0,
      error: error.message
    };
  }
};
