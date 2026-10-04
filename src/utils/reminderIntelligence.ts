import { Task, CalendarEvent, PersonalMemory } from '../types';
import {
  getTodayString,
  getTomorrowString,
  normalizeDate,
  formatDisplayDate,
  parseTimeToMinutes,
  getNow,
} from './dateUtils';
import { isEventOccurringOnDate, formatRecurrenceLabel } from './recurringUtils';

export interface SmartReminderItem {
  id: string;
  kind: 'overdue' | 'due_soon' | 'event_soon' | 'related_task' | 'recurring_due' | 'important_date';
  title: string;
  subtitle: string;
  urgency: 'high' | 'medium' | 'calm';
  taskId?: string;
  eventId?: string;
  area?: string;
  dueDate?: string;
  time?: string;
}

export interface TaskEventRelationship {
  event: CalendarEvent;
  relatedTasks: Task[];
  reason: string;
}

export interface LifeSnapshotData {
  tasksRemainingToday: number;
  tasksCompletedToday: number;
  overdueTasksCount: number;
  overdueTasks: Task[];
  todayEventsCount: number;
  nextEventToday?: CalendarEvent;
  upcomingImportantEvents: CalendarEvent[];
  activeRecurringCount: number;
  dueTodayRecurringCount: number;
  recentActivityLabel: string | null;
}

export interface WeeklyReviewData {
  completedTasks: Task[];
  unfinishedTasks: Task[];
  overdueTasks: Task[];
  upcomingCommitments: Array<{
    event: CalendarEvent;
    displayDate: string;
    isoDate: string;
  }>;
  recurringItems: Array<{
    id: string;
    title: string;
    type: 'task' | 'event';
    schedule: string;
    area: string;
    completedToday: boolean;
  }>;
  itemsNeedingReschedule: Task[];
  aiObservation: string;
}

/**
 * Checks whether a task is overdue relative to today's ISO date.
 */
export function isTaskOverdue(task: Task, todayISO = getTodayString()): boolean {
  if (task.completed || !task.dueDate) return false;
  const lower = task.dueDate.trim().toLowerCase();
  if (lower === 'today' || lower === 'tomorrow' || lower === 'next week' || lower === 'next month') {
    return false;
  }
  const normalized = normalizeDate(task.dueDate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized < todayISO;
  }
  return false;
}

/**
 * Checks whether a task is scheduled for today.
 */
export function isTaskDueToday(task: Task, todayISO = getTodayString()): boolean {
  if (!task.dueDate) return true;
  const lower = task.dueDate.trim().toLowerCase();
  if (lower === 'today') return true;
  const normalized = normalizeDate(task.dueDate);
  return normalized === todayISO;
}

/**
 * Checks whether a task is scheduled for a specific ISO date (including recurring tasks).
 */
export function isTaskOnDate(task: Task, targetISO: string, todayISO = getTodayString()): boolean {
  if (!task.dueDate) {
    return targetISO === todayISO;
  }
  const normalized = normalizeDate(task.dueDate);
  if (normalized === targetISO) return true;

  if (!task.completed && (task.isRecurring || task.recurrenceRule)) {
    return isEventOccurringOnDate(normalized, targetISO, task.recurrenceRule, task.skippedDates);
  }
  return false;
}

/**
 * Finds relationships between Calendar Events and Tasks without duplicating records.
 * Matches based on shared keywords, explicit notes ("Before Dentist"), or same-day + same-area context.
 */
export function findRelatedTasksForEvent(
  event: CalendarEvent,
  tasks: Task[],
  eventDateISO?: string
): Task[] {
  const targetISO = eventDateISO || normalizeDate(event.date);
  const eventWords = event.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !['the', 'and', 'for', 'with', 'meeting', 'call', 'appointment'].includes(w));

  return tasks.filter((task) => {
    if (task.completed) return false;
    const taskNormDate = task.dueDate ? normalizeDate(task.dueDate) : getTodayString();
    const taskText = `${task.title} ${task.notes || ''}`.toLowerCase();

    // 1. Explicit reference in notes or title to the event title
    if (event.title.length >= 3 && taskText.includes(event.title.toLowerCase())) {
      return true;
    }

    // 2. Shared meaningful keyword between event title and task title/notes
    if (eventWords.some((word) => taskText.includes(word))) {
      return true;
    }

    // 3. Same date and same life area (when scheduled on the same day)
    if (
      taskNormDate === targetISO &&
      event.area &&
      task.area &&
      event.area.toLowerCase() === task.area.toLowerCase() &&
      taskText.includes('before')
    ) {
      return true;
    }

    return false;
  });
}

