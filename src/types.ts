export type TabType = 'today' | 'tasks' | 'calendar' | 'areas' | 'ai';

export type PriorityLevel = 'high' | 'medium' | 'low';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // e.g. 1 for every week, 2 for every 2 weeks
  unit?: 'days' | 'weeks' | 'months' | 'years'; // For custom
  daysOfWeek?: number[]; // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  endType?: 'never' | 'on_date';
  endDate?: string; // YYYY-MM-DD
  label?: string; // e.g. 'Every day', 'Every Monday', 'Every 2 weeks'
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string; // 'Today' | 'Tomorrow' | 'Friday' | '2026-10-02', etc.
  time?: string; // e.g. '11:30 AM', '4:00 PM'
  priority?: PriorityLevel;
  area: string; // e.g. 'Work', 'Home', 'Personal', 'Finance', 'Travel', 'Devices', 'Learning', 'Custom'
  isFocus?: boolean; // Part of "Today's focus" (top 1-3 priorities)
  recurring?: string; // Human-friendly label e.g. 'Every day', 'Every Monday'
  recurrenceRule?: RecurrenceRule;
  isRecurring?: boolean;
  seriesId?: string;
  skippedDates?: string[]; // Dates skipped e.g. ['2026-10-02']
  completedDates?: string[]; // Historical completed dates
  notes?: string;
  userId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD or 'Today' | 'Tomorrow'
  startTime?: string; // e.g. '04:00 PM'
  endTime?: string; // e.g. '04:45 PM'
  time?: string; // formatted summary, e.g. '4:00 PM – 4:45 PM' or 'All day'
  isAllDay?: boolean; // For birthdays, holidays, travel days, deadlines
  area?: string;
  location?: string;
  notes?: string;
  recurring?: string; // 'Every day' | 'Every week' | 'Every month' | 'Every year'
  recurrenceRule?: RecurrenceRule;
  isRecurring?: boolean;
  seriesId?: string;
  skippedDates?: string[];
  attendees?: string[];
  userId?: string;
}

export interface LifeArea {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  isCustom?: boolean;
  hidden?: boolean;
  colorBg?: string;
  colorText?: string;
  badgeBg?: string;
  badge?: string;
  userId?: string;
}

export interface AreaNote {
  id: string;
  area: string; // matches area name (e.g. 'Work', 'Home')
  title: string;
  content: string;
  updatedAt?: string;
  userId?: string;
}

export interface PersonalMemory {
  id: string;
  title: string;
  content: string;
  area?: string; // 'Personal' | 'Work' | 'Home' | 'Learning' | 'Travel' | 'Devices' | 'Finance' | 'Custom'
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  userId?: string;
}

export type SearchResultType = 'task' | 'event' | 'area' | 'memory';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  snippet?: string;
  area?: string;
  date?: string;
  time?: string;
  isRecurring?: boolean;
  recurringLabel?: string;
  rawItem: Task | CalendarEvent | LifeArea | PersonalMemory;
}

export type ScenarioPreset =
  | 'active'
  | 'new_user'
  | 'one_task'
  | 'several_tasks'
  | 'tasks_and_events'
  | 'recurring_tasks';
