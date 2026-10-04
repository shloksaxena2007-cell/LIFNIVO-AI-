import { RecurrenceRule } from '../types';
import { normalizeDate, toISODateString } from './dateUtils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates the next occurrence date (as YYYY-MM-DD) based on current date and rule.
 * Handles month-end clamping (e.g., 31st on 30-day/28-day months) and leap years.
 */
export function calculateNextOccurrence(
  currentDateStr: string,
  rule?: RecurrenceRule
): string | null {
  if (!rule) return null;

  const normalized = normalizeDate(currentDateStr);
  const parts = normalized.split('-');
  if (parts.length !== 3) return null;

  const currentYear = Number(parts[0]);
  const currentMonth = Number(parts[1]) - 1; // 0-indexed
  const currentDay = Number(parts[2]);

  const baseDate = new Date(currentYear, currentMonth, currentDay);
  let nextDate: Date;

  switch (rule.frequency) {
    case 'daily': {
      const interval = rule.interval || 1;
      nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    }
    case 'weekly': {
      const interval = rule.interval || 1;
      const daysOfWeek = rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [baseDate.getDay()];
      const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
      const currentDayOfWeek = baseDate.getDay();

      // Find if there is a later day in the same week
      const nextDayInSameWeek = sortedDays.find((d) => d > currentDayOfWeek);

      if (nextDayInSameWeek !== undefined) {
        const diff = nextDayInSameWeek - currentDayOfWeek;
        nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + diff);
      } else {
        // Jump to the first day of next cycle (interval weeks ahead)
        const firstDayNextCycle = sortedDays[0];
        const daysToNextCycleStart = (7 - currentDayOfWeek) + (interval - 1) * 7 + firstDayNextCycle;
        nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + daysToNextCycleStart);
      }
      break;
    }
    case 'monthly': {
      const interval = rule.interval || 1;
      const targetMonth = currentMonth + interval;
      const targetYear = currentYear + Math.floor(targetMonth / 12);
      const normalizedMonth = ((targetMonth % 12) + 12) % 12;

      // Find max days in the target month (e.g. 28/29 in Feb, 30 in Apr)
      const maxDaysInTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      const clampedDay = Math.min(currentDay, maxDaysInTargetMonth);
      nextDate = new Date(targetYear, normalizedMonth, clampedDay);
      break;
    }
    case 'yearly': {
      const interval = rule.interval || 1;
      const targetYear = currentYear + interval;
      // Leap year check: Feb 29 on non-leap years clamps to Feb 28
      const maxDaysInMonth = new Date(targetYear, currentMonth + 1, 0).getDate();
      const clampedDay = Math.min(currentDay, maxDaysInMonth);
      nextDate = new Date(targetYear, currentMonth, clampedDay);
      break;
    }
    case 'custom': {
      const interval = rule.interval || 1;
      const unit = rule.unit || 'weeks';
      nextDate = new Date(baseDate);
      if (unit === 'days') {
        nextDate.setDate(nextDate.getDate() + interval);
      } else if (unit === 'weeks') {
        nextDate.setDate(nextDate.getDate() + interval * 7);
      } else if (unit === 'months') {
        const targetMonth = currentMonth + interval;
        const targetYear = currentYear + Math.floor(targetMonth / 12);
        const normalizedMonth = ((targetMonth % 12) + 12) % 12;
        const maxDays = new Date(targetYear, normalizedMonth + 1, 0).getDate();
        nextDate = new Date(targetYear, normalizedMonth, Math.min(currentDay, maxDays));
      } else if (unit === 'years') {
        const targetYear = currentYear + interval;
        const maxDays = new Date(targetYear, currentMonth + 1, 0).getDate();
        nextDate = new Date(targetYear, currentMonth, Math.min(currentDay, maxDays));
      }
      break;
    }
    default:
      return null;
  }

  const nextIso = toISODateString(nextDate);

  // Check end date if set
  if (rule.endType === 'on_date' && rule.endDate) {
    if (nextIso > rule.endDate) {
      return null; // Series has reached its end date
    }
  }

  return nextIso;
}

