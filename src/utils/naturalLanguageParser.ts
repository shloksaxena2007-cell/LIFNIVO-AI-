import { Task, PriorityLevel, CalendarEvent, RecurrenceRule } from '../types';
import { extractRecurrencePattern, formatRecurrenceLabel } from './recurringUtils';

export interface MagicCaptureItem {
  id: string;
  type: 'task' | 'event' | 'memory';
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  isAllDay?: boolean;
  priority?: PriorityLevel;
  area: string;
  recurring?: string;
  recurrenceRule?: RecurrenceRule;
  relationship?: string;
  notes?: string;
  memoryContent?: string;
}

export interface MagicCaptureAmbiguity {
  question: string;
  options: string[];
  targetItemIndex: number;
  field: 'date' | 'time';
}

export interface MagicCaptureResult {
  items: MagicCaptureItem[];
  ambiguity?: MagicCaptureAmbiguity;
  requiresConfirmation: boolean;
}

export function parseNaturalLanguageTask(input: string): Omit<Task, 'id' | 'completed'> {
  const { rule, cleanText } = extractRecurrencePattern(input.trim());
  let title = cleanText;
  let dueDate: string | undefined = undefined;
  let time: string | undefined = undefined;
  let priority: PriorityLevel = 'medium';
  let area: string | undefined = undefined;
  const recurring: string | undefined = rule ? formatRecurrenceLabel(rule) : undefined;
  let isFocus = false;

  const lower = title.toLowerCase();

  // If recurring was detected, set appropriate initial due date
  if (rule) {
    if (rule.frequency === 'daily') {
      dueDate = 'Today';
    } else if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dueDate = weekdays[rule.daysOfWeek[0]];
    } else if (rule.frequency === 'weekly') {
      dueDate = 'Today';
    } else {
      dueDate = 'Today';
    }
  }

  // Detect dates
  if (lower.includes('tomorrow')) {
    dueDate = 'Tomorrow';
    title = title.replace(/\btomorrow\b/gi, '');
  } else if (lower.includes('tonight')) {
    dueDate = 'Today';
    time = time || '8:00 PM';
    title = title.replace(/\btonight\b/gi, '');
  } else if (lower.includes('this afternoon')) {
    dueDate = 'Today';
    time = time || '2:00 PM';
    title = title.replace(/\bthis afternoon\b/gi, '');
  } else if (lower.includes('this morning')) {
    dueDate = 'Today';
    time = time || '9:00 AM';
    title = title.replace(/\bthis morning\b/gi, '');
  } else if (/\btoday\b/i.test(lower)) {
    dueDate = 'Today';
    title = title.replace(/\btoday\b/gi, '');
  } else if (lower.includes('next week')) {
    dueDate = 'Next week';
    title = title.replace(/\bnext week\b/gi, '');
  } else if (lower.includes('next month')) {
    dueDate = 'Next month';
    title = title.replace(/\bnext month\b/gi, '');
  } else if (/\bmonday\b/i.test(lower) && !recurring) {
    dueDate = 'Monday';
    title = title.replace(/\bon monday\b|\bmonday\b/gi, '');
  } else if (/\btuesday\b/i.test(lower) && !recurring) {
    dueDate = 'Tuesday';
    title = title.replace(/\bon tuesday\b|\btuesday\b/gi, '');
  } else if (/\bwednesday\b/i.test(lower) && !recurring) {
    dueDate = 'Wednesday';
    title = title.replace(/\bon wednesday\b|\bwednesday\b/gi, '');
  } else if (/\bthursday\b/i.test(lower) && !recurring) {
    dueDate = 'Thursday';
    title = title.replace(/\bon thursday\b|\bthursday\b/gi, '');
  } else if (/\bfriday\b/i.test(lower) && !recurring) {
    dueDate = 'Friday';
    title = title.replace(/\bon friday\b|\bfriday\b/gi, '');
  } else if (/\bsaturday\b/i.test(lower) && !recurring) {
    dueDate = 'Saturday';
    title = title.replace(/\bon saturday\b|\bsaturday\b/gi, '');
  } else if (/\bsunday\b/i.test(lower) && !recurring) {
    dueDate = 'Sunday';
    title = title.replace(/\bon sunday\b|\bsunday\b/gi, '');
  } else {
    // Check specific month mentions (e.g. "in June", "in November")
    const monthMatch = title.match(/\b(?:in\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
    if (monthMatch && !recurring) {
      dueDate = monthMatch[1];
      title = title.replace(monthMatch[0], '');
    }
  }

  // Detect explicit time format (e.g. "at 7 PM", "at 4:00 PM", "7:30 pm", "at 11am", "at 5")
  const timeRegex = /(?:at\s+)(\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\b)|(\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b)/i;
  const timeMatch = title.match(timeRegex);
  if (timeMatch) {
    let rawT = (timeMatch[1] || timeMatch[2]).trim().toUpperCase().replace(/\s+/, ' ');
    if (!rawT.includes('AM') && !rawT.includes('PM')) {
      const hr = parseInt(rawT, 10);
      rawT = hr >= 1 && hr <= 7 ? `${hr}:00 PM` : hr === 12 ? '12:00 PM' : `${hr}:00 AM`;
    } else if (!rawT.includes(':')) {
      rawT = rawT.replace(/(\d+)\s*(AM|PM)/, '$1:00 $2');
    }
    time = rawT;
    title = title.replace(timeMatch[0], '');
    if (!dueDate) {
      dueDate = 'Today';
    }
  }

  // Detect duration like "for two hours"
  const durationMatch = title.match(/\bfor\s+(?:two|2|\d+)\s+hours?\b/i);
  if (durationMatch) {
    title = title.replace(durationMatch[0], '');
    if (!time) {
      time = '8:00 PM';
    }
    if (!dueDate) {
      dueDate = 'Today';
    }
  }

  // Detect Area strictly based on context cues
  if (/\b(dentist|doctor|clinic|health|mom|dad|family|haircut|meditate|stretch|workout|gym|walk|self-care|prescriptions?|water|toothpaste|pharmacy)\b/i.test(lower)) {
    area = 'Personal';
  } else if (/\b(report|proposal|project|meeting|deck|client|presentation|retro|roadmap|quarterly|work|sprint|handoff|sync)\b/i.test(lower)) {
    area = 'Work';
  } else if (/\b(groceries|grocery|supermarket|laundry|dishes|pantry|apartment|home|house|repair|clean|furnace|kitchen)\b/i.test(lower)) {
    area = 'Home';
  } else if (/\b(bill|electricity|water|budget|finance|invoice|tax|rent|invest|pay|bank|subscription|insurance)\b/i.test(lower)) {
    area = 'Finance';
  } else if (/\b(trip|flight|hotel|kyoto|travel|pack|itinerary|passport|reservation|train|vacation)\b/i.test(lower)) {
    area = 'Travel';
  } else if (/\b(backup|laptop|phone|device|software|hardware|drive|cloud|macbook|ipad)\b/i.test(lower)) {
    area = 'Devices';
  } else if (/\b(study|assignment|book|chapter|course|learn|exam|homework|read|reading|lecture)\b/i.test(lower)) {
    area = 'Learning';
  }

  // Detect Priority
  if (/\b(urgent|asap|important|critical|high priority)\b/i.test(lower)) {
    priority = 'high';
    isFocus = true;
    title = title.replace(/\burgent\b|\basap\b|\bimportant\b|\bcritical\b|\bhigh priority\b/gi, '');
  } else if (/\b(low priority|routine|whenever|low)\b/i.test(lower)) {
    priority = 'low';
    title = title.replace(/\blow priority\b|\blow\b|\broutine\b|\bwhenever\b/gi, '');
  } else if (/\b(medium priority|medium)\b/i.test(lower)) {
    priority = 'medium';
    title = title.replace(/\bmedium priority\b|\bmedium\b/gi, '');
  }

  // Clean title
  title = title
    .replace(/^(\s*remember that\s*|\s*remember to\s*|\s*remind me to\s*|\s*remind me that\s*|\s*remind me\s*|\s*remember\s*|\s*at\s*|\s*on\s*|\s*by\s*|\s*for\s*)/gi, '')
    .replace(/\b(before that|after that|before then|afterwards)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) {
    title = input.trim();
  } else {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  if (!dueDate) {
    dueDate = 'Today';
  }

  return {
    title,
    dueDate,
    time,
    priority,
    area: area || 'Personal',
    recurring,
    recurrenceRule: rule,
    isRecurring: Boolean(rule),
    isFocus,
  };
}

export function parseNaturalLanguageEvent(input: string): Omit<CalendarEvent, 'id'> {
  const { rule, cleanText } = extractRecurrencePattern(input.trim());
  let title = cleanText;
  let date = 'Today';
  let startTime: string | undefined = undefined;
  let endTime: string | undefined = undefined;
  let isAllDay = false;
  let area: string = 'Personal';
  const recurring: string | undefined = rule ? formatRecurrenceLabel(rule) : undefined;

  const lower = title.toLowerCase();

  // If recurring was detected, set appropriate initial date
  if (rule) {
    if (rule.frequency === 'daily') {
      date = 'Today';
    } else if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      date = weekdays[rule.daysOfWeek[0]];
    } else {
      date = 'Today';
    }
  }

  // All-day event detection
  if (/\b(birthday|anniversary|holiday|vacation|all day|all-day)\b/i.test(lower)) {
    isAllDay = true;
  }

  // Date detection
  if (lower.includes('tomorrow')) {
    date = 'Tomorrow';
    title = title.replace(/\btomorrow\b/gi, '');
  } else if (lower.includes('today')) {
    date = 'Today';
    title = title.replace(/\btoday\b/gi, '');
  } else if (/\bmonday\b/i.test(lower) && !recurring) {
    date = 'Monday';
    title = title.replace(/\bon monday\b|\bmonday\b/gi, '');
  } else if (/\btuesday\b/i.test(lower) && !recurring) {
    date = 'Tuesday';
    title = title.replace(/\bon tuesday\b|\btuesday\b/gi, '');
  } else if (/\bwednesday\b/i.test(lower) && !recurring) {
    date = 'Wednesday';
    title = title.replace(/\bon wednesday\b|\bwednesday\b/gi, '');
  } else if (/\bthursday\b/i.test(lower) && !recurring) {
    date = 'Thursday';
    title = title.replace(/\bon thursday\b|\bthursday\b/gi, '');
  } else if (/\bfriday\b/i.test(lower) && !recurring) {
    date = 'Friday';
    title = title.replace(/\bon friday\b|\bfriday\b/gi, '');
  } else if (/\bsaturday\b/i.test(lower) && !recurring) {
    date = 'Saturday';
    title = title.replace(/\bon saturday\b|\bsaturday\b/gi, '');
  } else if (/\bsunday\b/i.test(lower) && !recurring) {
    date = 'Sunday';
    title = title.replace(/\bon sunday\b|\bsunday\b/gi, '');
  } else if (/\b(december|dec|november|nov|october|oct|september|sep|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug)\s+\d{1,2}\b/i.test(lower)) {
    const monthMatch = title.match(/\b(on\s+)?((?:december|dec|november|nov|october|oct|september|sep|january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug)\s+\d{1,2})\b/i);
    if (monthMatch) {
      date = monthMatch[2];
      title = title.replace(monthMatch[0], '');
    }
  }

  // Time detection: e.g. "at 4 PM", "at 10", "at 5", "at 7:30 pm", "10:00 AM - 11:00 AM"
  const rangeMatch = title.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|–)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  if (rangeMatch) {
    startTime = rangeMatch[1].toUpperCase();
    endTime = rangeMatch[2].toUpperCase();
    title = title.replace(rangeMatch[0], '');
  } else {
    const singleTimeMatch = title.match(/(?:at\s+)?(\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b|\bat\s+\d{1,2}(?::\d{2})?\b)/i);
    if (singleTimeMatch) {
      let t = singleTimeMatch[1].replace(/^at\s+/i, '').trim().toUpperCase();
      if (!t.includes('AM') && !t.includes('PM')) {
        const hourNum = parseInt(t, 10);
        t = hourNum < 8 ? `${hourNum}:00 PM` : hourNum === 12 ? '12:00 PM' : `${hourNum}:00 AM`;
      } else if (!t.includes(':')) {
        t = t.replace(/(\d+)\s*(AM|PM)/, '$1:00 $2');
      }
      startTime = t;
      title = title.replace(singleTimeMatch[0], '');
    }
  }

  // Area detection
  if (/\b(dentist|doctor|clinic|health|dinner|lunch|breakfast|workout|walk|run|gym)\b/i.test(lower)) {
    area = 'Personal';
  } else if (/\b(meeting|sync|presentation|interview|standup|call|team|review|strategy|work)\b/i.test(lower)) {
    area = 'Work';
  } else if (/\b(flight|hotel|kyoto|travel|trip|train|vacation|departure|arrival)\b/i.test(lower)) {
    area = 'Travel';
  } else if (/\b(bill|budget|bank|tax|finance|payment|rent)\b/i.test(lower)) {
    area = 'Finance';
  } else if (/\b(home|plumber|maintenance|groceries|house|family|repair)\b/i.test(lower)) {
    area = 'Home';
  } else if (/\b(exam|class|lecture|study|assignment|course)\b/i.test(lower)) {
    area = 'Learning';
  } else if (/\b(backup|device|laptop|phone|hardware)\b/i.test(lower)) {
    area = 'Devices';
  }

  title = title
    .replace(/^(\s*schedule\s+a\s+|\s*schedule\s+|\s*at\s*|\s*on\s*|\s*by\s*|\s*for\s*)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) {
    title = input.trim();
  } else {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  const timeFormatted = isAllDay
    ? 'All day'
    : startTime && endTime
    ? `${startTime} – ${endTime}`
    : startTime || '';

  return {
    title,
    date,
    startTime,
    endTime,
    time: timeFormatted,
    isAllDay,
    area,
    recurring,
    recurrenceRule: rule,
    isRecurring: Boolean(rule),
  };
}

/**
 * Determines whether a natural language clause is an Event, a Memory, or a Task.
 */
function classifyClauseType(clause: string): 'event' | 'task' | 'memory' {
  const lower = clause.trim().toLowerCase();

  // Memory indicators
  if (
    lower.startsWith('remember this:') ||
    lower.startsWith('save to memory:') ||
    lower.startsWith('add to memory:') ||
    lower.startsWith('note that ') ||
    (lower.startsWith('remember that ') && !/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at \d)\b/i.test(lower))
  ) {
    return 'memory';
  }

  // Explicit task/reminder cues
  if (
    lower.startsWith('remind me') ||
    lower.startsWith('remember to') ||
    lower.startsWith('todo') ||
    lower.startsWith('task:') ||
    /\b(buy|pick up|finish|complete|submit|pay|clean|email|send|prepare|read|review|fix|update|wash)\b/i.test(lower)
  ) {
    return 'task';
  }

  // Event cues (appointments, meetings, flights, dinners, or timed gatherings)
  const hasEventNoun =
    /\b(dentist|doctor|appointment|meeting|sync|standup|interview|flight|dinner|lunch|breakfast|coffee with|call with|class|lecture|concert|party|birthday|anniversary|wedding|therapy|checkup)\b/i.test(
      lower
    );
  const hasExplicitTime = /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(lower);

  if (hasEventNoun) {
    return 'event';
  }

  if (hasExplicitTime && /\b(with|at clinic|at office|room|zoom|meet)\b/i.test(lower)) {
    return 'event';
  }

  return 'task';
}

