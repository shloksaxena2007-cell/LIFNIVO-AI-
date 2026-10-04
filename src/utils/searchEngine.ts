import { Task, CalendarEvent, LifeArea, PersonalMemory, SearchResultItem, SearchResultType } from '../types';
import { getTodayString, getTomorrowString, normalizeDate, formatDisplayDate } from './dateUtils';

export interface SearchDatasets {
  tasks: Task[];
  events: CalendarEvent[];
  areas: LifeArea[];
  memories: PersonalMemory[];
}

/**
 * Checks if search input contains highly sensitive credential indicators.
 */
export function detectSensitiveContent(input: string): boolean {
  const lower = input.toLowerCase();
  const sensitiveRegex = /\b(password|passwd|credit card|cvv|cvc|secret key|private key|auth token|ssn|social security)\b/i;
  return sensitiveRegex.test(lower);
}

/**
 * Searches across real user records: Tasks, Events, Areas, and Personal Memory.
 * Returns sorted, deduplicated search results.
 */
export function performGlobalSearch(
  query: string,
  filterType: 'all' | 'tasks' | 'events' | 'areas' | 'memory',
  datasets: SearchDatasets
): SearchResultItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  const todayISO = getTodayString();
  const tomorrowISO = getTomorrowString();
  const results: SearchResultItem[] = [];

  // Helper match checker
  const terms = clean.split(/\s+/).filter(Boolean);
  const matchesText = (target?: string) => {
    if (!target) return false;
    const lowerTarget = target.toLowerCase();
    return terms.some((term) => lowerTarget.includes(term));
  };

  const isExactOrStarts = (target?: string) => {
    if (!target) return false;
    const lowerTarget = target.toLowerCase();
    return lowerTarget.startsWith(clean) || lowerTarget.includes(clean);
  };

  // Date intent helpers
  const wantsToday = clean.includes('today') || clean.includes("today's");
  const wantsTomorrow = clean.includes('tomorrow');
  const wantsRecurring = clean.includes('recurring') || clean.includes('repeat') || clean.includes('every');
  const wantsOverdue = clean.includes('overdue');

  // 1. SEARCH TASKS
  if (filterType === 'all' || filterType === 'tasks') {
    datasets.tasks.forEach((task) => {
      let isMatch = false;

      // Title & notes matching
      if (matchesText(task.title) || matchesText(task.notes) || matchesText(task.area)) {
        isMatch = true;
      }

      // Date intent matching
      if (wantsToday && (task.dueDate === 'Today' || normalizeDate(task.dueDate || '') === todayISO)) {
        isMatch = true;
      }
      if (wantsTomorrow && (task.dueDate === 'Tomorrow' || normalizeDate(task.dueDate || '') === tomorrowISO)) {
        isMatch = true;
      }
      if (wantsRecurring && Boolean(task.isRecurring || task.recurring || task.recurrenceRule)) {
        isMatch = true;
      }
      if (wantsOverdue && !task.completed && task.dueDate && task.dueDate < todayISO && task.dueDate.includes('-')) {
        isMatch = true;
      }

      if (isMatch) {
        results.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.title,
          snippet: task.notes || (task.completed ? 'Completed' : task.priority ? `${task.priority.toUpperCase()} priority` : undefined),
          area: task.area,
          date: task.dueDate,
          time: task.time,
          isRecurring: Boolean(task.isRecurring || task.recurring),
          recurringLabel: task.recurring,
          rawItem: task,
        });
      }
    });
  }

  // 2. SEARCH CALENDAR EVENTS
  if (filterType === 'all' || filterType === 'events') {
    datasets.events.forEach((evt) => {
      let isMatch = false;

      if (
        matchesText(evt.title) ||
        matchesText(evt.notes) ||
        matchesText(evt.location) ||
        matchesText(evt.area)
      ) {
        isMatch = true;
      }

      if (wantsToday && (evt.date === 'Today' || normalizeDate(evt.date) === todayISO)) {
        isMatch = true;
      }
      if (wantsTomorrow && (evt.date === 'Tomorrow' || normalizeDate(evt.date) === tomorrowISO)) {
        isMatch = true;
      }
      if (wantsRecurring && Boolean(evt.isRecurring || evt.recurring || evt.recurrenceRule)) {
        isMatch = true;
      }

      if (isMatch) {
        results.push({
          id: `event-${evt.id}`,
          type: 'event',
          title: evt.title,
          snippet: evt.location || evt.notes || (evt.isAllDay ? 'All day event' : undefined),
          area: evt.area,
          date: formatDisplayDate(evt.date),
          time: evt.time || evt.startTime,
          isRecurring: Boolean(evt.isRecurring || evt.recurring),
          recurringLabel: evt.recurring,
          rawItem: evt,
        });
      }
    });
  }

  // 3. SEARCH AREAS
  if (filterType === 'all' || filterType === 'areas') {
    datasets.areas.forEach((area) => {
      if (
        !area.hidden &&
        (matchesText(area.name) || matchesText(area.description) || clean.includes('area') || clean.includes('areas'))
      ) {
        results.push({
          id: `area-${area.id}`,
          type: 'area',
          title: `${area.emoji} ${area.name}`,
          snippet: area.description || 'Life Area context',
          area: area.name,
          rawItem: area,
        });
      }
    });
  }

  // 4. SEARCH PERSONAL MEMORY
  if (filterType === 'all' || filterType === 'memory') {
    datasets.memories.forEach((mem) => {
      let isMatch = false;

      if (
        matchesText(mem.title) ||
        matchesText(mem.content) ||
        matchesText(mem.area) ||
        (mem.tags && mem.tags.some((tag) => matchesText(tag)))
      ) {
        isMatch = true;
      }

      if (clean.includes('memory') || clean.includes('saved') || clean.includes('remember')) {
        isMatch = true;
      }

      if (isMatch) {
        results.push({
          id: `mem-${mem.id}`,
          type: 'memory',
          title: mem.title,
          snippet: mem.content,
          area: mem.area,
          date: mem.updatedAt ? `Saved ${mem.updatedAt}` : undefined,
          rawItem: mem,
        });
      }
    });
  }

  // Sort results by title relevance
  return results.sort((a, b) => {
    const aExact = isExactOrStarts(a.title) ? 1 : 0;
    const bExact = isExactOrStarts(b.title) ? 1 : 0;
    return bExact - aExact;
  });
}