/**
 * Generates non-spammy, grounded Smart Reminders strictly from the user's real tasks and events.
 */
export function getSmartReminders(
  tasks: Task[],
  events: CalendarEvent[],
  dismissedIds: string[] = []
): SmartReminderItem[] {
  const todayISO = getTodayString();
  const tomorrowISO = getTomorrowString();
  const now = getNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reminders: SmartReminderItem[] = [];
  const dismissedSet = new Set(dismissedIds);

  // 1. Overdue tasks
  const overdueTasks = tasks.filter((t) => isTaskOverdue(t, todayISO));
  overdueTasks.slice(0, 3).forEach((task) => {
    const remId = `rem-overdue-${task.id}`;
    if (dismissedSet.has(remId)) return;
    reminders.push({
      id: remId,
      kind: 'overdue',
      title: task.title,
      subtitle: `Overdue (${formatDisplayDate(task.dueDate || '')}) • ${task.area}`,
      urgency: task.priority === 'high' ? 'high' : 'medium',
      taskId: task.id,
      area: task.area,
      dueDate: task.dueDate,
      time: task.time,
    });
  });

  // 2. Tasks approaching their due time today
  const todayActiveTasks = tasks.filter((t) => !t.completed && isTaskDueToday(t, todayISO));
  todayActiveTasks.forEach((task) => {
    if (!task.time) return;
    const taskMins = parseTimeToMinutes(task.time);
    if (taskMins === null) return;
    const diff = taskMins - currentMinutes;
    const remId = `rem-due-soon-${task.id}`;
    if (dismissedSet.has(remId)) return;

    if (diff >= -30 && diff <= 120) {
      reminders.push({
        id: remId,
        kind: 'due_soon',
        title: task.title,
        subtitle:
          diff < 0
            ? `Scheduled for ${task.time} (${Math.abs(diff)}m ago)`
            : diff === 0
            ? `Due right now (${task.time})`
            : `Due in ${diff} min (${task.time})`,
        urgency: 'high',
        taskId: task.id,
        area: task.area,
        dueDate: 'Today',
        time: task.time,
      });
    }
  });

  // 3. Calendar events approaching today + related tasks
  const todayEvents = events.filter((e) =>
    isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates)
  );
  todayEvents.forEach((evt) => {
    const related = findRelatedTasksForEvent(evt, tasks, todayISO);
    const evtMins = parseTimeToMinutes(evt.startTime || evt.time);

    if (related.length > 0) {
      related.forEach((relTask) => {
        const remId = `rem-rel-${evt.id}-${relTask.id}`;
        if (dismissedSet.has(remId)) return;
        reminders.push({
          id: remId,
          kind: 'related_task',
          title: relTask.title,
          subtitle: `Related to today's event: "${evt.title}" (${evt.time || evt.startTime || 'Today'})`,
          urgency: 'high',
          taskId: relTask.id,
          eventId: evt.id,
          area: relTask.area,
          dueDate: relTask.dueDate,
        });
      });
    } else if (evtMins !== null) {
      const diff = evtMins - currentMinutes;
      const remId = `rem-evt-${evt.id}`;
      if (!dismissedSet.has(remId) && diff >= 0 && diff <= 120) {
        reminders.push({
          id: remId,
          kind: 'event_soon',
          title: evt.title,
          subtitle: `Upcoming event in ${diff} min (${evt.startTime || evt.time})`,
          urgency: 'medium',
          eventId: evt.id,
          area: evt.area,
          time: evt.startTime || evt.time,
        });
      }
    }
  });

  // 4. High-priority tasks due tomorrow or important all-day dates tomorrow
  const tomorrowHighTasks = tasks.filter(
    (t) =>
      !t.completed &&
      t.priority === 'high' &&
      t.dueDate &&
      normalizeDate(t.dueDate) === tomorrowISO
  );
  tomorrowHighTasks.slice(0, 1).forEach((t) => {
    const remId = `rem-tmw-${t.id}`;
    if (!dismissedSet.has(remId) && reminders.length < 4) {
      reminders.push({
        id: remId,
        kind: 'important_date',
        title: t.title,
        subtitle: `High-priority deadline tomorrow${t.time ? ` at ${t.time}` : ''}`,
        urgency: 'calm',
        taskId: t.id,
        area: t.area,
        dueDate: 'Tomorrow',
      });
    }
  });

  // Deduplicate by taskId/eventId so we never clutter the UI
  const seenKeys = new Set<string>();
  return reminders.filter((item) => {
    const key = item.taskId ? `t-${item.taskId}` : item.eventId ? `e-${item.eventId}` : item.id;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  }).slice(0, 4);
}

