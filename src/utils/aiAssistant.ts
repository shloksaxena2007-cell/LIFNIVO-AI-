import { Task, CalendarEvent, LifeArea, PersonalMemory } from '../types';
import {
  getTodayString,
  getTomorrowString,
  normalizeDate,
  formatDisplayDate,
  formatFullDate,
  parseTimeToMinutes,
  getNow,
} from './dateUtils';
import {
  parseNaturalLanguageTask,
  parseNaturalLanguageEvent,
  parseMagicCapture,
  MagicCaptureItem,
} from './naturalLanguageParser';
import { isEventOccurringOnDate, formatRecurrenceLabel } from './recurringUtils';
import { detectSensitiveContent } from './searchEngine';
import {
  isTaskOverdue,
  isTaskDueToday,
  findRelatedTasksForEvent,
  computeWeeklyReview,
} from './reminderIntelligence';

export interface NextActionRecommendation {
  id: string;
  task: Task;
  headline: string;
  reason: string;
  relatedEvent?: CalendarEvent;
  badge?: string;
}

export interface AiActionResult {
  type:
    | 'task_created'
    | 'task_completed'
    | 'task_rescheduled'
    | 'task_priority_updated'
    | 'task_deleted'
    | 'event_created'
    | 'event_rescheduled'
    | 'event_deleted'
    | 'memory_saved'
    | 'memory_retrieved'
    | 'multi_created'
    | 'day_plan'
    | 'focus_advice'
    | 'weekly_overview'
    | 'area_summary'
    | 'organize_suggestion'
    | 'clarification'
    | 'confirmation_required'
    | 'general_reply';
  message: string;
  createdTask?: Task;
  createdEvent?: CalendarEvent;
  createdMemory?: PersonalMemory;
  createdMultiple?: {
    tasks: Array<Omit<Task, 'id' | 'completed'>>;
    events: Array<Omit<CalendarEvent, 'id'>>;
    memories: Array<Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>>;
  };
  affectedTask?: Task;
  affectedEvent?: CalendarEvent;
  retrievedMemory?: PersonalMemory;
  pendingConfirmation?: {
    action: 'delete_completed_tasks' | 'reschedule_overdue' | 'magic_capture';
    prompt: string;
    payload?: any;
  };
}

export interface AssistantContext {
  lastTaskId?: string;
  lastEventId?: string;
  lastMemoryId?: string;
  lastAction?: string;
}

/**
 * IMPROVEMENT 1 — AI DAILY BRIEF
 * Generates a compact, grounded personal briefing using ONLY the user's real data.
 */
