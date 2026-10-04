import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarEvent, Task, LifeArea, RecurrenceRule } from '../types';
import {
  getTodayString,
  getTomorrowString,
  normalizeDate,
  formatDisplayDate,
  formatFullDate,
  doTimesOverlap,
} from '../utils/dateUtils';
import { parseNaturalLanguageEvent, parseMagicCapture } from '../utils/naturalLanguageParser';
import { isEventOccurringOnDate, formatRecurrenceLabel } from '../utils/recurringUtils';
import { findRelatedTasksForEvent } from '../utils/reminderIntelligence';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  areas?: LifeArea[];
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onToggleTask: (id: string) => void;
  onSkipEvent?: (id: string, date: string) => void;
  onStopRecurringEvent?: (id: string) => void;
  onOpenMagicCapture?: (initialText: string) => void;
}

type CalendarViewMode = 'month' | 'week' | 'agenda';
type CalendarFilter = 'all' | 'events' | 'tasks';

const DEFAULT_AREA_OPTIONS = [
  { name: 'Home', emoji: '🏠' },
  { name: 'Work', emoji: '💼' },
  { name: 'Devices', emoji: '💻' },
  { name: 'Personal', emoji: '🌿' },
  { name: 'Learning', emoji: '📚' },
  { name: 'Finance', emoji: '💳' },
  { name: 'Travel', emoji: '✈️' },
  { name: 'Custom', emoji: '📁' },
];