/**
 * Computes the compact Life Snapshot for TodayView strictly from real user records.
 */
export function computeLifeSnapshot(
  tasks: Task[],
  events: CalendarEvent[],
  memories: PersonalMemory[] = []
): LifeSnapshotData {
  const todayISO = getTodayString();
  const now = getNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const activeToday = tasks.filter(
    (t) => !t.completed && (isTaskDueToday(t, todayISO) || t.isFocus)
  );
  const completedToday = tasks.filter((t) => {
    if (!t.completed) return false;
    if (t.completedAt && t.completedAt.startsWith(todayISO)) return true;
    return isTaskDueToday(t, todayISO);
  });

  const overdueTasks = tasks.filter((t) => isTaskOverdue(t, todayISO));

  const todayEvents = events
    .filter((e) => isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates))
    .sort((a, b) => {
      const mA = parseTimeToMinutes(a.startTime || a.time) ?? 9999;
      const mB = parseTimeToMinutes(b.startTime || b.time) ?? 9999;
      return mA - mB;
    });

  const nextEventToday =
    todayEvents.find((e) => {
      if (e.isAllDay) return false;
      const mins = parseTimeToMinutes(e.startTime || e.time);
      return mins === null || mins >= currentMinutes - 15;
    }) || todayEvents[0];

  // Upcoming important dates in the next 7 days (excluding today)
  const upcomingImportantEvents: CalendarEvent[] = [];
  for (let offset = 1; offset <= 7; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayEvts = events.filter((e) =>
      isEventOccurringOnDate(e.date, iso, e.recurrenceRule, e.skippedDates)
    );
    dayEvts.forEach((e) => {
      if (upcomingImportantEvents.length < 3) {
        upcomingImportantEvents.push({ ...e, date: iso });
      }
    });
  }

  const activeRecurringTasks = tasks.filter(
    (t) => !t.completed && Boolean(t.isRecurring || t.recurrenceRule || t.recurring)
  );
  const activeRecurringEvents = events.filter((e) =>
    Boolean(e.isRecurring || e.recurrenceRule || e.recurring)
  );
  const dueTodayRecurringCount = activeRecurringTasks.filter((t) =>
    isTaskDueToday(t, todayISO)
  ).length;

  let recentActivityLabel: string | null = null;
  if (completedToday.length > 0) {
    recentActivityLabel = `Completed "${completedToday[0].title}"`;
  } else if (memories.length > 0) {
    recentActivityLabel = `Saved "${memories[0].title}" in Memory`;
  } else if (activeToday.length > 0) {
    recentActivityLabel = `Working on "${activeToday[0].title}"`;
  }

  return {
    tasksRemainingToday: activeToday.length,
    tasksCompletedToday: completedToday.length,
    overdueTasksCount: overdueTasks.length,
    overdueTasks,
    todayEventsCount: todayEvents.length,
    nextEventToday,
    upcomingImportantEvents,
    activeRecurringCount: activeRecurringTasks.length + activeRecurringEvents.length,
    dueTodayRecurringCount,
    recentActivityLabel,
  };
}