/**
 * Returns a clean, human-friendly label for a recurrence rule.
 */
export function formatRecurrenceLabel(rule: RecurrenceRule): string {
  if (rule.label) return rule.label;

  switch (rule.frequency) {
    case 'daily':
      return rule.interval && rule.interval > 1 ? `Every ${rule.interval} days` : 'Every day';
    case 'weekly': {
      const interval = rule.interval || 1;
      const days = rule.daysOfWeek;
      if (days && days.length > 0) {
        if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) {
          return 'Every weekday';
        }
        if (days.length === 7) {
          return 'Every day';
        }
        if (days.length === 1) {
          return `Every ${FULL_DAY_NAMES[days[0]]}`;
        }
        const names = days.map((d) => DAY_NAMES[d]).join(', ');
        return interval > 1 ? `Every ${interval} weeks on ${names}` : `Every ${names}`;
      }
      return interval > 1 ? `Every ${interval} weeks` : 'Every week';
    }
    case 'monthly':
      return rule.interval && rule.interval > 1 ? `Every ${rule.interval} months` : 'Every month';
    case 'yearly':
      return rule.interval && rule.interval > 1 ? `Every ${rule.interval} years` : 'Every year';
    case 'custom': {
      const count = rule.interval || 1;
      const unit = rule.unit || 'weeks';
      return `Every ${count} ${unit}`;
    }
    default:
      return 'Repeat';
  }
}

/**
 * Extracts natural recurrence patterns from input string.
 */
export function extractRecurrencePattern(text: string): {
  rule?: RecurrenceRule;
  cleanText: string;
} {
  let cleanText = text;
  const lower = text.toLowerCase();

  // Every weekday
  if (/\bevery weekday\b|\bweekdays\b/i.test(lower)) {
    return {
      rule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
        label: 'Every weekday',
      },
      cleanText: cleanText.replace(/\bevery weekday\b|\bweekdays\b/gi, '').trim(),
    };
  }

  // Every Monday and Friday
  if (/\bevery monday and friday\b|\bevery mon and fri\b/i.test(lower)) {
    return {
      rule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 5],
        label: 'Every Mon, Fri',
      },
      cleanText: cleanText.replace(/\bevery monday and friday\b|\bevery mon and fri\b/gi, '').trim(),
    };
  }

  // Specific single weekday e.g. "every monday", "every friday"
  const weekdayMatches = [
    { name: 'sunday', idx: 0 },
    { name: 'monday', idx: 1 },
    { name: 'tuesday', idx: 2 },
    { name: 'wednesday', idx: 3 },
    { name: 'thursday', idx: 4 },
    { name: 'friday', idx: 5 },
    { name: 'saturday', idx: 6 },
  ];

  for (const { name, idx } of weekdayMatches) {
    const regex = new RegExp(`\\bevery ${name}\\b`, 'i');
    if (regex.test(lower)) {
      return {
        rule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [idx],
          label: `Every ${FULL_DAY_NAMES[idx]}`,
        },
        cleanText: cleanText.replace(regex, '').trim(),
      };
    }
  }

  // Custom intervals: "every 2 days", "every 2 weeks", "every 3 months", "every 6 months"
  const customMatch = lower.match(/\bevery\s+(\d+)\s+(days?|weeks?|months?|years?)\b/i);
  if (customMatch) {
    const interval = parseInt(customMatch[1], 10);
    const rawUnit = customMatch[2].toLowerCase();
    const unit: 'days' | 'weeks' | 'months' | 'years' = rawUnit.startsWith('day')
      ? 'days'
      : rawUnit.startsWith('week')
      ? 'weeks'
      : rawUnit.startsWith('month')
      ? 'months'
      : 'years';

    return {
      rule: {
        frequency: 'custom',
        interval,
        unit,
        label: `Every ${interval} ${unit}`,
      },
      cleanText: cleanText.replace(customMatch[0], '').trim(),
    };
  }

  // Every day / daily
  if (/\bevery day\b|\bdaily\b/i.test(lower)) {
    return {
      rule: { frequency: 'daily', interval: 1, label: 'Every day' },
      cleanText: cleanText.replace(/\bevery day\b|\bdaily\b/gi, '').trim(),
    };
  }

  // Every week / weekly
  if (/\bevery week\b|\bweekly\b/i.test(lower)) {
    return {
      rule: { frequency: 'weekly', interval: 1, label: 'Every week' },
      cleanText: cleanText.replace(/\bevery week\b|\bweekly\b/gi, '').trim(),
    };
  }

  // Every month / monthly
  if (/\bevery month\b|\bmonthly\b/i.test(lower)) {
    return {
      rule: { frequency: 'monthly', interval: 1, label: 'Every month' },
      cleanText: cleanText.replace(/\bevery month\b|\bmonthly\b/gi, '').trim(),
    };
  }

  // Every year / yearly / annually
  if (/\bevery year\b|\byearly\b|\bannually\b/i.test(lower)) {
    return {
      rule: { frequency: 'yearly', interval: 1, label: 'Every year' },
      cleanText: cleanText.replace(/\bevery year\b|\byearly\b|\bannually\b/gi, '').trim(),
    };
  }

  return { cleanText };
}