export function generateDailyBrief(
  tasks: Task[],
  events: CalendarEvent[],
  memories: PersonalMemory[] = [],
  greeting: string = 'Good morning',
  variantIndex: number = 0
): {
  brief: string;
  isClearDay: boolean;
  topFocusTask?: Task;
  nextEvent?: CalendarEvent;
  relevantMemory?: PersonalMemory;
} {
  const todayISO = getTodayString();
  const tomorrowISO = getTomorrowString();
  const now = getNow();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const activeTasks = tasks.filter((t) => !t.completed);
  const todayTasks = activeTasks.filter((t) => isTaskDueToday(t, todayISO) || t.isFocus);
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, todayISO));
  const todayEvents = events
    .filter((e) => isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates))
    .sort((a, b) => {
      const mA = parseTimeToMinutes(a.startTime || a.time) ?? 9999;
      const mB = parseTimeToMinutes(b.startTime || b.time) ?? 9999;
      return mA - mB;
    });

  const tomorrowEvents = events.filter((e) =>
    isEventOccurringOnDate(e.date, tomorrowISO, e.recurrenceRule, e.skippedDates)
  );

  const recurringToday = todayTasks.filter((t) =>
    Boolean(t.isRecurring || t.recurrenceRule || t.recurring)
  );

  // If user has no active tasks and no today/tomorrow events
  if (activeTasks.length === 0 && todayEvents.length === 0 && tomorrowEvents.length === 0) {
    return {
      brief: "Your day is clear. Add something you're working on and I'll help organize it.",
      isClearDay: true,
    };
  }

  // Pick top focus candidate strictly from real tasks
  const highPriorityToday = todayTasks.filter((t) => t.isFocus || t.priority === 'high');
  const topFocusTask =
    highPriorityToday[0] ||
    overdueTasks.find((t) => t.priority === 'high') ||
    todayTasks[0] ||
    overdueTasks[0] ||
    activeTasks[0];

  const nextEvent =
    todayEvents.find((e) => {
      if (e.isAllDay) return true;
      const m = parseTimeToMinutes(e.startTime || e.time);
      return m === null || m >= currentMins - 15;
    }) || todayEvents[0];

  // Check if a Personal Memory is genuinely relevant to today's top focus or next event
  let relevantMemory: PersonalMemory | undefined;
  if (memories.length > 0 && (topFocusTask || nextEvent)) {
    const contextText = `${topFocusTask?.title || ''} ${nextEvent?.title || ''}`.toLowerCase();
    const contextWords = contextText.split(/\s+/).filter((w) => w.length >= 4);
    relevantMemory = memories.find((m) => {
      const memText = `${m.title} ${m.content}`.toLowerCase();
      return contextWords.some((w) => memText.includes(w));
    });
  }

  // Build compact 2-3 sentence briefing
  const summaryParts: string[] = [];

  if (todayTasks.length > 0) {
    summaryParts.push(
      `${todayTasks.length} task${todayTasks.length === 1 ? '' : 's'} today`
    );
  }
  if (overdueTasks.length > 0) {
    summaryParts.push(
      `${overdueTasks.length} overdue item${overdueTasks.length === 1 ? '' : 's'}`
    );
  }
  if (todayEvents.length > 0) {
    if (todayEvents.length === 1 && nextEvent) {
      const timeLabel = nextEvent.isAllDay
        ? 'all day'
        : nextEvent.startTime || nextEvent.time
        ? `at ${nextEvent.startTime || nextEvent.time}`
        : 'scheduled';
      summaryParts.push(`one calendar event ${timeLabel} (${nextEvent.title})`);
    } else {
      summaryParts.push(
        `${todayEvents.length} calendar events${
          nextEvent ? ` (next: ${nextEvent.title}${nextEvent.startTime ? ` at ${nextEvent.startTime}` : ''})` : ''
        }`
      );
    }
  }
  if (recurringToday.length > 0) {
    const recSample = recurringToday[0];
    summaryParts.push(
      recurringToday.length === 1
        ? `your recurring "${recSample.title}" is due today`
        : `${recurringToday.length} recurring responsibilities due`
    );
  }

  let firstSentence = '';
  if (summaryParts.length === 0) {
    firstSentence = `${greeting}. Your schedule for today is open, with ${activeTasks.length} upcoming task${
      activeTasks.length === 1 ? '' : 's'
    } on your list.`;
  } else if (summaryParts.length === 1) {
    firstSentence = `${greeting}. You have ${summaryParts[0]}.`;
  } else {
    const lastPart = summaryParts[summaryParts.length - 1];
    const initialParts = summaryParts.slice(0, -1).join(', ');
    firstSentence = `${greeting}. You have ${initialParts}, and ${lastPart}.`;
  }

  let secondSentence = '';
  if (topFocusTask) {
    if (variantIndex % 2 === 1 && nextEvent && !nextEvent.isAllDay) {
      secondSentence = `Consider making progress on "${topFocusTask.title}" around your ${
        nextEvent.startTime || nextEvent.time || 'scheduled'
      } commitment.`;
    } else if (isTaskOverdue(topFocusTask, todayISO)) {
      secondSentence = `Your main focus could be catching up on "${topFocusTask.title}" (${formatDisplayDate(
        topFocusTask.dueDate || ''
      )}).`;
    } else {
      secondSentence = `Your main focus could be finishing "${topFocusTask.title}".`;
    }
  } else if (tomorrowEvents.length > 0) {
    secondSentence = `Looking ahead, "${tomorrowEvents[0].title}" is on your calendar for tomorrow.`;
  }

  return {
    brief: [firstSentence, secondSentence].filter(Boolean).join(' '),
    isClearDay: false,
    topFocusTask,
    nextEvent,
    relevantMemory,
  };
}

/**
 * IMPROVEMENT 2 — "WHAT SHOULD I DO NOW?"
 * Analyzes the user's real tasks and calendar commitments to recommend 1-3 practical next actions.
 * Never invents urgency if the user's data does not support it.
 */