const WEEKDAY_KEYS = [
  { label: 'M', name: 'Mon', day: 1 },
  { label: 'T', name: 'Tue', day: 2 },
  { label: 'W', name: 'Wed', day: 3 },
  { label: 'T', name: 'Thu', day: 4 },
  { label: 'F', name: 'Fri', day: 5 },
  { label: 'S', name: 'Sat', day: 6 },
  { label: 'S', name: 'Sun', day: 0 },
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  tasks,
  areas,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onToggleTask,
  onSkipEvent,
  onStopRecurringEvent,
  onOpenMagicCapture,
}) => {
  const AREA_OPTIONS =
    areas && areas.length > 0
      ? areas
          .filter((a) => !a.hidden)
          .map((a) => ({ name: a.name, emoji: a.emoji }))
          .concat([{ name: 'Custom', emoji: '📁' }])
      : DEFAULT_AREA_OPTIONS;

  const todayISO = getTodayString();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [filter, setFilter] = useState<CalendarFilter>('all');

  // Full Date Navigation State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('lifedesk_calendar_selected_date');
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch {
      // fallback
    }
    return todayISO;
  });

  const [currentYear, setCurrentYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('lifedesk_calendar_selected_date');
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        const yr = Number(saved.split('-')[0]);
        if (!isNaN(yr)) return yr;
      }
    } catch {
      // fallback
    }
    const parts = todayISO.split('-');
    return Number(parts[0]) || 2026;
  });

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('lifedesk_calendar_selected_date');
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        const mo = Number(saved.split('-')[1]) - 1;
        if (!isNaN(mo) && mo >= 0 && mo <= 11) return mo;
      }
    } catch {
      // fallback
    }
    const parts = todayISO.split('-');
    return Number(parts[1]) - 1 || 8;
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
      }
    };
    if (isDatePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDatePickerOpen]);

  // Year options list for jumping
  const YEAR_OPTIONS = useMemo(() => {
    const years: number[] = [];
    const start = Math.min(2015, currentYear - 5);
    const end = Math.max(2040, currentYear + 10);
    for (let y = start; y <= end; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  // Date selection handler
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      setCurrentYear(parts[0]);
      setCurrentMonth(parts[1] - 1);
    }
    try {
      localStorage.setItem('lifedesk_calendar_selected_date', dateStr);
    } catch {
      // ignore
    }
  };

  // Previous month button
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  // Next month button
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Today shortcut button
  const handleGoToToday = () => {
    const parts = todayISO.split('-').map(Number);
    setCurrentYear(parts[0]);
    setCurrentMonth(parts[1] - 1);
    setSelectedDate(todayISO);
    try {
      localStorage.setItem('lifedesk_calendar_selected_date', todayISO);
    } catch {
      // ignore
    }
  };

  // Day step navigation
  const handlePrevDay = () => {
    const parts = (selectedDate || todayISO).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleSelectDate(`${y}-${m}-${day}`);
  };

  const handleNextDay = () => {
    const parts = (selectedDate || todayISO).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleSelectDate(`${y}-${m}-${day}`);
  };

  // Week step navigation
  const handlePrevWeek = () => {
    const parts = (selectedDate || todayISO).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleSelectDate(`${y}-${m}-${day}`);
  };

  const handleNextWeek = () => {
    const parts = (selectedDate || todayISO).split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    handleSelectDate(`${y}-${m}-${day}`);
  };

  // Quick NLP Input
  const [quickInput, setQuickInput] = useState('');

  // Event Modal (Add & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);

  // Modal form states
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState(todayISO);
  const [formStartTime, setFormStartTime] = useState('10:00 AM');
  const [formEndTime, setFormEndTime] = useState('11:00 AM');
  const [formIsAllDay, setFormIsAllDay] = useState(false);
  const [formArea, setFormArea] = useState('Personal');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Recurrence Controls
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [repeatFreq, setRepeatFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('weekly');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1]);
  const [customInterval, setCustomInterval] = useState<number>(2);
  const [customUnit, setCustomUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('weeks');
  const [endOption, setEndOption] = useState<'never' | 'on_date'>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [editScope, setEditScope] = useState<'this' | 'series'>('series');

  // Normalize tasks for calendar (maintaining single source of truth)
  const calendarTasks = useMemo(() => {
    return tasks.map((t) => ({
      ...t,
      normalizedDate: normalizeDate(t.dueDate || 'Today'),
    }));
  }, [tasks]);

  const getEventsForDate = (dateStr: string) => {
    return events.filter((e) =>
      isEventOccurringOnDate(e.date, dateStr, e.recurrenceRule, e.skippedDates)
    );
  };

  const getOverlappingEventIds = (dateStr: string) => {
    const dayEvents = getEventsForDate(dateStr).filter((e) => !e.isAllDay);
    const overlapping = new Set<string>();
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const e1 = dayEvents[i];
        const e2 = dayEvents[j];
        if (doTimesOverlap(e1.startTime, e1.endTime, e1.isAllDay, e2.startTime, e2.endTime, e2.isAllDay)) {
          overlapping.add(e1.id);
          overlapping.add(e2.id);
        }
      }
    }
    return overlapping;
  };

  const formHasConflict = useMemo(() => {
    if (formIsAllDay || !formStartTime || !isModalOpen) return false;
    const targetDate = normalizeDate(formDate);
    const dayEvents = getEventsForDate(targetDate).filter(
      (e) => !e.isAllDay && (!editingEvent || e.id !== editingEvent.id)
    );
    return dayEvents.some((e) =>
      doTimesOverlap(formStartTime, formEndTime, false, e.startTime, e.endTime, false)
    );
  }, [formDate, formStartTime, formEndTime, formIsAllDay, isModalOpen, events, editingEvent]);

  // Handle Quick NLP Input Submit
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;
    const magic = parseMagicCapture(trimmed);
    if (magic.items.length > 1 || magic.ambiguity) {
      if (onOpenMagicCapture) {
        onOpenMagicCapture(trimmed);
        setQuickInput('');
        return;
      }
    }
    const parsed = parseNaturalLanguageEvent(trimmed);
    const resolvedDate = normalizeDate(parsed.date);
    setEditingEvent(null);
    setFormTitle(parsed.title);
    setFormDate(resolvedDate);
    setFormStartTime(parsed.startTime || '10:00 AM');
    setFormEndTime(parsed.endTime || '11:00 AM');
    setFormIsAllDay(Boolean(parsed.isAllDay));
    setFormArea(parsed.area || 'Personal');
    setFormLocation('');
    setFormNotes('');
    if (parsed.recurring || parsed.recurrenceRule) {
      setIsRepeatEnabled(true);
      if (parsed.recurrenceRule) {
        setRepeatFreq(parsed.recurrenceRule.frequency);
        setSelectedWeekdays(parsed.recurrenceRule.daysOfWeek || [1]);
      } else {
        setRepeatFreq('weekly');
        setSelectedWeekdays([1]);
      }
    } else {
      setIsRepeatEnabled(false);
      setRepeatFreq('weekly');
      setSelectedWeekdays([1]);
    }
    setEndOption('never');
    setEndDate('');
    setEditScope('series');
    setIsModalOpen(true);
    setQuickInput('');
  };

  // Open Create Modal
  const handleOpenAddModal = (defaultDate?: string) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormDate(defaultDate ? normalizeDate(defaultDate) : selectedDate || todayISO);
    setFormStartTime('10:00 AM');
    setFormEndTime('11:00 AM');
    setFormIsAllDay(false);
    setFormArea('Personal');
    setFormLocation('');
    setFormNotes('');
    setIsRepeatEnabled(false);
    setRepeatFreq('weekly');
    setSelectedWeekdays([1]);
    setCustomInterval(2);
    setCustomUnit('weeks');
    setEndOption('never');
    setEndDate('');
    setEditScope('series');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setViewingEvent(null);
    setFormTitle(evt.title);
    setFormDate(normalizeDate(evt.date));
    setFormStartTime(evt.startTime || '10:00 AM');
    setFormEndTime(evt.endTime || '11:00 AM');
    setFormIsAllDay(Boolean(evt.isAllDay));
    setFormArea(evt.area || 'Personal');
    setFormLocation(evt.location || '');
    setFormNotes(evt.notes || '');
    if (evt.isRecurring || evt.recurrenceRule || evt.recurring) {
      setIsRepeatEnabled(true);
      if (evt.recurrenceRule) {
        setRepeatFreq(evt.recurrenceRule.frequency);
        setSelectedWeekdays(evt.recurrenceRule.daysOfWeek || [1]);
        setCustomInterval(evt.recurrenceRule.interval || 2);
        setCustomUnit(evt.recurrenceRule.unit || 'weeks');
        setEndOption(evt.recurrenceRule.endType || 'never');
        setEndDate(evt.recurrenceRule.endDate || '');
      } else {
        setRepeatFreq('weekly');
        setSelectedWeekdays([1]);
        setEndOption('never');
      }
    } else {
      setIsRepeatEnabled(false);
      setRepeatFreq('weekly');
      setSelectedWeekdays([1]);
      setEndOption('never');
    }
    setEditScope('series');
    setIsModalOpen(true);
  };

  const buildCurrentRule = (): RecurrenceRule | undefined => {
    if (!isRepeatEnabled) return undefined;
    let rule: RecurrenceRule;
    if (repeatFreq === 'daily') {
      rule = { frequency: 'daily', interval: 1, endType: endOption, endDate: endOption === 'on_date' ? endDate : undefined };
    } else if (repeatFreq === 'weekly') {
      rule = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: selectedWeekdays,
        endType: endOption,
        endDate: endOption === 'on_date' ? endDate : undefined,
      };
    } else if (repeatFreq === 'monthly') {
      rule = { frequency: 'monthly', interval: 1, endType: endOption, endDate: endOption === 'on_date' ? endDate : undefined };
    } else if (repeatFreq === 'yearly') {
      rule = { frequency: 'yearly', interval: 1, endType: endOption, endDate: endOption === 'on_date' ? endDate : undefined };
    } else {
      rule = {
        frequency: 'custom',
        interval: customInterval || 1,
        unit: customUnit,
        endType: endOption,
        endDate: endOption === 'on_date' ? endDate : undefined,
      };
    }
    rule.label = formatRecurrenceLabel(rule);
    return rule;
  };

  // Save Modal
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const formattedTime = formIsAllDay
      ? 'All day'
      : formStartTime && formEndTime
      ? `${formStartTime} – ${formEndTime}`
      : formStartTime || '';

    const currentRule = buildCurrentRule();
    const recurrenceLabel = currentRule ? formatRecurrenceLabel(currentRule) : undefined;

    if (editingEvent) {
      if (editScope === 'this') {
        onEditEvent({
          ...editingEvent,
          title: formTitle.trim(),
          date: formDate,
          startTime: formIsAllDay ? undefined : formStartTime,
          endTime: formIsAllDay ? undefined : formEndTime,
          time: formattedTime,
          isAllDay: formIsAllDay,
          area: formArea,
          location: formLocation.trim() || undefined,
          notes: formNotes.trim() || undefined,
        });
      } else {
        onEditEvent({
          ...editingEvent,
          title: formTitle.trim(),
          date: formDate,
          startTime: formIsAllDay ? undefined : formStartTime,
          endTime: formIsAllDay ? undefined : formEndTime,
          time: formattedTime,
          isAllDay: formIsAllDay,
          area: formArea,
          location: formLocation.trim() || undefined,
          notes: formNotes.trim() || undefined,
          recurring: recurrenceLabel,
          recurrenceRule: currentRule,
          isRecurring: Boolean(currentRule),
        });
      }
      setEditingEvent(null);
    } else {
      onAddEvent({
        title: formTitle.trim(),
        date: formDate,
        startTime: formIsAllDay ? undefined : formStartTime,
        endTime: formIsAllDay ? undefined : formEndTime,
        time: formattedTime,
        isAllDay: formIsAllDay,
        area: formArea,
        location: formLocation.trim() || undefined,
        notes: formNotes.trim() || undefined,
        recurring: recurrenceLabel,
        recurrenceRule: currentRule,
        isRecurring: Boolean(currentRule),
      });
    }
    setIsModalOpen(false);
  };

  // Selected date items
  const selectedDateEvents = getEventsForDate(selectedDate);
  const selectedDateTasks = calendarTasks.filter((t) => t.normalizedDate === selectedDate);
  const selectedDateOverlaps = getOverlappingEventIds(selectedDate);

  // Dynamic Month grid calculation
  const monthGridDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOffset = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{
      dayNum: number;
      iso: string;
      isCurrentMonth: boolean;
    }> = [];

    const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const iso = `${prevMonthYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dayNum, iso, isCurrentMonth: false });
    }

    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const iso = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dayNum, iso, isCurrentMonth: true });
    }

    const remainingDays = (7 - (cells.length % 7)) % 7;
    const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    for (let dayNum = 1; dayNum <= remainingDays; dayNum++) {
      const iso = `${nextMonthYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({ dayNum, iso, isCurrentMonth: false });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Dynamic 7 days of the week based on selectedDate
  const currentWeekDays = useMemo(() => {
    const parts = (selectedDate || todayISO).split('-').map(Number);
    const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayOfWeek = (targetDate.getDay() + 6) % 7; // 0 for Mon, 6 for Sun
    const monday = new Date(targetDate);
    monday.setDate(monday.getDate() - dayOfWeek);
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return {
        name: dayLabels[i],
        num: d.getDate(),
        iso,
        monthName: d.toLocaleString('en-US', { month: 'short' }),
        year: d.getFullYear(),
      };
    });
  }, [selectedDate, todayISO]);

  // Agenda items across scheduled dates
  const agendaDates = useMemo(() => {
    const datesSet = new Set<string>();
    events.forEach((e) => datesSet.add(normalizeDate(e.date)));
    calendarTasks.forEach((t) => datesSet.add(t.normalizedDate));
    datesSet.add(todayISO);
    datesSet.add(getTomorrowString());
    if (selectedDate) datesSet.add(selectedDate);

    // Expand recurring event occurrences for the visible month
    monthGridDays.forEach(({ iso, isCurrentMonth }) => {
      if (isCurrentMonth) {
        const evts = getEventsForDate(iso);
        if (evts.length > 0) {
          datesSet.add(iso);
        }
      }
    });

    const sortedDates = Array.from(datesSet).sort();
    return sortedDates.map((dateStr) => {
      const dayEvts = getEventsForDate(dateStr);
      const dayTsks = calendarTasks.filter((t) => t.normalizedDate === dateStr);
      const overlaps = getOverlappingEventIds(dateStr);

      return {
        dateStr,
        displayDate: formatDisplayDate(dateStr),
        fullDate: formatFullDate(dateStr),
        events: dayEvts,
        tasks: dayTsks,
        hasOverlap: overlaps.size > 0,
      };
    });
  }, [events, calendarTasks, todayISO, selectedDate, monthGridDays]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 flex flex-col gap-6 md:gap-8">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight">
            Calendar
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant">
            See what's happening and when.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenAddModal()}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-medium text-sm shadow-sm hover:bg-primary-container transition-all cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>+ Add event</span>
        </button>
      </header>

      {/* QUICK EVENT CAPTURE */}
      <section aria-label="Quick event capture" className="w-full">
        <form
          onSubmit={handleQuickSubmit}
          className="relative w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-2 shadow-sm focus-within:shadow-md focus-within:border-primary/40 transition-all flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-outline ml-3 text-[22px]">
            event_available
          </span>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Add an event (e.g. Team meeting every Monday at 10 AM, dentist tomorrow at 4 PM...)"
            className="w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline focus:outline-none py-1.5"
          />
          <div className="hidden sm:flex items-center gap-1.5 pr-3 text-outline text-xs">
            <kbd className="px-2 py-0.5 rounded bg-surface-container text-[11px] text-on-surface-variant font-mono">
              Return
            </kbd>
            <span>to review</span>
          </div>
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="sm:hidden px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold mr-1 disabled:opacity-50 cursor-pointer"
          >
            Review
          </button>
        </form>
      </section>

      {/* CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-outline-variant/15 pb-2">
        <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-full border border-outline-variant/20 shadow-sm" role="tablist">
          {(['month', 'week', 'agenda'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                viewMode === mode
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-outline mr-1 hidden sm:inline">Show:</span>
          {(['all', 'events', 'tasks'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all cursor-pointer ${
                filter === f
                  ? 'bg-secondary-container text-on-secondary-fixed font-semibold'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 sm:p-6 shadow-sm">
            {/* DATE NAVIGATION BAR: ‹ Month Year ›  Today */}
            <div className="flex items-center justify-between pb-3 mb-2 flex-wrap gap-2 border-b border-outline-variant/15">
              <div className="flex items-center gap-1.5 relative" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen((prev) => !prev)}
                  aria-label="Select month and year"
                  aria-expanded={isDatePickerOpen}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-surface-container text-base sm:text-lg font-semibold text-on-surface transition-colors cursor-pointer"
                >
                  <span>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[18px] text-outline transition-transform duration-200 ${
                      isDatePickerOpen ? 'rotate-180' : ''
                    }`}
                  >
                    arrow_drop_down
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>

                {/* COMBINED MONTH + YEAR PICKER POPOVER */}
                {isDatePickerOpen && (
                  <div className="absolute top-full left-0 mt-2 z-50 w-72 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/30 p-4 flex flex-col gap-3 animate-fade-in">
                    {/* Year Selector */}
                    <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                      <button
                        type="button"
                        onClick={() => setCurrentYear((y) => y - 1)}
                        aria-label="Previous year"
                        className="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                      </button>
                      <select
                        value={currentYear}
                        onChange={(e) => setCurrentYear(Number(e.target.value))}
                        aria-label="Select year"
                        className="bg-surface-container-low font-bold text-sm px-2.5 py-1 rounded-lg border border-outline-variant/20 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                      >
                        {YEAR_OPTIONS.map((yr) => (
                          <option key={yr} value={yr}>
                            {yr}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setCurrentYear((y) => y + 1)}
                        aria-label="Next year"
                        className="w-7 h-7 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                      </button>
                    </div>

                    {/* Month Selector Grid (12 Months) */}
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                      {MONTH_NAMES.map((mName, idx) => {
                        const isSelectedMonth = currentMonth === idx;
                        return (
                          <button
                            key={mName}
                            type="button"
                            onClick={() => {
                              setCurrentMonth(idx);
                              setIsDatePickerOpen(false);
                            }}
                            className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                              isSelectedMonth
                                ? 'bg-secondary-container text-on-secondary-fixed font-bold shadow-xs'
                                : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            {mName.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer Shortcut */}
                    <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          handleGoToToday();
                          setIsDatePickerOpen(false);
                        }}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        Go to Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="text-xs text-outline hover:text-on-surface cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Today shortcut button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-primary border border-outline-variant/20 hover:border-outline-variant/40 transition-all cursor-pointer shadow-xs"
                >
                  Today
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2 text-center text-xs font-semibold text-outline uppercase tracking-wider">
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div className="text-secondary">Sat</div>
              <div className="text-secondary">Sun</div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 select-none">
              {monthGridDays.map(({ dayNum, iso, isCurrentMonth }) => {
                const isSelected = selectedDate === iso;
                const isToday = iso === todayISO;
                const dayEvts = getEventsForDate(iso);
                const dayTsks = calendarTasks.filter((t) => t.normalizedDate === iso);
                const overlaps = getOverlappingEventIds(iso);
                const showEvents = filter === 'all' || filter === 'events';
                const showTasks = filter === 'all' || filter === 'tasks';

                return (
                  <div
                    key={iso}
                    onClick={() => handleSelectDate(iso)}
                    className={`min-h-[64px] sm:min-h-[82px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                      !isCurrentMonth ? 'opacity-40 bg-surface-container-low/20' : ''
                    } ${
                      isSelected
                        ? 'bg-secondary-fixed/50 border-secondary/40 shadow-sm ring-1 ring-secondary/30'
                        : 'border-transparent hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold ${
                          isToday
                            ? 'w-5 h-5 rounded-full bg-secondary text-on-secondary flex items-center justify-center'
                            : isSelected
                            ? 'text-on-secondary-fixed'
                            : 'text-on-surface'
                        }`}
                      >
                        {dayNum}
                      </span>
                      {overlaps.size > 0 && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-tertiary"
                          title="These events overlap"
                        ></span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mt-0.5 overflow-hidden">
                      {showEvents &&
                        dayEvts.slice(0, 2).map((evt) => (
                          <span
                            key={evt.id}
                            className="text-[10px] truncate px-1 py-0.5 rounded bg-surface-container-lowest text-on-surface font-medium leading-tight block"
                          >
                            {evt.isRecurring && '🔄 '}
                            {evt.isAllDay ? 'All day' : evt.startTime || ''} {evt.title}
                          </span>
                        ))}
                      {showTasks &&
                        dayTsks.slice(0, 1).map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] truncate px-1 py-0.5 rounded bg-surface-container text-on-surface-variant font-medium leading-tight block"
                          >
                            {t.isRecurring && '🔄 '}{t.title}
                          </span>
                        ))}
                      {showEvents && dayEvts.length > 2 && (
                        <span className="text-[9px] text-outline font-medium pl-0.5">
                          +{dayEvts.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIDE AGENDA */}
          <aside className="lg:col-span-4 flex flex-col gap-5">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-start justify-between pb-2 border-b border-outline-variant/15">
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                    Selected Date
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <button
                      type="button"
                      onClick={handlePrevDay}
                      title="Previous day"
                      aria-label="Previous day"
                      className="w-6 h-6 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer shrink-0 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <h3 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight truncate">
                      {formatFullDate(selectedDate)}
                    </h3>
                    <button
                      type="button"
                      onClick={handleNextDay}
                      title="Next day"
                      aria-label="Next day"
                      className="w-6 h-6 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer shrink-0 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-fixed font-semibold shrink-0">
                  {selectedDateEvents.length + selectedDateTasks.length} items
                </span>
              </div>

              {selectedDateOverlaps.size > 0 && (
                <div className="p-3 rounded-xl bg-tertiary-fixed/40 border border-tertiary/20 flex items-start gap-2.5 text-xs text-tertiary">
                  <span className="material-symbols-outlined text-[18px] shrink-0 text-tertiary">
                    warning
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold">These events overlap.</span>
                    <span className="text-on-surface-variant">
                      Check times below and adjust when convenient.
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Events ({selectedDateEvents.length})
                </span>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-xs text-outline py-1">Your schedule is clear.</p>
                ) : (
                  selectedDateEvents.map((evt) => {
                    const isOverlapping = selectedDateOverlaps.has(evt.id);
                    return (
                      <div
                        key={evt.id}
                        onClick={() => setViewingEvent(evt)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isOverlapping
                            ? 'bg-tertiary-fixed/20 border-tertiary/30'
                            : 'bg-surface-container-low/60 border-outline-variant/15 hover:bg-surface-container-low'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-primary flex items-center gap-1">
                            {evt.isRecurring && (
                              <span className="material-symbols-outlined text-[13px]">sync</span>
                            )}
                            {evt.isAllDay ? 'All day' : evt.time || evt.startTime || 'Scheduled'}
                          </span>
                          {evt.area && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-highest text-on-surface-variant">
                              {evt.area}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-on-surface">{evt.title}</h4>
                        {evt.recurring && (
                          <span className="text-[11px] text-secondary font-medium">
                            🔄 {evt.recurring}
                          </span>
                        )}
                        {(() => {
                          const relTasks = findRelatedTasksForEvent(evt, tasks, selectedDate);
                          if (relTasks.length === 0) return null;
                          return (
                            <div className="mt-1 pt-1.5 border-t border-outline-variant/15 flex flex-col gap-1">
                              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                                Related task{relTasks.length > 1 ? 's' : ''}:
                              </span>
                              {relTasks.map((rt) => (
                                <span key={rt.id} className="text-[11px] text-on-surface-variant truncate">
                                  • {rt.title}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-col gap-2.5 pt-2 border-t border-outline-variant/15">
                <span className="text-xs font-semibold text-outline uppercase tracking-wider">
                  Tasks Due ({selectedDateTasks.length})
                </span>
                {selectedDateTasks.length === 0 ? (
                  <p className="text-xs text-outline py-1">No tasks due on this date.</p>
                ) : (
                  selectedDateTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low/40 hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleTask(t.id)}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            t.completed
                              ? 'bg-secondary border-secondary text-on-secondary'
                              : 'border-outline-variant hover:border-secondary'
                          }`}
                        >
                          {t.completed && (
                            <span className="material-symbols-outlined text-[11px]">check</span>
                          )}
                        </button>
                        <span
                          className={`text-xs font-medium truncate ${
                            t.completed ? 'line-through text-outline' : 'text-on-surface'
                          }`}
                        >
                          {t.isRecurring && '🔄 '}{t.title}
                        </span>
                      </div>
                      {t.time && <span className="text-[11px] text-outline">{t.time}</span>}
                    </div>
                  ))
                )}
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddModal(selectedDate)}
                className="w-full py-2 rounded-xl border border-dashed border-outline-variant hover:bg-surface-container-low text-xs font-semibold text-primary transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add event for {formatDisplayDate(selectedDate)}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 sm:p-6 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between pb-3 mb-2 min-w-[640px] flex-wrap gap-2 border-b border-outline-variant/15">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevWeek}
                aria-label="Previous week"
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <h2 className="text-base sm:text-lg font-semibold text-on-surface">
                Week of {currentWeekDays[0].monthName} {currentWeekDays[0].num} –{' '}
                {currentWeekDays[6].monthName} {currentWeekDays[6].num}, {currentWeekDays[6].year}
              </h2>
              <button
                type="button"
                onClick={handleNextWeek}
                aria-label="Next week"
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-primary border border-outline-variant/20 hover:border-outline-variant/40 transition-all cursor-pointer shadow-xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleOpenAddModal(selectedDate)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>Event</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 min-w-[640px]">
            {currentWeekDays.map((d) => {
              const isToday = d.iso === todayISO;
              const dayEvts = getEventsForDate(d.iso);
              const dayTsks = calendarTasks.filter((t) => t.normalizedDate === d.iso);
              const overlaps = getOverlappingEventIds(d.iso);
              const isSelected = d.iso === selectedDate;

              return (
                <div
                  key={d.iso}
                  onClick={() => handleSelectDate(d.iso)}
                  className={`flex flex-col rounded-xl border p-2.5 min-h-[360px] gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-secondary-fixed/40 border-secondary/50 ring-2 ring-secondary/40 shadow-sm'
                      : isToday
                      ? 'bg-secondary-fixed/20 border-secondary/30 ring-1 ring-secondary/30'
                      : 'bg-surface-container-low/40 border-outline-variant/15 hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant/15">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-outline uppercase">
                        {d.name}
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          isToday ? 'text-secondary' : 'text-on-surface'
                        }`}
                      >
                        {d.num}
                      </span>
                    </div>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-secondary" title="Today"></span>
                    )}
                  </div>
                  {overlaps.size > 0 && (
                    <div className="px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed text-[9px] font-semibold truncate">
                      Overlap
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 flex-1">
                    {dayEvts
                      .filter((e) => e.isAllDay)
                      .map((e) => (
                        <div
                          key={e.id}
                          onClick={() => setViewingEvent(e)}
                          className="p-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed font-medium text-[10px] cursor-pointer truncate shadow-xs"
                        >
                          ⭐ {e.title}
                        </div>
                      ))}
                    {dayEvts
                      .filter((e) => !e.isAllDay)
                      .map((e) => (
                        <div
                          key={e.id}
                          onClick={() => setViewingEvent(e)}
                          className="p-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/40 text-on-surface text-[11px] cursor-pointer flex flex-col gap-0.5 shadow-xs"
                        >
                          <span className="text-[9px] font-semibold text-primary flex items-center gap-0.5">
                            {e.isRecurring && <span className="material-symbols-outlined text-[10px]">sync</span>}
                            {e.startTime || e.time || ''}
                          </span>
                          <span className="font-medium truncate">{e.title}</span>
                        </div>
                      ))}
                    {dayTsks.map((t) => (
                      <div
                        key={t.id}
                        className="p-1.5 rounded-lg bg-surface-container-high/60 text-on-surface-variant text-[10px] flex items-center gap-1.5"
                      >
                        <span className="text-secondary font-bold">✓</span>
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(d.iso)}
                    className="w-full py-1 text-[11px] text-outline hover:text-primary transition-colors text-center cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AGENDA VIEW */}
      {viewMode === 'agenda' && (
        <div className="flex flex-col gap-5 max-w-3xl mx-auto w-full">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous month"
                aria-label="Previous month"
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="text-sm font-semibold text-on-surface">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next month"
                aria-label="Next month"
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-container-low hover:bg-surface-container text-primary border border-outline-variant/20 transition-all cursor-pointer shadow-xs"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleOpenAddModal(selectedDate)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>Event</span>
              </button>
            </div>
          </div>

          {agendaDates.every((item) => item.events.length === 0 && item.tasks.length === 0) ? (
            <div className="py-12 px-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[24px]">calendar_today</span>
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h2 className="text-base sm:text-lg font-semibold text-on-surface">
                  Your schedule is clear.
                </h2>
                <p className="text-xs sm:text-sm text-outline">
                  Add an event or important date to start planning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAddModal(selectedDate)}
                className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm hover:bg-primary-container transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add event</span>
              </button>
            </div>
          ) : (
            agendaDates.map((item) => {
              if (item.events.length === 0 && item.tasks.length === 0) return null;
              return (
                <div
                  key={item.dateStr}
                  className="flex flex-col bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4 sm:p-5 shadow-sm gap-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-semibold text-on-surface">
                        {item.displayDate}
                      </span>
                      <span className="text-xs text-outline">({item.fullDate})</span>
                    </div>
                    {item.hasOverlap && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                        These events overlap
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {item.events.map((evt) => (
                      <div
                        key={evt.id}
                        onClick={() => setViewingEvent(evt)}
                        className="flex items-start justify-between p-3 rounded-xl bg-surface-container-low/60 hover:bg-surface-container-low transition-colors cursor-pointer gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-on-surface truncate">
                              {evt.title}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-outline mt-0.5 flex-wrap">
                              <span className="text-primary font-medium">
                                {evt.isAllDay ? 'All day' : evt.time || evt.startTime || 'Time unset'}
                              </span>
                              {evt.area && <span>• {evt.area}</span>}
                              {evt.recurring && (
                                <span className="text-secondary font-medium flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[13px]">sync</span>
                                  {evt.recurring}
                                </span>
                              )}
                              {evt.location && <span>• {evt.location}</span>}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(evt);
                          }}
                          className="p-1 rounded-lg text-outline hover:text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      </div>
                    ))}
                    {item.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/30 hover:bg-surface-container-low transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleTask(t.id)}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                              t.completed
                                ? 'bg-secondary border-secondary text-on-secondary'
                                : 'border-outline-variant hover:border-secondary'
                            }`}
                          >
                            {t.completed && (
                              <span className="material-symbols-outlined text-[11px]">check</span>
                            )}
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span
                              className={`text-xs sm:text-sm font-medium truncate ${
                                t.completed ? 'line-through text-outline' : 'text-on-surface'
                              }`}
                            >
                              {t.title}
                            </span>
                            <span className="text-[11px] text-outline">
                              Task • {t.area} {t.recurring && `• ${t.recurring}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* EVENT DETAIL MODAL */}
      {viewingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-semibold">
                {viewingEvent.area || 'Event'}
              </span>
              <button
                type="button"
                onClick={() => setViewingEvent(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-semibold text-on-surface">{viewingEvent.title}</h2>
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <span className="material-symbols-outlined text-[15px]">schedule</span>
                <span>
                  {formatFullDate(viewingEvent.date)} •{' '}
                  {viewingEvent.isAllDay
                    ? 'All day event'
                    : viewingEvent.time || viewingEvent.startTime || 'Time unset'}
                </span>
              </div>
            </div>
            {viewingEvent.location && (
              <div className="text-xs text-outline flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                <span>{viewingEvent.location}</span>
              </div>
            )}
            {viewingEvent.recurring && (
              <div className="text-xs text-secondary flex items-center justify-between gap-1.5 p-2 rounded-xl bg-surface-container-low">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">sync</span>
                  <span>{viewingEvent.recurring}</span>
                </div>
                {onStopRecurringEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      onStopRecurringEvent(viewingEvent.id);
                      setViewingEvent(null);
                    }}
                    className="text-xs text-error hover:underline cursor-pointer"
                  >
                    Stop repeating
                  </button>
                )}
              </div>
            )}
            {viewingEvent.notes && (
              <div className="p-3 rounded-xl bg-surface-container-low text-xs text-on-surface-variant leading-relaxed">
                {viewingEvent.notes}
              </div>
            )}
            {(() => {
              const relTasks = findRelatedTasksForEvent(viewingEvent, tasks);
              if (relTasks.length === 0) return null;
              return (
                <div className="p-3 rounded-xl bg-secondary-container/25 border border-secondary/25 flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                    Related tasks ({relTasks.length})
                  </span>
                  {relTasks.map((rt) => (
                    <div key={rt.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-on-surface font-medium truncate">• {rt.title}</span>
                      <button
                        type="button"
                        onClick={() => onToggleTask(rt.id)}
                        className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-semibold cursor-pointer"
                      >
                        Mark done
                      </button>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="flex items-center justify-between pt-3 border-t border-outline-variant/15">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteEvent(viewingEvent.id);
                    setViewingEvent(null);
                  }}
                  className="text-xs text-error hover:underline font-medium cursor-pointer"
                >
                  Delete event
                </button>
                {viewingEvent.recurring && onSkipEvent && (
                  <button
                    type="button"
                    onClick={() => {
                      onSkipEvent(viewingEvent.id, viewingEvent.date);
                      setViewingEvent(null);
                    }}
                    className="text-xs text-outline hover:text-on-surface font-medium cursor-pointer"
                  >
                    Skip occurrence
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingEvent(null)}
                  className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(viewingEvent)}
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveModal}
            className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <h2 className="text-lg font-semibold text-on-surface">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Edit Scope */}
            {editingEvent && (editingEvent.isRecurring || editingEvent.recurrenceRule || editingEvent.recurring) && (
              <div className="p-3 rounded-xl bg-secondary-fixed/30 border border-secondary/20 flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-on-surface">This is a recurring event:</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-on-surface">
                    <input
                      type="radio"
                      name="eventEditScope"
                      checked={editScope === 'series'}
                      onChange={() => setEditScope('series')}
                      className="accent-secondary"
                    />
                    <span>All future occurrences (series)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-on-surface">
                    <input
                      type="radio"
                      name="eventEditScope"
                      checked={editScope === 'this'}
                      onChange={() => setEditScope('this')}
                      className="accent-secondary"
                    />
                    <span>This occurrence only</span>
                  </label>
                </div>
              </div>
            )}

            {/* Overlap Warning inside form */}
            {formHasConflict && (
              <div className="p-3 rounded-xl bg-tertiary-fixed/40 border border-tertiary/20 flex items-center gap-2 text-xs text-tertiary">
                <span className="material-symbols-outlined text-[16px] text-tertiary">warning</span>
                <span>These events overlap. You can still save if intentional.</span>
              </div>
            )}

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Event title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. Strategy sync, Doctor visit..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                autoFocus
                required
              />
            </div>

            {/* Date & All-Day Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-on-surface">
                  Date <span className="text-error">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                  required
                />
              </div>
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-container-low/60 hover:bg-surface-container-low cursor-pointer border border-outline-variant/20 text-xs text-on-surface select-none">
                <input
                  type="checkbox"
                  checked={formIsAllDay}
                  onChange={(e) => setFormIsAllDay(e.target.checked)}
                  className="rounded accent-secondary w-4 h-4 cursor-pointer"
                />
                <span className="font-medium">All-day / Important date</span>
              </label>
            </div>

            {/* Start / End Time */}
            {!formIsAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-outline">Start time</label>
                  <input
                    type="text"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    placeholder="e.g. 10:00 AM"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-outline">End time</label>
                  <input
                    type="text"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    placeholder="e.g. 11:00 AM"
                    className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                  />
                </div>
              </div>
            )}

            {/* Area */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Area (optional)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {AREA_OPTIONS.map((area) => {
                  const isSelected = formArea === area.name;
                  return (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => setFormArea(area.name)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-medium border flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
                        isSelected
                          ? 'bg-secondary-container text-on-secondary-fixed border-secondary/40 shadow-sm'
                          : 'bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container'
                      }`}
                    >
                      <span>{area.emoji}</span>
                      <span className="truncate">{area.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RECURRENCE */}
            <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-secondary">sync</span>
                  <span className="text-xs font-semibold text-on-surface">Repeat</span>
                </div>
                <input
                  type="checkbox"
                  checked={isRepeatEnabled}
                  onChange={(e) => setIsRepeatEnabled(e.target.checked)}
                  className="rounded accent-secondary w-4 h-4 cursor-pointer"
                />
              </label>

              {isRepeatEnabled && (
                <div className="p-3.5 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 flex flex-col gap-3 text-xs">
                  <div className="grid grid-cols-5 gap-1.5">
                    {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRepeatFreq(freq)}
                        className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                          repeatFreq === freq
                            ? 'bg-secondary-container text-on-secondary-fixed font-semibold shadow-xs'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                      >
                        {freq === 'daily'
                          ? 'Daily'
                          : freq === 'weekly'
                          ? 'Weekly'
                          : freq === 'monthly'
                          ? 'Monthly'
                          : freq === 'yearly'
                          ? 'Yearly'
                          : 'Custom'}
                      </button>
                    ))}
                  </div>

                  {repeatFreq === 'weekly' && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-[11px] text-outline">Repeat on</span>
                      <div className="flex items-center justify-between gap-1">
                        {WEEKDAY_KEYS.map(({ name, day }) => {
                          const isSelected = selectedWeekdays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                if (selectedWeekdays.includes(day)) {
                                  if (selectedWeekdays.length > 1) {
                                    setSelectedWeekdays(selectedWeekdays.filter((d) => d !== day));
                                  }
                                } else {
                                  setSelectedWeekdays([...selectedWeekdays, day].sort());
                                }
                              }}
                              className={`w-9 h-8 rounded-lg font-medium text-xs flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-secondary text-on-secondary font-bold shadow-xs'
                                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                              }`}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {repeatFreq === 'custom' && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-outline">Repeat every</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={customInterval}
                        onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-16 px-2 py-1 rounded-lg bg-surface-container text-center font-semibold text-on-surface border border-outline-variant/30"
                      />
                      <select
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value as any)}
                        className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer"
                      >
                        <option value="days">days</option>
                        <option value="weeks">weeks</option>
                        <option value="months">months</option>
                        <option value="years">years</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/15 text-xs">
                    <span className="text-outline">Ends</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={endOption}
                        onChange={(e) => setEndOption(e.target.value as any)}
                        className="px-2 py-1 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30 cursor-pointer"
                      >
                        <option value="never">Never</option>
                        <option value="on_date">On date...</option>
                      </select>
                      {endOption === 'on_date' && (
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="px-2 py-1 rounded-lg bg-surface-container text-on-surface border border-outline-variant/30"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location & Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Location (optional)</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="e.g. Office, Room 410, Zoom"
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Notes (optional)</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Additional details, preparation reminders..."
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
              >
                {editingEvent ? 'Save changes' : 'Create event'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
