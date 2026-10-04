import { Task, CalendarEvent, LifeArea, ScenarioPreset, AreaNote, PersonalMemory } from '../types';

/**
 * Standard Product Life Areas
 * These provide product structure and empty contexts for the user.
 * They contain NO fake tasks, events, or memories.
 */
export const INITIAL_AREAS: LifeArea[] = [
  {
    id: 'home',
    name: 'Home',
    emoji: '🏠',
    description: 'Household tasks, maintenance, family life, routines',
  },
  {
    id: 'work',
    name: 'Work',
    emoji: '💼',
    description: 'Projects, meetings, career milestones, deliverables',
  },
  {
    id: 'devices',
    name: 'Devices',
    emoji: '💻',
    description: 'Digital organization, subscriptions, backups, hardware',
  },
  {
    id: 'personal',
    name: 'Personal',
    emoji: '🌿',
    description: 'Health, well-being, habits, self-care, reflection',
  },
  {
    id: 'learning',
    name: 'Learning',
    emoji: '📚',
    description: 'Books, courses, language learning, skill development',
  },
  {
    id: 'finance',
    name: 'Finance',
    emoji: '💳',
    description: 'Bills, budget reviews, savings goals, investments',
  },
  {
    id: 'travel',
    name: 'Travel',
    emoji: '✈️',
    description: 'Trips, packing lists, bookings, itineraries',
  },
];

/**
 * Clean Default Application State
 * Every new user starts with a completely empty personal workspace:
 * - 0 tasks
 * - 0 events
 * - 0 notes
 * - 0 memories
 */
export const DEFAULT_AREA_NOTES: AreaNote[] = [];
export const DEFAULT_MEMORIES: PersonalMemory[] = [];
export const DEFAULT_TASKS: Task[] = [];
export const DEFAULT_EVENTS: CalendarEvent[] = [];

/**
 * Known legacy demo and test record IDs created during development/testing.
 * Used exclusively to detect and purge stale demo fixtures from local storage or cloud caches.
 */
export const LEGACY_DEMO_IDS = new Set<string>([
  'task-1',
  'task-2',
  'task-3',
  'task-4',
  'task-5',
  'task-6',
  'task-7',
  'task-8',
  'task-solo',
  'task-rec-1',
  'task-rec-2',
  'task-rec-3',
  'event-1',
  'event-2',
  'event-3',
  'event-4',
  'event-5',
  'event-6',
  'mem-1',
  'mem-2',
  'mem-3',
  'mem-4',
  'note-1',
  'note-2',
  'note-3',
  'note-4',
  'note-5',
]);

const LEGACY_DEMO_TITLES = new Set<string>([
  'finish project proposal',
  'finish project',
  'call the dentist',
  'call doctor',
  'buy groceries',
  'team meeting',
  'pay bill',
  'study',
  'exercise',
  'travel',
  'birthday',
  'sample event',
  'demo event',
  'sample task',
  'dentist appointment',
  'project deadline',
  'lunch',
  'finalize travel itinerary for kyoto trip',
  'review quarterly household budget',
  'backup personal laptop & phone photos',
  'morning strategy & focus',
  'submit assignment',
  'pay electricity bill',
  'forest trail morning walk',
  'kyoto trip travel day',
  'passport document location',
  'project aurora internal codename',
  'home router setup',
  'optimal study cadence',
  'project brief: horizon 2026',
  'team contact sheet',
  'home equipment warranty registry',
  'evening calm protocol',
  'emergency reserve target',
]);

/**
 * Returns true if an item matches developer-created demo/seed fixtures.
 */
export function isDemoRecord(id?: string, title?: string): boolean {
  if (id && LEGACY_DEMO_IDS.has(id)) return true;
  if (title && LEGACY_DEMO_TITLES.has(title.trim().toLowerCase())) return true;
  return false;
}

export function getScenarioData(_preset?: ScenarioPreset): { tasks: Task[]; events: CalendarEvent[] } {
  return {
    tasks: [],
    events: [],
  };
}