export function getWhatShouldIDoNowRecommendations(
  tasks: Task[],
  events: CalendarEvent[]
): {
  recommendations: NextActionRecommendation[];
  summaryContext: string;
} {
  const todayISO = getTodayString();
  const tomorrowISO = getTomorrowString();
  const now = getNow();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const activeTasks = tasks.filter((t) => !t.completed);
  if (activeTasks.length === 0) {
    return {
      recommendations: [],
      summaryContext: 'You have no unfinished tasks right now. Enjoy the open space or capture something new.',
    };
  }

  const todayEvents = events
    .filter((e) => isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates))
    .sort((a, b) => {
      const mA = parseTimeToMinutes(a.startTime || a.time) ?? 9999;
      const mB = parseTimeToMinutes(b.startTime || b.time) ?? 9999;
      return mA - mB;
    });

  const upcomingEventToday = todayEvents.find((e) => {
    if (e.isAllDay) return false;
    const m = parseTimeToMinutes(e.startTime || e.time);
    return m !== null && m >= currentMins;
  });

  // Score and rank real tasks transparently
  const scored = activeTasks.map((task) => {
    let score = 0;
    const reasons: string[] = [];
    let badge: string | undefined;
    let relatedEvent: CalendarEvent | undefined;

    const overdue = isTaskOverdue(task, todayISO);
    const dueToday = isTaskDueToday(task, todayISO);
    const normDate = task.dueDate ? normalizeDate(task.dueDate) : todayISO;
    const dueTomorrow = normDate === tomorrowISO;

    // Check if task is related to any today/tomorrow event
    for (const evt of todayEvents) {
      const rel = findRelatedTasksForEvent(evt, [task], todayISO);
      if (rel.length > 0) {
        relatedEvent = evt;
        break;
      }
    }

    if (relatedEvent) {
      score += 55;
      badge = 'Event preparation';
      reasons.push(
        `Directly related to "${relatedEvent.title}"${
          relatedEvent.startTime || relatedEvent.time
            ? ` at ${relatedEvent.startTime || relatedEvent.time}`
            : ' today'
        }`
      );
    }

    if (overdue) {
      score += 45;
      badge = badge || 'Overdue';
      reasons.push(`Past its scheduled date (${formatDisplayDate(task.dueDate || '')})`);
    } else if (dueToday) {
      score += 30;
      badge = badge || 'Due today';
      reasons.push('Scheduled for today');
    } else if (dueTomorrow) {
      score += 18;
      badge = badge || 'Due tomorrow';
      reasons.push("Due tomorrow and hasn't been completed yet");
    }

    if (task.time) {
      const tMins = parseTimeToMinutes(task.time);
      if (tMins !== null && dueToday) {
        const diff = tMins - currentMins;
        if (diff >= -60 && diff <= 120) {
          score += 35;
          badge = 'Time-sensitive';
          reasons.push(`Scheduled for ${task.time}`);
        } else if (diff > 120) {
          reasons.push(`Scheduled for ${task.time}`);
        }
      }
    }

    if (task.priority === 'high') {
      score += 25;
      badge = badge || 'High priority';
      reasons.push('Marked as high priority');
    } else if (task.isFocus) {
      score += 20;
      badge = badge || "Today's focus";
      reasons.push("Pinned to Today's focus");
    }

    if (task.isRecurring || task.recurrenceRule || task.recurring) {
      score += 10;
      reasons.push(
        `Part of your ${
          task.recurring ||
          (task.recurrenceRule ? formatRecurrenceLabel(task.recurrenceRule) : 'recurring')
        } routine`
      );
    }

    if (reasons.length === 0) {
      reasons.push(`In your ${task.area || 'Personal'} list (${formatDisplayDate(task.dueDate || 'Today')})`);
    }

    return {
      task,
      score,
      reason: reasons.slice(0, 2).join(' • ') + '.',
      relatedEvent,
      badge: badge || task.area,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const topItems = scored.slice(0, 3);
  const recommendations: NextActionRecommendation[] = topItems.map((item, idx) => ({
    id: `rec-now-${item.task.id}`,
    task: item.task,
    headline:
      idx === 0
        ? `Start with "${item.task.title}".`
        : `Next option: "${item.task.title}"`,
    reason: item.reason,
    relatedEvent: item.relatedEvent,
    badge: item.badge,
  }));

  let summaryContext = `Based on your ${activeTasks.length} active task${
    activeTasks.length === 1 ? '' : 's'
  }`;
  if (upcomingEventToday) {
    summaryContext += ` and your upcoming "${upcomingEventToday.title}" (${
      upcomingEventToday.startTime || upcomingEventToday.time || 'today'
    })`;
  }
  summaryContext += ':';

  return {
    recommendations,
    summaryContext,
  };
}

/**
 * Core Assistant Intelligence: Operates strictly on the current user's actual data.
 * Never uses demo, sample, or seeded information.
 */
export function processUserRequest(
  input: string,
  tasks: Task[],
  events: CalendarEvent[],
  areas: LifeArea[],
  memories: PersonalMemory[],
  context: AssistantContext
): {
  reply: AiActionResult;
  newContext: AssistantContext;
} {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const todayISO = getTodayString();

  // 1. SENSITIVE CREDENTIAL CHECK
  if (
    (lower.startsWith('save') || lower.startsWith('remember') || lower.startsWith('add to memory')) &&
    detectSensitiveContent(trimmed)
  ) {
    return {
      reply: {
        type: 'general_reply',
        message:
          'For your privacy and security, we strongly recommend using a dedicated, encrypted password manager for sensitive credentials, authentication keys, or payment cards instead of storing them in plain text.',
      },
      newContext: context,
    };
  }

  // 2. SAVING PERSONAL MEMORY ("Remember this: ...", "Save to memory: ...", "Add to memory: ...")
  if (
    lower.startsWith('remember this:') ||
    lower.startsWith('remember that') ||
    lower.startsWith('save to memory:') ||
    lower.startsWith('save this to memory') ||
    lower.startsWith('add to memory:') ||
    lower.startsWith('add to personal memory:')
  ) {
    const rawContent = trimmed
      .replace(/^(remember this:|remember that|save to memory:|save this to memory:|save this to memory|add to memory:|add to personal memory:)\s*/i, '')
      .trim();

    if (!rawContent) {
      return {
        reply: {
          type: 'clarification',
          message: 'What information would you like me to save to your Personal Memory?',
        },
        newContext: context,
      };
    }

    const colonIdx = rawContent.indexOf(':');
    let title = rawContent;
    let content = rawContent;
    if (colonIdx > 0 && colonIdx < 40) {
      title = rawContent.slice(0, colonIdx).trim();
      content = rawContent.slice(colonIdx + 1).trim();
    } else {
      title = rawContent.length > 40 ? rawContent.slice(0, 38) + '...' : rawContent;
    }

    let area = 'Personal';
    if (lower.includes('work') || lower.includes('project') || lower.includes('code')) area = 'Work';
    else if (lower.includes('home') || lower.includes('router') || lower.includes('appliance')) area = 'Home';
    else if (lower.includes('travel') || lower.includes('passport') || lower.includes('flight')) area = 'Travel';
    else if (lower.includes('finance') || lower.includes('bank') || lower.includes('tax')) area = 'Finance';
    else if (lower.includes('study') || lower.includes('learning') || lower.includes('course')) area = 'Learning';

    const newMemory: PersonalMemory = {
      id: `mem-${Date.now()}`,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      content,
      area,
      createdAt: todayISO,
      updatedAt: todayISO,
    };

    return {
      reply: {
        type: 'memory_saved',
        message: `Saved to Personal Memory:\n\n"${newMemory.title}"\n${newMemory.content}\nArea: ${newMemory.area}`,
        createdMemory: newMemory,
      },
      newContext: { ...context, lastMemoryId: newMemory.id },
    };
  }

  // 3. RETRIEVING SAVED MEMORY
  if (
    lower.includes('what did i save') ||
    lower.includes('what do i have about') ||
    lower.includes('what did i write about') ||
    lower.includes('what is the code name') ||
    lower.includes('what is the codename') ||
    lower.includes('where is my passport') ||
    lower.includes('in memory') ||
    lower.includes('personal memory')
  ) {
    const memoryKeywords = lower
      .replace(/what did i (save|write|have|know) about/gi, '')
      .replace(/what is (the|my)/gi, '')
      .replace(/where is (the|my)/gi, '')
      .replace(/in (my )?memory/gi, '')
      .trim();

    const terms = memoryKeywords.split(/\s+/).filter((t) => t.length > 2);
    const match = memories.find((m) => {
      const target = (m.title + ' ' + m.content + ' ' + (m.tags || []).join(' ')).toLowerCase();
      return terms.some((t) => target.includes(t));
    });

    if (match) {
      return {
        reply: {
          type: 'memory_retrieved',
          message: `From your saved Personal Memory:\n\n• ${match.title}:\n  ${match.content}\n  [Filed under ${match.area || 'Personal'}]`,
          retrievedMemory: match,
        },
        newContext: { ...context, lastMemoryId: match.id },
      };
    } else {
      return {
        reply: {
          type: 'general_reply',
          message: 'No matching records found in your Personal Memory. Save something important for later anytime.',
        },
        newContext: context,
      };
    }
  }

  // 4. CONFIRMATION HANDLING (e.g. "Delete all my completed tasks")
  if (
    lower.includes('delete all completed') ||
    lower.includes('clear completed') ||
    lower.includes('remove completed tasks')
  ) {
    const completedCount = tasks.filter((t) => t.completed).length;
    if (completedCount === 0) {
      return {
        reply: {
          type: 'general_reply',
          message: 'You have no completed tasks in your history.',
        },
        newContext: context,
      };
    }

    return {
      reply: {
        type: 'confirmation_required',
        message: `You asked to delete all ${completedCount} completed tasks. This will remove them from your history. Continue?`,
        pendingConfirmation: {
          action: 'delete_completed_tasks',
          prompt: `Permanently delete ${completedCount} completed tasks?`,
        },
      },
      newContext: { ...context, lastAction: 'confirm_delete_completed' },
    };
  }

  // 5. FOLLOW-UP HANDLING
  if (context.lastTaskId && (lower.startsWith('make it') || lower.startsWith('set it') || lower.includes('high priority') || lower.includes('urgent'))) {
    const targetTask = tasks.find((t) => t.id === context.lastTaskId);
    if (targetTask) {
      const priority = lower.includes('high') || lower.includes('urgent') ? 'high' : lower.includes('low') ? 'low' : 'medium';
      return {
        reply: {
          type: 'task_priority_updated',
          message: `Updated "${targetTask.title}" priority to ${priority}.`,
          affectedTask: { ...targetTask, priority, isFocus: priority === 'high' },
        },
        newContext: context,
      };
    }
  }

  if (context.lastTaskId && (lower.startsWith('move it to') || lower.startsWith('reschedule it to'))) {
    const targetTask = tasks.find((t) => t.id === context.lastTaskId);
    if (targetTask) {
      let newDate = 'Today';
      if (lower.includes('tomorrow')) newDate = 'Tomorrow';
      else if (lower.includes('friday')) newDate = 'Friday';
      else if (lower.includes('monday')) newDate = 'Monday';
      else if (lower.includes('next week')) newDate = 'Next week';
      return {
        reply: {
          type: 'task_rescheduled',
          message: `Rescheduled "${targetTask.title}" to ${newDate}.`,
          affectedTask: { ...targetTask, dueDate: newDate },
        },
        newContext: context,
      };
    }
  }

  // 6. WHAT SHOULD I DO NOW? / NEXT ACTION
  if (
    lower.includes('what should i do now') ||
    lower.includes('what to do now') ||
    lower.includes('next action') ||
    lower.includes('what should i work on right now')
  ) {
    const { recommendations, summaryContext } = getWhatShouldIDoNowRecommendations(tasks, events);
    if (recommendations.length === 0) {
      return {
        reply: {
          type: 'focus_advice',
          message: summaryContext,
        },
        newContext: context,
      };
    }

    const lines = recommendations.map(
      (r, idx) => `${idx + 1}. ${r.headline}\n   Why: ${r.reason}`
    );

    return {
      reply: {
        type: 'focus_advice',
        message: `${summaryContext}\n\n${lines.join('\n\n')}`,
        affectedTask: recommendations[0]?.task,
      },
      newContext: {
        ...context,
        lastTaskId: recommendations[0]?.task.id,
      },
    };
  }

  // 7. WEEKLY REVIEW INQUIRY
  if (
    lower.includes('weekly review') ||
    lower.includes('review my week') ||
    lower.includes('week in review') ||
    lower.includes('how did my week go')
  ) {
    const review = computeWeeklyReview(tasks, events);
    const lines: string[] = [review.aiObservation];

    if (review.unfinishedTasks.length > 0) {
      lines.push('');
      lines.push(`Unfinished tasks (${review.unfinishedTasks.length}):`);
      review.unfinishedTasks.slice(0, 5).forEach((t) => {
        lines.push(`• ${t.title} (${formatDisplayDate(t.dueDate || 'Today')} • ${t.area})`);
      });
    }

    if (review.upcomingCommitments.length > 0) {
      lines.push('');
      lines.push(`Upcoming commitments (${review.upcomingCommitments.length}):`);
      review.upcomingCommitments.slice(0, 4).forEach((c) => {
        lines.push(`• ${c.displayDate}: ${c.event.title} (${c.event.time || 'Scheduled'})`);
      });
    }

    return {
      reply: {
        type: 'weekly_overview',
        message: lines.join('\n'),
      },
      newContext: context,
    };
  }

  // 8. WHAT DO I NEED TO DO TODAY? / WHAT'S ON MY LIST TODAY?
  if (
    lower.includes('what do i need to do today') ||
    lower.includes('what do i need to do') ||
    lower.includes('what is on my list today') ||
    lower.includes('what are my tasks for today') ||
    lower.includes('do i have anything today')
  ) {
    const todayTasks = tasks.filter(
      (t) => !t.completed && (t.dueDate === 'Today' || !t.dueDate || normalizeDate(t.dueDate) === todayISO)
    );
    const todayEvents = events.filter((e) =>
      isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates)
    );

    if (todayTasks.length === 0 && todayEvents.length === 0) {
      return {
        reply: {
          type: 'day_plan',
          message: 'What matters today? You have no tasks or events scheduled. Add something you need to get done whenever you are ready.',
        },
        newContext: context,
      };
    }

    const items: string[] = [];
    if (todayEvents.length > 0) {
      items.push('Events scheduled:');
      todayEvents.forEach((e) => {
        items.push(`• ${e.isAllDay ? 'All day' : e.time || e.startTime || 'Scheduled'}: ${e.title}`);
      });
    }
    if (todayTasks.length > 0) {
      if (items.length > 0) items.push('');
      items.push('Tasks for today:');
      todayTasks.forEach((t) => {
        const timeStr = t.time ? ` (${t.time})` : '';
        const pStr = t.priority === 'high' ? ' [High priority]' : '';
        items.push(`• ${t.title}${timeStr}${pStr}`);
      });
    }

    return {
      reply: {
        type: 'day_plan',
        message: items.join('\n'),
      },
      newContext: context,
    };
  }

  // 9. PLAN MY DAY
  if (lower.includes('plan my day') || lower.includes('plan today') || lower === 'plan') {
    const todayTasks = tasks.filter(
      (t) => !t.completed && (t.dueDate === 'Today' || !t.dueDate || normalizeDate(t.dueDate) === todayISO)
    );
    const todayEvents = events.filter((e) =>
      isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates)
    );

    if (todayTasks.length === 0 && todayEvents.length === 0) {
      return {
        reply: {
          type: 'day_plan',
          message:
            'What matters today? Your schedule is completely clear. You can tell me what you need to remember, finish, or schedule.',
        },
        newContext: context,
      };
    }

    const items: string[] = [];
    todayEvents.forEach((e) => {
      const timeStr = e.isAllDay ? 'All day' : e.time || e.startTime || 'Scheduled';
      items.push(`• ${timeStr} – ${e.title} (${e.area || 'Event'})`);
    });

    const sortedTasks = [...todayTasks].sort((a, b) => {
      const pMap = { high: 3, medium: 2, low: 1 };
      return (pMap[b.priority || 'medium'] || 2) - (pMap[a.priority || 'medium'] || 2);
    });

    sortedTasks.forEach((t) => {
      const timeStr = t.time ? `[${t.time}] ` : '';
      const prioStr = t.priority === 'high' ? ' (High priority)' : '';
      const recStr = t.isRecurring || t.recurring ? ' 🔄' : '';
      items.push(`• ${timeStr}${t.title}${prioStr}${recStr}`);
    });

    return {
      reply: {
        type: 'day_plan',
        message: `Here is a suggested sequence for today:\n\n${items.join('\n')}\n\nTake things one commitment at a time. Let me know if you'd like to adjust anything.`,
      },
      newContext: context,
    };
  }

  // 10. WHAT SHOULD I FOCUS ON?
  if (
    lower.includes('what should i focus on') ||
    lower.includes('what to focus on') ||
    lower.includes('priorities') ||
    lower.includes('most important')
  ) {
    const activeTasks = tasks.filter((t) => !t.completed);
    const highTasks = activeTasks.filter((t) => t.isFocus || t.priority === 'high');
    const todayTasks = activeTasks.filter(
      (t) => t.dueDate === 'Today' || !t.dueDate || normalizeDate(t.dueDate) === todayISO
    );

    const candidates = highTasks.length > 0 ? highTasks : todayTasks.slice(0, 3);

    if (candidates.length === 0) {
      return {
        reply: {
          type: 'focus_advice',
          message: 'Nothing here yet. You have no pending tasks right now, so your focus is completely open. Add something you need to get done.',
        },
        newContext: context,
      };
    }

    const list = candidates
      .slice(0, 3)
      .map((t, idx) => `${idx + 1}. ${t.title} (${t.area} – ${t.dueDate || 'Today'})`)
      .join('\n');

    return {
      reply: {
        type: 'focus_advice',
        message: `Based on your deadlines and priorities, these appear to be the most time-sensitive items:\n\n${list}\n\nFocus on finishing the first item before turning to the rest.`,
      },
      newContext: context,
    };
  }

  // 11. TOMORROW / UPCOMING
  if (
    lower.includes('tomorrow') &&
    (lower.includes('what do i have') || lower.includes('tasks') || lower.includes('schedule') || lower.includes('events'))
  ) {
    const tomorrowTasks = tasks.filter(
      (t) => !t.completed && (t.dueDate === 'Tomorrow' || normalizeDate(t.dueDate) === getTomorrowString())
    );
    const tomorrowEvents = events.filter((e) =>
      isEventOccurringOnDate(e.date, getTomorrowString(), e.recurrenceRule, e.skippedDates)
    );

    if (tomorrowTasks.length === 0 && tomorrowEvents.length === 0) {
      return {
        reply: {
          type: 'weekly_overview',
          message: 'Your schedule is clear for tomorrow. There are no tasks or events scheduled.',
        },
        newContext: context,
      };
    }

    const items: string[] = [];
    tomorrowEvents.forEach((e) => {
      items.push(`• Event: ${e.title} (${e.time || 'All day'})`);
    });
    tomorrowTasks.forEach((t) => {
      items.push(`• Task: ${t.title} (${t.area})`);
    });

    return {
      reply: {
        type: 'weekly_overview',
        message: `Scheduled for tomorrow:\n\n${items.join('\n')}`,
      },
      newContext: context,
    };
  }

  // 12. WEEKLY OVERVIEW
  if (
    lower.includes('this week') ||
    lower.includes("what's coming up") ||
    lower.includes('upcoming') ||
    lower.includes('schedule this week')
  ) {
    const upcomingTasks = tasks.filter((t) => !t.completed && t.dueDate && t.dueDate !== 'Today');
    const upcomingEvents = events.slice(0, 4);

    if (upcomingTasks.length === 0 && upcomingEvents.length === 0) {
      return {
        reply: {
          type: 'weekly_overview',
          message: 'Your schedule is clear. Nothing is scheduled for the days ahead.',
        },
        newContext: context,
      };
    }

    const sections: string[] = [];
    if (upcomingEvents.length > 0) {
      sections.push('Events & Meetings:');
      upcomingEvents.forEach((e) => {
        sections.push(`• ${formatDisplayDate(e.date)} – ${e.title} (${e.time || 'Scheduled'})`);
      });
    }

    if (upcomingTasks.length > 0) {
      if (sections.length > 0) sections.push('');
      sections.push('Upcoming Tasks:');
      upcomingTasks.slice(0, 5).forEach((t) => {
        sections.push(`• ${formatDisplayDate(t.dueDate || '')} – ${t.title} (${t.area})`);
      });
    }

    return {
      reply: {
        type: 'weekly_overview',
        message: `Here is your upcoming overview:\n\n${sections.join('\n')}`,
      },
      newContext: context,
    };
  }

  // 13. SPECIFIC DATE / MONTH / YEAR SCHEDULE INQUIRIES
  const isScheduleInquiry =
    lower.includes('what do i have') ||
    lower.includes('what is scheduled') ||
    lower.includes('what events') ||
    lower.includes('calendar in') ||
    lower.includes('schedule for') ||
    lower.includes('schedule in') ||
    lower.includes('agenda for') ||
    lower.includes('what am i doing');

  const calendarMonthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];

  const matchedMonthIndex = calendarMonthNames.findIndex((m) => lower.includes(m));
  const yearMatch = lower.match(/\b(20\d\d)\b/);
  const isNextYear = lower.includes('next year');

  if (isScheduleInquiry && (matchedMonthIndex !== -1 || yearMatch || isNextYear)) {
    const todayYear = Number(todayISO.split('-')[0]) || 2026;
    const targetYear = yearMatch
      ? Number(yearMatch[1])
      : isNextYear
      ? todayYear + 1
      : todayYear;

    const dayMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    const dayNumber = dayMatch && Number(dayMatch[1]) >= 1 && Number(dayMatch[1]) <= 31 ? Number(dayMatch[1]) : null;

    if (matchedMonthIndex !== -1 && dayNumber) {
      const targetIso = `${targetYear}-${String(matchedMonthIndex + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
      const matchingEvents = events.filter((e) =>
        isEventOccurringOnDate(e.date, targetIso, e.recurrenceRule, e.skippedDates)
      );
      const matchingTasks = tasks.filter(
        (t) => !t.completed && (t.dueDate === targetIso || normalizeDate(t.dueDate) === targetIso)
      );

      const formattedLabel = formatFullDate(targetIso);

      if (matchingEvents.length === 0 && matchingTasks.length === 0) {
        return {
          reply: {
            type: 'weekly_overview',
            message: `Your schedule is clear for ${formattedLabel}. No events or tasks scheduled.`,
          },
          newContext: context,
        };
      }

      const items: string[] = [];
      if (matchingEvents.length > 0) {
        items.push('Events & Meetings:');
        matchingEvents.forEach((e) => {
          items.push(`• ${e.isAllDay ? 'All day' : e.time || e.startTime || 'Scheduled'} – ${e.title} (${e.area || 'General'})`);
        });
      }
      if (matchingTasks.length > 0) {
        if (items.length > 0) items.push('');
        items.push('Tasks:');
        matchingTasks.forEach((t) => {
          items.push(`• ${t.title} [${t.priority || 'medium'} priority]`);
        });
      }

      return {
        reply: {
          type: 'weekly_overview',
          message: `Schedule for ${formattedLabel}:\n\n${items.join('\n')}`,
        },
        newContext: context,
      };
    } else if (matchedMonthIndex !== -1) {
      const monthPrefix = `${targetYear}-${String(matchedMonthIndex + 1).padStart(2, '0')}`;
      const monthNameCapitalized = calendarMonthNames[matchedMonthIndex].charAt(0).toUpperCase() + calendarMonthNames[matchedMonthIndex].slice(1);
      const daysInTargetMonth = new Date(targetYear, matchedMonthIndex + 1, 0).getDate();

      const matchedEventsMap: Array<{ date: string; title: string; time?: string; area?: string }> = [];
      for (let day = 1; day <= daysInTargetMonth; day++) {
        const testIso = `${monthPrefix}-${String(day).padStart(2, '0')}`;
        const dayEvts = events.filter((e) =>
          isEventOccurringOnDate(e.date, testIso, e.recurrenceRule, e.skippedDates)
        );
        dayEvts.forEach((e) => {
          matchedEventsMap.push({
            date: testIso,
            title: e.title,
            time: e.isAllDay ? 'All day' : e.time || e.startTime,
            area: e.area,
          });
        });
      }

      const monthTasks = tasks.filter((t) => {
        if (t.completed || !t.dueDate) return false;
        const norm = normalizeDate(t.dueDate);
        return norm.startsWith(monthPrefix);
      });

      if (matchedEventsMap.length === 0 && monthTasks.length === 0) {
        return {
          reply: {
            type: 'weekly_overview',
            message: `Your schedule is clear for ${monthNameCapitalized} ${targetYear}. Nothing scheduled.`,
          },
          newContext: context,
        };
      }

      const items: string[] = [];
      if (matchedEventsMap.length > 0) {
        items.push(`Events in ${monthNameCapitalized} ${targetYear}:`);
        matchedEventsMap.slice(0, 10).forEach((e) => {
          items.push(`• ${formatDisplayDate(e.date)}: ${e.title} (${e.time || 'Scheduled'})`);
        });
      }
      if (monthTasks.length > 0) {
        if (items.length > 0) items.push('');
        items.push('Tasks:');
        monthTasks.slice(0, 6).forEach((t) => {
          items.push(`• ${formatDisplayDate(t.dueDate || '')}: ${t.title} (${t.area})`);
        });
      }

      return {
        reply: {
          type: 'weekly_overview',
          message: `Overview for ${monthNameCapitalized} ${targetYear}:\n\n${items.join('\n')}`,
        },
        newContext: context,
      };
    }
  }

  // 14. ORGANIZE MY TASKS
  if (
    lower.includes('organize my tasks') ||
    lower.includes('group tasks') ||
    lower.includes('tasks by area')
  ) {
    const activeTasks = tasks.filter((t) => !t.completed);
    if (activeTasks.length === 0) {
      return {
        reply: {
          type: 'organize_suggestion',
          message: 'Nothing here yet. You have no active tasks to organize right now.',
        },
        newContext: context,
      };
    }

    const grouped: Record<string, Task[]> = {};
    activeTasks.forEach((t) => {
      const area = t.area || 'Personal';
      if (!grouped[area]) grouped[area] = [];
      grouped[area].push(t);
    });

    const lines: string[] = [];
    Object.entries(grouped).forEach(([areaName, areaTasksList]) => {
      const areaObj = areas.find((a) => a.name.toLowerCase() === areaName.toLowerCase());
      const emoji = areaObj?.emoji || '📁';
      lines.push(`${emoji} ${areaName} (${areaTasksList.length}):`);
      areaTasksList.forEach((t) => {
        lines.push(`  • ${t.title} [${t.dueDate || 'Today'}]`);
      });
      lines.push('');
    });

    return {
      reply: {
        type: 'organize_suggestion',
        message: `Here are your ${activeTasks.length} active tasks grouped by life context:\n\n${lines.join('\n')}`,
      },
      newContext: context,
    };
  }

  // 15. AREA INQUIRIES
  for (const area of areas) {
    if (
      lower.includes(area.name.toLowerCase()) &&
      (lower.includes('show') || lower.includes('tasks') || lower.includes('pending') || lower.includes('what do i have'))
    ) {
      const aTasks = tasks.filter(
        (t) => !t.completed && t.area.toLowerCase() === area.name.toLowerCase()
      );
      const aEvents = events.filter(
        (e) => (e.area || '').toLowerCase() === area.name.toLowerCase()
      );

      if (aTasks.length === 0 && aEvents.length === 0) {
        return {
          reply: {
            type: 'area_summary',
            message: `Nothing here yet. You currently have no items in ${area.emoji} ${area.name}.`,
          },
          newContext: context,
        };
      }

      const rows: string[] = [];
      if (aTasks.length > 0) {
        rows.push(`Tasks (${aTasks.length}):`);
        aTasks.forEach((t) => rows.push(`• ${t.title} [${t.dueDate || 'Today'}]`));
      }
      if (aEvents.length > 0) {
        if (rows.length > 0) rows.push('');
        rows.push(`Events (${aEvents.length}):`);
        aEvents.forEach((e) => rows.push(`• ${e.title} [${formatDisplayDate(e.date)}]`));
      }

      return {
        reply: {
          type: 'area_summary',
          message: `${area.emoji} ${area.name} overview:\n\n${rows.join('\n')}`,
        },
        newContext: context,
      };
    }
  }

  // 16. TASK COMPLETION INTENT
  if (lower.startsWith('complete ') || lower.startsWith('finish ') || lower.startsWith('done with ')) {
    const query = lower.replace(/^(complete|finish|done with)\s+/i, '').trim();
    const match = tasks.find((t) => !t.completed && t.title.toLowerCase().includes(query));
    if (match) {
      return {
        reply: {
          type: 'task_completed',
          message: `Marked "${match.title}" as completed.`,
          affectedTask: match,
        },
        newContext: { ...context, lastTaskId: match.id },
      };
    }
  }

  // 17. AMBIGUOUS REQUEST HANDLING
  if (lower === 'schedule a dentist appointment' || lower === 'dentist appointment' || lower === 'schedule a meeting') {
    return {
      reply: {
        type: 'clarification',
        message: 'When would you like to schedule the appointment? Please specify a date and time (e.g. "Friday at 4 PM").',
      },
      newContext: context,
    };
  }

  // 18. MAGIC CAPTURE MULTI-RECORD / AMBIGUITY DETECTION IN AI CHAT
  const magicParsed = parseMagicCapture(trimmed);
  if (magicParsed.ambiguity) {
    return {
      reply: {
        type: 'clarification',
        message: magicParsed.ambiguity.question,
      },
      newContext: context,
    };
  }

  if (magicParsed.items.length > 1) {
    const previewLines = magicParsed.items.map((item: MagicCaptureItem) => {
      const kindLabel = item.type === 'event' ? 'Calendar Event' : item.type === 'memory' ? 'Memory' : 'Task';
      const timePart = item.time ? ` at ${item.time}` : '';
      const relPart = item.relationship ? ` (${item.relationship})` : '';
      return `• ${kindLabel}: ${item.title} — ${item.date}${timePart}${relPart}`;
    });

    return {
      reply: {
        type: 'confirmation_required',
        message: `I detected ${magicParsed.items.length} items from your message:\n\n${previewLines.join(
          '\n'
        )}\n\nWould you like me to save all of these?`,
        pendingConfirmation: {
          action: 'magic_capture',
          prompt: `Add ${magicParsed.items.length} detected items to your workspace?`,
          payload: magicParsed.items,
        },
      },
      newContext: context,
    };
  }

  // 19. EVENT CREATION INTENT
  if (
    lower.includes('appointment') ||
    lower.includes('meeting') ||
    lower.includes('flight') ||
    lower.includes('dinner') ||
    lower.includes('lunch with') ||
    lower.includes('dentist at') ||
    lower.includes('calendar')
  ) {
    const parsedEvent = parseNaturalLanguageEvent(trimmed);
    const newEvent: CalendarEvent = {
      ...parsedEvent,
      id: `event-${Date.now()}`,
    };
    return {
      reply: {
        type: 'event_created',
        message: `Added event:\n\n• ${newEvent.title}\n  ${formatDisplayDate(newEvent.date)} – ${newEvent.time || 'Time unset'}\n  ${newEvent.area || 'Personal'}`,
        createdEvent: newEvent,
      },
      newContext: { ...context, lastEventId: newEvent.id },
    };
  }

  // 20. TASK CREATION (DEFAULT INTENT FOR NATURAL LANGUAGE CAPTURE)
  const parsedTask = parseNaturalLanguageTask(trimmed);
  const newTask: Task = {
    ...parsedTask,
    id: `task-${Date.now()}`,
    completed: false,
  };
  const recInfo = newTask.recurring ? ` • ${newTask.recurring}` : '';

  return {
    reply: {
      type: 'task_created',
      message: `Added task:\n\n• ${newTask.title}\n  ${newTask.dueDate || 'Today'}${recInfo}\n  ${newTask.area}`,
      createdTask: newTask,
    },
    newContext: { ...context, lastTaskId: newTask.id },
  };
}