/**
 * Computes Weekly Life Review data strictly from real user records.
 */
export function computeWeeklyReview(
  tasks: Task[],
  events: CalendarEvent[]
): WeeklyReviewData {
  const todayISO = getTodayString();
  const now = getNow();

  const completedTasks = tasks.filter((t) => t.completed);
  const unfinishedTasks = tasks.filter((t) => !t.completed);
  const overdueTasks = unfinishedTasks.filter((t) => isTaskOverdue(t, todayISO));

  // Items that may need rescheduling: overdue tasks + unfinished tasks due today with low/medium priority when workload > 3
  const todayPending = unfinishedTasks.filter((t) => isTaskDueToday(t, todayISO));
  const itemsNeedingReschedule = [
    ...overdueTasks,
    ...(todayPending.length > 3 ? todayPending.filter((t) => !t.isFocus && t.priority !== 'high') : []),
  ];

  // Upcoming commitments over the next 7 days
  const upcomingCommitments: Array<{
    event: CalendarEvent;
    displayDate: string;
    isoDate: string;
  }> = [];

  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayEvts = events.filter((e) =>
      isEventOccurringOnDate(e.date, iso, e.recurrenceRule, e.skippedDates)
    );
    dayEvts.forEach((evt) => {
      upcomingCommitments.push({
        event: evt,
        displayDate: formatDisplayDate(iso),
        isoDate: iso,
      });
    });
  }

  // Recurring responsibilities
  const recurringItems: WeeklyReviewData['recurringItems'] = [
    ...tasks
      .filter((t) => !t.completed && Boolean(t.isRecurring || t.recurrenceRule || t.recurring))
      .map((t) => ({
        id: t.id,
        title: t.title,
        type: 'task' as const,
        schedule:
          t.recurring ||
          (t.recurrenceRule ? formatRecurrenceLabel(t.recurrenceRule) : 'Recurring'),
        area: t.area || 'Personal',
        completedToday: false,
      })),
    ...events
      .filter((e) => Boolean(e.isRecurring || e.recurrenceRule || e.recurring))
      .map((e) => ({
        id: e.id,
        title: e.title,
        type: 'event' as const,
        schedule:
          e.recurring ||
          (e.recurrenceRule ? formatRecurrenceLabel(e.recurrenceRule) : 'Recurring'),
        area: e.area || 'Personal',
        completedToday: false,
      })),
  ];

  // Grounded AI Observation
  let aiObservation = '';
  if (tasks.length === 0 && events.length === 0) {
    aiObservation =
      'Your workspace is clear. As you add tasks, calendar commitments, and routines, your weekly review will summarize your progress here.';
  } else {
    const parts: string[] = [];
    parts.push(
      `You have completed ${completedTasks.length} task${completedTasks.length === 1 ? '' : 's'} so far.`
    );
    if (unfinishedTasks.length > 0) {
      const highUnfinished = unfinishedTasks.filter((t) => t.priority === 'high' || t.isFocus);
      let unfinishedSentence = `You still have ${unfinishedTasks.length} unfinished item${
        unfinishedTasks.length === 1 ? '' : 's'
      }`;
      if (highUnfinished.length > 0) {
        unfinishedSentence += `, including "${highUnfinished[0].title}"`;
      }
      if (overdueTasks.length > 0) {
        unfinishedSentence += ` (${overdueTasks.length} overdue that may need rescheduling)`;
      }
      parts.push(unfinishedSentence + '.');
    } else {
      parts.push('All of your current tasks are finished.');
    }

    if (upcomingCommitments.length > 0) {
      parts.push(
        `Looking ahead, you have ${upcomingCommitments.length} calendar commitment${
          upcomingCommitments.length === 1 ? '' : 's'
        } over the next 7 days.`
      );
    }
    aiObservation = parts.join(' ');
  }

  return {
    completedTasks,
    unfinishedTasks,
    overdueTasks,
    upcomingCommitments: upcomingCommitments.slice(0, 8),
    recurringItems,
    itemsNeedingReschedule,
    aiObservation,
  };
}