/**
 * Helper to compute an earlier time string (e.g. 1 hour before "5:00 PM" -> "4:00 PM")
 */
function getOneHourBefore(timeStr?: string): string | undefined {
  if (!timeStr) return undefined;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return undefined;
  let hr = parseInt(match[1], 10);
  const min = match[2];
  let period = match[3].toUpperCase();

  if (hr === 12) {
    hr = 11;
    period = period === 'PM' ? 'AM' : 'PM';
  } else if (hr === 1) {
    hr = 12;
  } else {
    hr -= 1;
  }
  return `${hr}:${min} ${period}`;
}

/**
 * Magic Capture Engine (Improvement 3 & 4):
 * Parses messy natural language into one or more structured records (Tasks, Calendar Events, Personal Memory),
 * preserves relative relationships (e.g., "before that"), and detects date/time ambiguities.
 */
export function parseMagicCapture(
  rawInput: string,
  defaultArea?: string
): MagicCaptureResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { items: [], requiresConfirmation: false };
  }

  // 1. Check for ambiguous date expressions like "Monday or Tuesday", "today or tomorrow"
  let ambiguity: MagicCaptureAmbiguity | undefined;
  const dateOrRegex =
    /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+or\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
  const dateOrMatch = trimmed.match(dateOrRegex);

  // Split compound input into distinct clauses when the user connects multiple intentions
  const splitRegex =
    /\s+(?:and\s+remind\s+me\s+to|and\s+remind\s+me|and\s+remember\s+to|and\s+remember\s+that|and\s+also|and\s+then|;\s*|\s+also\s+remind\s+me\s+to|,?\s+then\s+|,\s+and\s+(?=(?:remind|buy|call|schedule|email|pay|finish|pick|book|prepare|clean|meet|dentist|doctor)))\s*/i;

  const rawClauses = trimmed
    .split(splitRegex)
    .map((c) => c.trim())
    .filter(Boolean);

  // Re-attach "remind me to" if split consumed it and the second clause is a task
  const clauses = rawClauses.map((clause, idx) => {
    if (idx > 0 && !/^(remind|remember|schedule|add)/i.test(clause)) {
      // Check if the original text had "remind me to <clause>"
      const lowerFull = trimmed.toLowerCase();
      const lowerClause = clause.toLowerCase();
      const pos = lowerFull.indexOf(lowerClause);
      if (pos > 0) {
        const prefix = trimmed.slice(Math.max(0, pos - 22), pos).toLowerCase();
        if (prefix.includes('remind me') || prefix.includes('remember to')) {
          return `Remind me to ${clause}`;
        }
        if (prefix.includes('remember that')) {
          return `Remember that ${clause}`;
        }
      }
    }
    return clause;
  });

  const items: MagicCaptureItem[] = [];

  clauses.forEach((clause, idx) => {
    const kind = classifyClauseType(clause);
    const hasBeforeThat = /\b(before that|before then|prior to that|before it)\b/i.test(clause);
    const hasAfterThat = /\b(after that|afterwards|after then|after it)\b/i.test(clause);

    if (kind === 'memory') {
      const cleaned = clause
        .replace(/^(remember this:|remember that|save to memory:|add to memory:|note that)\s*/i, '')
        .trim();
      items.push({
        id: `mc-${Date.now()}-${idx}`,
        type: 'memory',
        title: cleaned.length > 44 ? cleaned.slice(0, 42) + '...' : cleaned,
        memoryContent: cleaned,
        date: 'Today',
        area: defaultArea || 'Personal',
      });
      return;
    }

    if (kind === 'event') {
      const parsedEvt = parseNaturalLanguageEvent(clause);
      items.push({
        id: `mc-${Date.now()}-${idx}`,
        type: 'event',
        title: parsedEvt.title,
        date: parsedEvt.date || 'Today',
        time: parsedEvt.startTime || (parsedEvt.isAllDay ? 'All day' : undefined),
        endTime: parsedEvt.endTime,
        isAllDay: parsedEvt.isAllDay,
        area: defaultArea || parsedEvt.area || 'Personal',
        recurring: parsedEvt.recurring,
        recurrenceRule: parsedEvt.recurrenceRule,
      });
      return;
    }

    // Default: Task
    const parsedTask = parseNaturalLanguageTask(clause);
    let resolvedDate = parsedTask.dueDate || 'Today';
    let resolvedTime = parsedTask.time;
    let relationship: string | undefined = undefined;
    let notes: string | undefined = undefined;

    // Resolve relative references ("before that", "after that") against previous item
    if ((hasBeforeThat || hasAfterThat) && items.length > 0) {
      const prevItem = items[items.length - 1];
      // Inherit date if current clause didn't explicitly state a different date
      const clauseHasOwnDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
        clause
      );
      if (!clauseHasOwnDate && prevItem.date) {
        resolvedDate = prevItem.date;
      }

      if (hasBeforeThat) {
        relationship = `Before ${prevItem.title}${prevItem.time ? ` (${prevItem.time})` : ''}`;
        notes = relationship;
        if (!resolvedTime && prevItem.time && prevItem.time !== 'All day') {
          resolvedTime = getOneHourBefore(prevItem.time);
        }
      } else if (hasAfterThat) {
        relationship = `After ${prevItem.title}${prevItem.time ? ` (${prevItem.time})` : ''}`;
        notes = relationship;
      }
    }

    items.push({
      id: `mc-${Date.now()}-${idx}`,
      type: 'task',
      title: parsedTask.title,
      date: resolvedDate,
      time: resolvedTime,
      priority: parsedTask.priority || 'medium',
      area: defaultArea || parsedTask.area || 'Personal',
      recurring: parsedTask.recurring,
      recurrenceRule: parsedTask.recurrenceRule,
      relationship,
      notes,
    });
  });

  // Populate ambiguity if detected
  if (dateOrMatch) {
    const opt1 = dateOrMatch[1].charAt(0).toUpperCase() + dateOrMatch[1].slice(1).toLowerCase();
    const opt2 = dateOrMatch[2].charAt(0).toUpperCase() + dateOrMatch[2].slice(1).toLowerCase();
    ambiguity = {
      question: `I found two possible dates (${opt1} or ${opt2}). Which one do you mean?`,
      options: [opt1, opt2],
      targetItemIndex: 0,
      field: 'date',
    };
  } else if (
    items.length === 1 &&
    items[0].type === 'event' &&
    !items[0].time &&
    !items[0].isAllDay &&
    !/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2})\b/i.test(trimmed)
  ) {
    ambiguity = {
      question: `When is "${items[0].title}" scheduled? Choose a day or edit the time below.`,
      options: ['Today', 'Tomorrow', 'Monday', 'Friday'],
      targetItemIndex: 0,
      field: 'date',
    };
  }

  const hasEventOrMemory = items.some((i) => i.type === 'event' || i.type === 'memory');
  const hasRelationship = items.some((i) => Boolean(i.relationship));
  const requiresConfirmation =
    items.length > 1 || Boolean(ambiguity) || hasRelationship || hasEventOrMemory;

  return {
    items,
    ambiguity,
    requiresConfirmation,
  };
}