/**
 * Checks if a calendar event occurs on a target date (YYYY-MM-DD),
 * taking into account one-time vs recurring schedules and skipped dates.
 */
export function isEventOccurringOnDate(
  eventDateStr: string,
  targetDateStr: string,
  rule?: RecurrenceRule,
  skippedDates?: string[]
): boolean {
  const normEventDate = normalizeDate(eventDateStr);
  const normTarget = normalizeDate(targetDateStr);

  if (skippedDates && skippedDates.includes(normTarget)) {
    return false;
  }

  // Direct match
  if (normEventDate === normTarget) {
    return true;
  }

  // If not recurring, only occurs on its base date
  if (!rule) {
    return false;
  }

  // If target date is before event start date, it cannot occur
  if (normTarget < normEventDate) {
    return false;
  }

  // If past end date
  if (rule.endType === 'on_date' && rule.endDate && normTarget > rule.endDate) {
    return false;
  }

  const pEvent = normEventDate.split('-').map(Number);
  const pTarget = normTarget.split('-').map(Number);
  const dEvent = new Date(pEvent[0], pEvent[1] - 1, pEvent[2]);
  const dTarget = new Date(pTarget[0], pTarget[1] - 1, pTarget[2]);

  switch (rule.frequency) {
    case 'daily': {
      const interval = rule.interval || 1;
      const diffTime = dTarget.getTime() - dEvent.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      return diffDays >= 0 && diffDays % interval === 0;
    }
    case 'weekly': {
      const interval = rule.interval || 1;
      const targetDayOfWeek = dTarget.getDay();
      const daysOfWeek =
        rule.daysOfWeek && rule.daysOfWeek.length > 0
          ? rule.daysOfWeek
          : [dEvent.getDay()];

      if (!daysOfWeek.includes(targetDayOfWeek)) {
        return false;
      }

      const diffTime = dTarget.getTime() - dEvent.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks >= 0 && diffWeeks % interval === 0;
    }
    case 'monthly': {
      const interval = rule.interval || 1;
      const monthDiff = (pTarget[0] - pEvent[0]) * 12 + (pTarget[1] - pEvent[1]);
      if (monthDiff < 0 || monthDiff % interval !== 0) {
        return false;
      }
      // Check day of month or clamped end-of-month
      const maxDaysInTargetMonth = new Date(pTarget[0], pTarget[1], 0).getDate();
      const expectedDay = Math.min(pEvent[2], maxDaysInTargetMonth);
      return pTarget[2] === expectedDay;
    }
    case 'yearly': {
      const interval = rule.interval || 1;
      const yearDiff = pTarget[0] - pEvent[0];
      if (yearDiff < 0 || yearDiff % interval !== 0) {
        return false;
      }
      if (pTarget[1] !== pEvent[1]) return false;
      const maxDaysInTargetMonth = new Date(pTarget[0], pTarget[1], 0).getDate();
      const expectedDay = Math.min(pEvent[2], maxDaysInTargetMonth);
      return pTarget[2] === expectedDay;
    }
    default:
      return false;
  }
}
