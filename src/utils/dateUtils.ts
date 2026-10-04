/**
 * Utility functions for locale-aware, timezone-friendly date & time operations.
 */

// Reference base date (system current time or user's local date)
export function getNow(): Date {
  return new Date();
}

// Returns YYYY-MM-DD for a given date
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayString(): string {
  return toISODateString(getNow());
}

export function getTomorrowString(): string {
  const d = getNow();
  d.setDate(d.getDate() + 1);
  return toISODateString(d);
}

// Normalizes flexible date strings like 'Today', 'Tomorrow', 'Friday', '2026-09-30'
export function normalizeDate(dateInput?: string): string {
  if (!dateInput) return getTodayString();
  const lower = dateInput.trim().toLowerCase();
  if (lower === 'today') return getTodayString();
  if (lower === 'tomorrow') return getTomorrowString();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  // Parse weekday e.g. 'friday'
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIdx = weekdays.indexOf(lower);
  if (dayIdx !== -1) {
    const d = getNow();
    const currentDay = d.getDay();
    let diff = dayIdx - currentDay;
    if (diff <= 0) diff += 7; // next occurrence
    d.setDate(d.getDate() + diff);
    return toISODateString(d);
  }

  // Attempt Date.parse
  const parsed = new Date(dateInput);
  if (!isNaN(parsed.getTime())) {
    return toISODateString(parsed);
  }

  return dateInput;
}

// Format a date for display according to user's locale
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const normalized = normalizeDate(dateStr);
  const today = getTodayString();
  const tomorrow = getTomorrowString();

  if (normalized === today) return 'Today';
  if (normalized === tomorrow) return 'Tomorrow';

  const parts = normalized.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  return dateStr;
}

// Format full date header: e.g. "Tuesday, September 30, 2026"
export function formatFullDate(dateStr: string): string {
  const normalized = normalizeDate(dateStr);
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    }
  }
  return dateStr;
}

// Parses 12h or 24h string into minutes from midnight (e.g. "04:00 PM" -> 960)
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toLowerCase();
  const match12 = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const isPM = match12[3] === 'pm';
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

// Checks if two events on the same date overlap in time
export function doTimesOverlap(
  startA?: string,
  endA?: string,
  allDayA?: boolean,
  startB?: string,
  endB?: string,
  allDayB?: boolean
): boolean {
  if (allDayA || allDayB) return false; // All-day events don't block discrete time slots
  if (!startA || !startB) return false;
  const minStartA = parseTimeToMinutes(startA);
  const minStartB = parseTimeToMinutes(startB);
  if (minStartA === null || minStartB === null) return false;
  // Assume 45 minutes default duration if end time not provided
  const minEndA = parseTimeToMinutes(endA) ?? minStartA + 45;
  const minEndB = parseTimeToMinutes(endB) ?? minStartB + 45;
  return Math.max(minStartA, minStartB) < Math.min(minEndA, minEndB);
}
