import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, CalendarEvent, PersonalMemory } from '../types';
import {
  parseNaturalLanguageTask,
  parseMagicCapture,
} from '../utils/naturalLanguageParser';
import {
  formatDisplayDate,
  normalizeDate,
  getTodayString,
} from '../utils/dateUtils';
import { formatRecurrenceLabel, isEventOccurringOnDate } from '../utils/recurringUtils';
import {
  generateDailyBrief,
  getWhatShouldIDoNowRecommendations,
} from '../utils/aiAssistant';
import {
  getSmartReminders,
  computeLifeSnapshot,
  findRelatedTasksForEvent,
  isTaskOverdue,
  isTaskDueToday,
} from '../utils/reminderIntelligence';
import { FirebaseUser } from '../firebase';

interface TodayViewProps {
  tasks: Task[];
  events: CalendarEvent[];
  memories?: PersonalMemory[];
  user?: FirebaseUser | null;
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onAddEvent?: (event: Omit<CalendarEvent, 'id'>) => void;
  onAddMemory?: (memory: Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onToggleTask: (id: string) => void;
  onToggleFocus: (id: string) => void;
  onEditTask?: (task: Task) => void;
  onDeleteTask?: (id: string) => void;
  onSkipTask?: (id: string) => void;
  onOpenMagicCapture?: (initialText: string) => void;
  onOpenWeeklyReview?: () => void;
  onNavigateToTab?: (tab: 'today' | 'tasks' | 'calendar' | 'areas' | 'ai') => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  tasks,
  events,
  memories = [],
  user,
  onAddTask,
  onToggleTask,
  onToggleFocus,
  onEditTask,
  onOpenMagicCapture,
  onOpenWeeklyReview,
  onNavigateToTab,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [briefVariant, setBriefVariant] = useState<number>(0);
  const [isRefreshingBrief, setIsRefreshingBrief] = useState<boolean>(false);
  const [showWhatNow, setShowWhatNow] = useState<boolean>(false);
  const [startedTaskId, setStartedTaskId] = useState<string | null>(null);
  const [editingTaskInline, setEditingTaskInline] = useState<Task | null>(null);
  const [inlineEditTitle, setInlineEditTitle] = useState('');
  const [inlineEditDue, setInlineEditDue] = useState('');
  const [inlineEditTime, setInlineEditTime] = useState('');
  const [dismissedReminders, setDismissedReminders] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        localStorage.getItem('lifedesk_notifications_enabled') === 'true'
      );
    } catch {
      return false;
    }
  });

  const [showFirstUseGuidance, setShowFirstUseGuidance] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lifedesk_dismissed_welcome') !== 'true';
    } catch {
      return true;
    }
  });

  const quickInputRef = useRef<HTMLInputElement>(null);
  const todayISO = getTodayString();

  const handleDismissGuidance = () => {
    setShowFirstUseGuidance(false);
    try {
      localStorage.setItem('lifedesk_dismissed_welcome', 'true');
    } catch {
      // ignore
    }
  };

  // Dynamic greeting based on current local time
  const [greeting, setGreeting] = useState<'Good morning' | 'Good afternoon' | 'Good evening'>('Good morning');
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const hours = now.getHours();
    if (hours >= 5 && hours < 12) {
      setGreeting('Good morning');
    } else if (hours >= 12 && hours < 17) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    setFormattedDate(now.toLocaleDateString('en-US', options));
  }, []);

  // Filter Active vs Completed tasks for today (including overdue items so nothing slips through)
  const activeTodayTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.completed &&
          (isTaskDueToday(t, todayISO) || isTaskOverdue(t, todayISO) || t.isFocus)
      ),
    [tasks, todayISO]
  );

  const completedTodayTasks = useMemo(
    () => tasks.filter((t) => t.completed),
    [tasks]
  );

  // Today's Focus: up to 3 most important active items
  const focusTasks = useMemo(
    () =>
      activeTodayTasks
        .filter((t) => t.isFocus || t.priority === 'high')
        .slice(0, 3),
    [activeTodayTasks]
  );

  const effectiveFocusTasks = useMemo(
    () =>
      focusTasks.length > 0
        ? focusTasks
        : activeTodayTasks.slice(0, Math.min(activeTodayTasks.length, 3)),
    [focusTasks, activeTodayTasks]
  );

  // AI Daily Brief (Improvement 1)
  const dailyBriefData = useMemo(
    () => generateDailyBrief(tasks, events, memories, greeting, briefVariant),
    [tasks, events, memories, greeting, briefVariant]
  );

  const handleRefreshBrief = () => {
    setIsRefreshingBrief(true);
    setTimeout(() => {
      setBriefVariant((v) => v + 1);
      setIsRefreshingBrief(false);
    }, 180);
  };

  // "What should I do now?" Recommendations (Improvement 2)
  const whatNowData = useMemo(
    () => getWhatShouldIDoNowRecommendations(tasks, events),
    [tasks, events]
  );

  // Life Snapshot (Improvement 5)
  const lifeSnapshot = useMemo(
    () => computeLifeSnapshot(tasks, events, memories),
    [tasks, events, memories]
  );

  // Smart Reminders (Improvement 6)
  const smartReminders = useMemo(
    () => getSmartReminders(tasks, events, dismissedReminders),
    [tasks, events, dismissedReminders]
  );

  // Optional non-spammy browser notification for high-urgency due_soon reminder
  useEffect(() => {
    if (!notificationsEnabled || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const urgentDueSoon = smartReminders.find((r) => r.kind === 'due_soon');
    if (!urgentDueSoon) return;

    try {
      const notifiedKey = `lifedesk_notified_${urgentDueSoon.id}`;
      if (!sessionStorage.getItem(notifiedKey)) {
        sessionStorage.setItem(notifiedKey, 'true');
        new Notification('LIFNIVO AI Reminder', {
          body: `${urgentDueSoon.title} — ${urgentDueSoon.subtitle}`,
          icon: '/favicon.png',
        });
      }
    } catch {
      // ignore if browser blocks Notification constructor
    }
  }, [smartReminders, notificationsEnabled]);

  const handleToggleBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      try {
        localStorage.setItem('lifedesk_notifications_enabled', 'false');
      } catch {
        // ignore
      }
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('lifedesk_notifications_enabled', 'true');
      }
    } catch {
      // ignore
    }
  };

  // Upcoming items with Calendar + Task Intelligence (Improvement 7)
  const comingUpItems = useMemo(() => {
    const todayEvts = events.filter((e) =>
      isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates)
    );
    const futureEvts = events.filter(
      (e) => !isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates)
    );

    const orderedEvents = [...todayEvts, ...futureEvts];

    return orderedEvents
      .map((e) => {
        const relatedTasks = findRelatedTasksForEvent(e, tasks);
        return {
          id: e.id,
          isEvent: true,
          title: e.title,
          date: isEventOccurringOnDate(e.date, todayISO, e.recurrenceRule, e.skippedDates)
            ? 'Today'
            : formatDisplayDate(e.date),
          time: e.isAllDay ? 'All day' : e.time || e.startTime || '',
          area: e.area,
          relatedTasks,
        };
      })
      .concat(
        tasks
          .filter(
            (t) =>
              !t.completed &&
              t.dueDate &&
              !isTaskDueToday(t, todayISO) &&
              !isTaskOverdue(t, todayISO)
          )
          .map((t) => ({
            id: `task-up-${t.id}`,
            isEvent: false,
            title: t.title,
            date: formatDisplayDate(t.dueDate || 'Soon'),
            time: t.time || '',
            area: t.area,
            relatedTasks: [] as Task[],
          }))
      )
      .slice(0, 5);
  }, [events, tasks, todayISO]);

  // Recurring items: only if user has recurring tasks or events
  const recurringItems = useMemo(
    () =>
      tasks
        .filter((t) => !t.completed && Boolean(t.recurring || t.isRecurring || t.recurrenceRule))
        .map((t) => ({
          id: `rec-t-${t.id}`,
          title: t.title,
          recurring:
            t.recurring ||
            (t.recurrenceRule ? formatRecurrenceLabel(t.recurrenceRule) : 'Recurring'),
          area: t.area,
        }))
        .concat(
          events
            .filter((e) => Boolean(e.recurring || e.isRecurring || e.recurrenceRule))
            .map((e) => ({
              id: `rec-e-${e.id}`,
              title: e.title,
              recurring:
                e.recurring ||
                (e.recurrenceRule ? formatRecurrenceLabel(e.recurrenceRule) : 'Recurring'),
              area: e.area || 'Personal',
            }))
        ),
    [tasks, events]
  );

  // Handle Quick Capture submission with Magic Capture intelligence (Improvement 3 & 4)
  const handleQuickCapture = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;

    const magic = parseMagicCapture(trimmed);
    if (magic.requiresConfirmation && onOpenMagicCapture) {
      onOpenMagicCapture(trimmed);
      setQuickInput('');
      return;
    }

    const parsed = parseNaturalLanguageTask(trimmed);
    onAddTask(parsed);
    setQuickInput('');
  };

  const handleRescheduleTask = (task: Task, newDueDate: string) => {
    if (!onEditTask) return;
    onEditTask({
      ...task,
      dueDate: newDueDate,
    });
  };

  const handleOpenInlineEdit = (task: Task) => {
    setEditingTaskInline(task);
    setInlineEditTitle(task.title);
    setInlineEditDue(task.dueDate || 'Today');
    setInlineEditTime(task.time || '');
  };

  const handleSaveInlineEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskInline || !onEditTask || !inlineEditTitle.trim()) return;
    onEditTask({
      ...editingTaskInline,
      title: inlineEditTitle.trim(),
      dueDate: inlineEditDue.trim() || 'Today',
      time: inlineEditTime.trim() || undefined,
    });
    setEditingTaskInline(null);
  };

  const hasNoData = tasks.length === 0 && events.length === 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 flex flex-col gap-7 md:gap-9">
      {/* TODAY HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span className="text-[12px] font-semibold uppercase tracking-wider text-secondary">
              Present & Settled
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-[2.5rem] font-semibold text-on-surface tracking-tight">
            {greeting}{user?.displayName ? `, ${user.displayName.trim().split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm sm:text-base font-normal text-outline mt-0.5">
            {formattedDate || 'Today'}
          </p>
        </div>

        {/* Action Pills: What should I do now? + Weekly Review */}
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowWhatNow((prev) => !prev)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
              showWhatNow
                ? 'bg-primary text-on-primary'
                : 'bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed'
            }`}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bolt
            </span>
            <span>What should I do now?</span>
          </button>

          {onOpenWeeklyReview && (
            <button
              type="button"
              onClick={onOpenWeeklyReview}
              className="px-3.5 py-2 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/25 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">
                event_note
              </span>
              <span>Weekly Review</span>
            </button>
          )}
        </div>
      </header>

      {/* IMPROVEMENT 1 — AI DAILY BRIEF */}
      <section
        aria-label="AI Daily Brief"
        className="w-full bg-surface-container-low rounded-2xl p-4 sm:p-5 border border-outline-variant/20 shadow-xs flex flex-col gap-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary text-[19px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <h2 className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">
              AI Daily Brief
            </h2>
          </div>
          {!dailyBriefData.isClearDay && (
            <button
              type="button"
              onClick={handleRefreshBrief}
              disabled={isRefreshingBrief}
              className="text-xs text-outline hover:text-on-surface flex items-center gap-1 transition-colors cursor-pointer"
              title="Refresh daily brief"
            >
              <span
                className={`material-symbols-outlined text-[15px] ${
                  isRefreshingBrief ? 'animate-spin' : ''
                }`}
              >
                refresh
              </span>
              <span>Refresh</span>
            </button>
          )}
        </div>

        <p className="text-sm sm:text-[0.95rem] text-on-surface leading-relaxed">
          {isRefreshingBrief ? (
            <span className="text-outline animate-pulse">
              Updating your daily brief...
            </span>
          ) : (
            dailyBriefData.brief
          )}
        </p>

        {dailyBriefData.relevantMemory && (
          <div className="mt-1 pt-2 border-t border-outline-variant/15 flex items-center gap-2 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-secondary text-[15px]">
              psychology
            </span>
            <span className="truncate">
              <strong>Related memory:</strong> {dailyBriefData.relevantMemory.title} —{' '}
              {dailyBriefData.relevantMemory.content}
            </span>
          </div>
        )}
      </section>

      {/* IMPROVEMENT 2 — "WHAT SHOULD I DO NOW?" PANEL */}
      {showWhatNow && (
        <section
          aria-label="What should I do now recommendations"
          className="w-full bg-surface-container-lowest rounded-2xl border border-primary/25 p-5 sm:p-6 shadow-md flex flex-col gap-4 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-3 border-b border-outline-variant/15 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  bolt
                </span>
              </div>
              <div className="flex flex-col">
                <h2 className="text-sm sm:text-base font-semibold text-on-surface">
                  What should I do now?
                </h2>
                <p className="text-xs text-outline">{whatNowData.summaryContext}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowWhatNow(false)}
              className="p-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
              aria-label="Close recommendations"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {whatNowData.recommendations.length === 0 ? (
            <div className="py-3 text-xs sm:text-sm text-outline flex items-center justify-between">
              <span>No pending tasks right now. Add a task below whenever you are ready.</span>
              <button
                type="button"
                onClick={() => {
                  setShowWhatNow(false);
                  quickInputRef.current?.focus();
                }}
                className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer"
              >
                + Add task
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {whatNowData.recommendations.map((rec, idx) => {
                const isStarted = startedTaskId === rec.task.id;
                return (
                  <div
                    key={rec.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      idx === 0
                        ? 'bg-secondary-container/25 border-secondary/30'
                        : 'bg-surface-container-low/50 border-outline-variant/20'
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-semibold text-on-surface">
                          {rec.headline}
                        </span>
                        {rec.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-secondary">
                            {rec.badge}
                          </span>
                        )}
                        {isStarted && (
                          <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-[10px] font-semibold">
                            In progress
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant">{rec.reason}</p>
                    </div>

                    {/* Practical Actions: Start task, Open task, Reschedule, Mark complete */}
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setStartedTaskId(rec.task.id);
                          if (!rec.task.isFocus) {
                            onToggleFocus(rec.task.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                        <span>{isStarted ? 'Focused' : 'Start task'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenInlineEdit(rec.task)}
                        className="px-2.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-medium transition-colors cursor-pointer"
                      >
                        Open task
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRescheduleTask(rec.task, 'Tomorrow')}
                        className="px-2.5 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-medium transition-colors cursor-pointer"
                        title="Reschedule to Tomorrow"
                      >
                        Reschedule
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleTask(rec.task.id)}
                        className="px-2.5 py-1.5 rounded-full bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Mark complete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* HELPFUL FIRST-USE GUIDANCE */}
      {showFirstUseGuidance && (
        <section
          aria-label="Welcome guidance"
          className="w-full bg-surface-container-low/80 rounded-2xl border border-secondary/25 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[20px]">waving_hand</span>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-on-surface">
                Welcome to LIFNIVO.
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Start by adding something you need to remember, finish, schedule, or organize.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => quickInputRef.current?.focus()}
              className="px-3.5 py-1.5 rounded-full bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Add a task</span>
            </button>
            <button
              type="button"
              onClick={handleDismissGuidance}
              aria-label="Dismiss welcome guidance"
              className="px-3 py-1.5 rounded-full text-xs font-medium text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </section>
      )}

      {/* QUICK CAPTURE WITH MAGIC CAPTURE SUPPORT (Improvement 3 & 4) */}
      <section aria-label="Quick capture" className="w-full">
        <form
          onSubmit={handleQuickCapture}
          className="relative w-full rounded-2xl sm:rounded-full bg-surface-container-lowest border border-outline-variant/30 shadow-sm hover:shadow-md focus-within:shadow-md focus-within:border-primary/40 transition-all p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="flex items-center gap-3 pl-3 sm:pl-4 flex-1">
            <span className="material-symbols-outlined text-outline text-[22px]">
              add_circle
            </span>
            <input
              ref={quickInputRef}
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder='What do you need to remember? (e.g. "Tomorrow dentist at 5 and remind me to buy toothpaste before that")'
              className="w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline focus:outline-none py-1.5"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 pr-1">
            {onOpenMagicCapture && (
              <button
                type="button"
                onClick={() => {
                  onOpenMagicCapture(quickInput);
                  setQuickInput('');
                }}
                className="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium hover:bg-secondary-container hover:text-on-secondary-fixed transition-colors cursor-pointer inline-flex items-center gap-1"
                title="Open Magic Capture to review or add multiple items"
              >
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Magic Capture</span>
              </button>
            )}
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                quickInput.trim()
                  ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-container cursor-pointer'
                  : 'bg-surface-container-high text-outline cursor-not-allowed opacity-60'
              }`}
            >
              <span>Add</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </form>
      </section>

      {/* IMPROVEMENT 6 — SMART REMINDER INTELLIGENCE */}
      {smartReminders.length > 0 && (
        <section
          aria-label="Smart Reminders"
          className="w-full bg-surface-container-lowest rounded-2xl border border-secondary/30 p-4 sm:p-5 shadow-xs flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">
                notifications_active
              </span>
              <h2 className="text-xs sm:text-sm font-semibold text-on-surface">
                Smart Reminders
              </h2>
            </div>
            {typeof Notification !== 'undefined' && (
              <button
                type="button"
                onClick={handleToggleBrowserNotifications}
                className="text-[11px] text-outline hover:text-on-surface flex items-center gap-1 cursor-pointer"
                title="Toggle browser notifications for approaching due times"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {notificationsEnabled ? 'notifications' : 'notifications_off'}
                </span>
                <span>{notificationsEnabled ? 'Alerts on' : 'Enable alerts'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {smartReminders.map((rem) => {
              const targetTask = rem.taskId
                ? tasks.find((t) => t.id === rem.taskId)
                : undefined;

              return (
                <div
                  key={rem.id}
                  className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/20 flex items-start justify-between gap-2.5"
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          rem.urgency === 'high'
                            ? 'bg-tertiary'
                            : rem.urgency === 'medium'
                            ? 'bg-secondary'
                            : 'bg-primary'
                        }`}
                      ></span>
                      <span className="text-xs sm:text-sm font-semibold text-on-surface truncate">
                        {rem.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-outline mt-0.5">
                      {rem.subtitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {targetTask && (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleTask(targetTask.id)}
                          className="px-2 py-1 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-semibold hover:bg-secondary-fixed cursor-pointer"
                          title="Mark complete"
                        >
                          Done
                        </button>
                        {onEditTask && (
                          <button
                            type="button"
                            onClick={() => handleRescheduleTask(targetTask, 'Tomorrow')}
                            className="px-2 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] hover:bg-surface-container-high cursor-pointer"
                            title="Move to Tomorrow"
                          >
                            Tomorrow
                          </button>
                        )}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedReminders((prev) => [...prev, rem.id])
                      }
                      className="p-1 rounded-full text-outline hover:text-on-surface cursor-pointer"
                      title="Dismiss reminder"
                      aria-label={`Dismiss reminder for ${rem.title}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        close
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* NEW USER EXPERIENCE: CLEAR DAY EMPTY STATE */}
      {hasNoData ? (
        <section
          aria-label="Empty day state"
          className="w-full bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-4 shadow-sm"
        >
          <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-fixed">
            <span className="material-symbols-outlined text-[28px]">spa</span>
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <h2 className="text-xl sm:text-2xl font-semibold text-on-surface tracking-tight">
              What matters today?
            </h2>
            <p className="text-sm text-on-surface-variant">
              Add something you need to remember, finish, or schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={() => quickInputRef.current?.focus()}
            className="mt-2 px-6 py-2.5 rounded-full bg-primary text-on-primary font-medium text-sm shadow-sm hover:bg-primary-container transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add something</span>
          </button>
        </section>
      ) : (
        /* STANDARD TODAY CONTENT */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Left / Primary Column (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col gap-7">
            {/* TODAY'S FOCUS */}
            {effectiveFocusTasks.length > 0 && (
              <section
                aria-label="Today's focus"
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-baseline justify-between pb-1 border-b border-outline-variant/15">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                    <h2 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight">
                      Today&apos;s focus
                    </h2>
                  </div>
                  <span className="text-xs text-outline">
                    {effectiveFocusTasks.length} priority item
                    {effectiveFocusTasks.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {effectiveFocusTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="group flex items-start gap-3.5 p-3 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low transition-all"
                    >
                      <span className="w-5 h-5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm sm:text-base font-medium text-on-surface truncate">
                            {task.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {onEditTask && (
                              <button
                                type="button"
                                onClick={() => handleOpenInlineEdit(task)}
                                className="text-xs px-2 py-1 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                                title="Open or reschedule task"
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onToggleTask(task.id)}
                              className="text-xs px-2.5 py-1 rounded-full bg-surface-container hover:bg-secondary-container hover:text-on-secondary-fixed text-on-surface-variant transition-colors cursor-pointer shrink-0"
                            >
                              Mark done
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-outline flex-wrap">
                          {isTaskOverdue(task, todayISO) && (
                            <span className="text-error font-semibold">
                              Overdue ({formatDisplayDate(task.dueDate || '')})
                            </span>
                          )}
                          {task.time && (
                            <span className="flex items-center gap-1 text-on-surface-variant font-medium">
                              <span className="material-symbols-outlined text-[13px]">
                                schedule
                              </span>
                              {task.time}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-surface-container font-medium text-[11px] text-on-surface-variant">
                            {task.area}
                          </span>
                          {task.priority === 'high' && (
                            <span className="text-tertiary font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                              High priority
                            </span>
                          )}
                          {task.notes && (
                            <span className="text-secondary font-medium flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">link</span>
                              {task.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TODAY'S TASKS */}
            <section
              aria-label="Today's tasks"
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-baseline justify-between pb-1 border-b border-outline-variant/15">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight">
                    Today&apos;s tasks
                  </h2>
                  <span className="text-xs text-outline">
                    {activeTodayTasks.length} active
                  </span>
                </div>
              </div>

              {activeTodayTasks.length === 0 ? (
                <div className="py-6 text-center flex flex-col items-center gap-1.5">
                  <span className="text-sm text-outline">What matters today?</span>
                  <button
                    type="button"
                    onClick={() => quickInputRef.current?.focus()}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    + Add a task
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeTodayTasks.map((task) => {
                    const overdue = isTaskOverdue(task, todayISO);
                    return (
                      <div
                        key={task.id}
                        className="group flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-all duration-150 gap-3 border border-transparent hover:border-outline-variant/20"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onToggleTask(task.id)}
                            aria-label={`Complete task ${task.title}`}
                            className="w-5 h-5 rounded-full border border-outline-variant hover:border-secondary flex items-center justify-center text-transparent hover:text-on-secondary-fixed transition-all cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[13px]">
                              check
                            </span>
                          </button>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">
                              {task.title}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-outline flex-wrap">
                              {overdue && (
                                <span className="text-error font-semibold">
                                  Overdue ({formatDisplayDate(task.dueDate || '')})
                                </span>
                              )}
                              {task.time && (
                                <span className="flex items-center gap-1 text-on-surface-variant font-medium">
                                  <span className="material-symbols-outlined text-[13px]">
                                    schedule
                                  </span>
                                  {task.time}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded-full bg-surface-container-low text-[11px] font-medium text-on-surface-variant">
                                {task.area}
                              </span>
                              {task.priority === 'high' && (
                                <span className="text-tertiary font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                                  High
                                </span>
                              )}
                              {(task.isRecurring || task.recurrenceRule || task.recurring) && (
                                <span className="text-secondary font-medium flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">sync</span>
                                  {task.recurring || (task.recurrenceRule ? formatRecurrenceLabel(task.recurrenceRule) : 'Repeats')}
                                </span>
                              )}
                              {task.notes && (
                                <span className="text-secondary font-medium flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[12px]">link</span>
                                  {task.notes}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {onEditTask && (
                            <button
                              type="button"
                              onClick={() => handleRescheduleTask(task, 'Tomorrow')}
                              className="hidden sm:inline-flex px-2 py-1 rounded-full text-[11px] text-outline hover:text-on-surface hover:bg-surface-container opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              title="Reschedule to Tomorrow"
                            >
                              Tomorrow
                            </button>
                          )}
                          {/* Pin to Today's Focus toggle */}
                          <button
                            type="button"
                            onClick={() => onToggleFocus(task.id)}
                            className={`p-1 rounded-full text-xs transition-colors cursor-pointer shrink-0 ${
                              task.isFocus
                                ? 'text-tertiary hover:text-tertiary-container'
                                : 'text-outline-variant hover:text-outline opacity-0 group-hover:opacity-100'
                            }`}
                            title={task.isFocus ? "In Today's focus" : "Pin to Today's focus"}
                          >
                            <span
                              className="material-symbols-outlined text-[18px]"
                              style={{
                                fontVariationSettings: task.isFocus ? "'FILL' 1" : "'FILL' 0",
                              }}
                            >
                              star
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TASK COMPLETION: Calm Collapsible Drawer */}
              {completedTodayTasks.length > 0 && (
                <div className="pt-3 border-t border-outline-variant/15 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center justify-between text-xs text-outline hover:text-on-surface py-1 transition-colors cursor-pointer w-full text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">
                        {showCompleted ? 'expand_less' : 'expand_more'}
                      </span>
                      <span>
                        Completed ({completedTodayTasks.length})
                      </span>
                    </span>
                    <span className="text-[11px]">Toggle</span>
                  </button>
                  {showCompleted && (
                    <div className="flex flex-col gap-1.5 pl-2">
                      {completedTodayTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low/40 text-outline text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => onToggleTask(task.id)}
                              className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center shrink-0 cursor-pointer"
                              title="Undo completion"
                            >
                              <span className="material-symbols-outlined text-[11px]">
                                check
                              </span>
                            </button>
                            <span className="line-through truncate text-on-surface-variant/70">
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-outline shrink-0 ml-2">
                            {task.area}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Secondary Right Column (5 cols on lg) */}
          <aside className="lg:col-span-5 flex flex-col gap-7">
            {/* IMPROVEMENT 5 — LIFE SNAPSHOT */}
            <section
              aria-label="Life Snapshot"
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    space_dashboard
                  </span>
                  <h2 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight">
                    Life Snapshot
                  </h2>
                </div>
                <span className="text-xs text-outline">At a glance</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col gap-0.5">
                  <span className="text-outline">Remaining today</span>
                  <span className="text-lg font-semibold text-on-surface">
                    {lifeSnapshot.tasksRemainingToday}{' '}
                    <span className="text-xs font-normal text-outline">
                      task{lifeSnapshot.tasksRemainingToday === 1 ? '' : 's'}
                    </span>
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col gap-0.5">
                  <span className="text-outline">Today&apos;s events</span>
                  <span className="text-lg font-semibold text-on-surface">
                    {lifeSnapshot.todayEventsCount}{' '}
                    <span className="text-xs font-normal text-outline">
                      scheduled
                    </span>
                  </span>
                </div>

                {lifeSnapshot.overdueTasksCount > 0 && (
                  <div className="p-3 rounded-xl bg-error-container/25 border border-error/20 flex flex-col gap-0.5">
                    <span className="text-error font-medium">Overdue items</span>
                    <span className="text-lg font-semibold text-error">
                      {lifeSnapshot.overdueTasksCount}
                    </span>
                  </div>
                )}

                {lifeSnapshot.activeRecurringCount > 0 && (
                  <div className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col gap-0.5">
                    <span className="text-outline">Recurring routines</span>
                    <span className="text-lg font-semibold text-secondary">
                      {lifeSnapshot.activeRecurringCount}{' '}
                      <span className="text-xs font-normal text-outline">active</span>
                    </span>
                  </div>
                )}
              </div>

              {lifeSnapshot.nextEventToday && (
                <div className="p-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/15 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0">
                      event
                    </span>
                    <span className="truncate font-medium text-on-surface">
                      Next: {lifeSnapshot.nextEventToday.title}
                    </span>
                  </div>
                  <span className="text-secondary font-semibold shrink-0">
                    {lifeSnapshot.nextEventToday.startTime ||
                      lifeSnapshot.nextEventToday.time ||
                      'Today'}
                  </span>
                </div>
              )}

              {lifeSnapshot.recentActivityLabel && (
                <div className="flex items-center justify-between text-[11px] text-outline pt-1 border-t border-outline-variant/15">
                  <span className="truncate">{lifeSnapshot.recentActivityLabel}</span>
                  {onOpenWeeklyReview && (
                    <button
                      type="button"
                      onClick={onOpenWeeklyReview}
                      className="text-primary font-semibold hover:underline shrink-0 ml-2 cursor-pointer"
                    >
                      Weekly review →
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* UPCOMING: COMING UP (WITH CALENDAR + TASK INTELLIGENCE) */}
            <section
              aria-label="Coming up"
              className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                <h2 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight">
                  Coming up
                </h2>
                {onNavigateToTab ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('calendar')}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Open Calendar
                  </button>
                ) : (
                  <span className="text-xs text-outline">Next few days</span>
                )}
              </div>
              {comingUpItems.length === 0 ? (
                <p className="text-xs text-outline py-2">
                  Nothing scheduled for the immediate days ahead.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {comingUpItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                            item.isEvent ? 'bg-primary' : 'bg-secondary'
                          }`}
                        ></div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-on-surface truncate">
                              {item.title}
                            </span>
                            <span className="text-[11px] font-semibold text-secondary shrink-0">
                              {item.date}
                            </span>
                          </div>
                          {item.time && (
                            <span className="text-xs text-outline mt-0.5">
                              {item.time}
                            </span>
                          )}
                          <span className="text-[11px] text-outline mt-1">
                            {item.area}
                          </span>
                        </div>
                      </div>

                      {/* Related Tasks surfaced under approaching Calendar Event */}
                      {item.relatedTasks && item.relatedTasks.length > 0 && (
                        <div className="ml-5 pl-2.5 border-l-2 border-secondary/40 flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
                            Related task{item.relatedTasks.length > 1 ? 's' : ''}
                          </span>
                          {item.relatedTasks.map((rt) => (
                            <div
                              key={rt.id}
                              className="flex items-center justify-between gap-2 text-xs text-on-surface-variant"
                            >
                              <span className="truncate">• {rt.title}</span>
                              <button
                                type="button"
                                onClick={() => onToggleTask(rt.id)}
                                className="text-[10px] font-semibold text-secondary hover:underline shrink-0 cursor-pointer"
                              >
                                Complete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* RECURRING: ONLY SHOWN IF USER HAS RECURRING ITEMS */}
            {recurringItems.length > 0 && (
              <section
                aria-label="Recurring commitments"
                className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-4"
              >
                <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                  <h2 className="text-base sm:text-lg font-semibold text-on-surface tracking-tight">
                    Recurring
                  </h2>
                  <span className="text-xs text-secondary font-medium">
                    {recurringItems.length} active
                  </span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {recurringItems.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/40 hover:bg-surface-container-low transition-colors gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="material-symbols-outlined text-outline text-[16px] shrink-0">
                          sync
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs sm:text-sm font-medium text-on-surface truncate">
                            {rec.title}
                          </span>
                          <span className="text-[11px] text-outline">
                            {rec.recurring}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant shrink-0 font-medium">
                        {rec.area}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Calm Inspiration / Daily Reflection Vignette */}
            <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 shadow-sm flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
                Daily Reflection
              </span>
              <p className="text-xs sm:text-sm text-on-surface-variant italic leading-relaxed">
                &ldquo;Simplicity is about subtracting the obvious and adding the meaningful.&rdquo;
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                <span>Calm personal command center</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* INLINE TASK OPEN / EDIT MODAL FROM TODAY */}
      {editingTaskInline && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingTaskInline(null)}
        >
          <form
            onSubmit={handleSaveInlineEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-5 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2.5">
              <h3 className="text-base font-semibold text-on-surface">Task Details</h3>
              <button
                type="button"
                onClick={() => setEditingTaskInline(null)}
                className="p-1 rounded-full text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-outline">Title</label>
              <input
                type="text"
                value={inlineEditTitle}
                onChange={(e) => setInlineEditTitle(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-outline">Due Date</label>
                <input
                  type="text"
                  value={inlineEditDue}
                  onChange={(e) => setInlineEditDue(e.target.value)}
                  placeholder="Today / Tomorrow / YYYY-MM-DD"
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-outline">Time</label>
                <input
                  type="text"
                  value={inlineEditTime}
                  onChange={(e) => setInlineEditTime(e.target.value)}
                  placeholder="Optional (e.g. 3:00 PM)"
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-sm text-on-surface focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => {
                  onToggleTask(editingTaskInline.id);
                  setEditingTaskInline(null);
                }}
                className="px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-fixed text-xs font-semibold cursor-pointer"
              >
                Mark complete
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTaskInline(null)}
                  className="px-3.5 py-1.5 rounded-full text-xs text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer"
                >
                  Save changes
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
