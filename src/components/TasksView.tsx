import React, { useState } from 'react';
import { Task, PriorityLevel, LifeArea, RecurrenceRule } from '../types';
import { parseNaturalLanguageTask, parseMagicCapture } from '../utils/naturalLanguageParser';
import { formatRecurrenceLabel } from '../utils/recurringUtils';
import { isTaskDueToday, isTaskOverdue } from '../utils/reminderIntelligence';
import { formatDisplayDate, getTodayString } from '../utils/dateUtils';

interface TasksViewProps {
  tasks: Task[];
  areas?: LifeArea[];
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onRestoreTask?: (task: Task) => void;
  onSkipTask?: (id: string) => void;
  onStopRecurring?: (id: string) => void;
  onOpenMagicCapture?: (initialText: string) => void;
}

type FilterType = 'today' | 'upcoming' | 'all' | 'completed';

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

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  areas,
  onAddTask,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onRestoreTask,
  onSkipTask,
  onStopRecurring,
  onOpenMagicCapture,
}) => {
  const AREA_OPTIONS =
    areas && areas.length > 0
      ? areas
          .filter((a) => !a.hidden)
          .map((a) => ({ name: a.name, emoji: a.emoji }))
          .concat([{ name: 'Custom', emoji: '📁' }])
      : DEFAULT_AREA_OPTIONS;

  const [filter, setFilter] = useState<FilterType>('today');
  const [quickInput, setQuickInput] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletedTaskToast, setDeletedTaskToast] = useState<Task | null>(null);
  const [toastTimeoutId, setToastTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Form states for Add / Edit Modal
  const [modalTitle, setModalTitle] = useState('');
  const [modalDueDate, setModalDueDate] = useState('Today');
  const [modalTime, setModalTime] = useState('');
  const [modalPriority, setModalPriority] = useState<PriorityLevel>('medium');
  const [modalArea, setModalArea] = useState('Personal');
  const [modalCustomArea, setModalCustomArea] = useState('');

  // Progressive Disclosure Recurrence Form States
  const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
  const [repeatFreq, setRepeatFreq] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('weekly');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1]); // default Mon
  const [customInterval, setCustomInterval] = useState<number>(2);
  const [customUnit, setCustomUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('weeks');
  const [endOption, setEndOption] = useState<'never' | 'on_date'>('never');
  const [endDate, setEndDate] = useState<string>('');
  const [editScope, setEditScope] = useState<'this' | 'series'>('series');

  // Handle Quick Add Input
  const handleQuickAddSubmit = (e: React.FormEvent) => {
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

  // Open Add Task Modal with clean defaults
  const handleOpenAddModal = () => {
    setModalTitle('');
    setModalDueDate(filter === 'upcoming' ? 'Tomorrow' : 'Today');
    setModalTime('');
    setModalPriority('medium');
    setModalArea('Personal');
    setModalCustomArea('');
    setIsRepeatEnabled(false);
    setRepeatFreq('weekly');
    setSelectedWeekdays([1]);
    setCustomInterval(2);
    setCustomUnit('weeks');
    setEndOption('never');
    setEndDate('');
    setEditScope('series');
    setIsAddModalOpen(true);
  };

  // Open Edit Task Modal
  const handleOpenEditModal = (task: Task) => {
    setEditingTask(task);
    setModalTitle(task.title);
    setModalDueDate(task.dueDate || 'Today');
    setModalTime(task.time || '');
    setModalPriority(task.priority || 'medium');
    const isStandardArea = AREA_OPTIONS.some((a) => a.name === task.area && a.name !== 'Custom');
    if (isStandardArea) {
      setModalArea(task.area);
      setModalCustomArea('');
    } else {
      setModalArea('Custom');
      setModalCustomArea(task.area);
    }

    if (task.recurrenceRule || task.isRecurring || task.recurring) {
      setIsRepeatEnabled(true);
      if (task.recurrenceRule) {
        setRepeatFreq(task.recurrenceRule.frequency);
        setSelectedWeekdays(task.recurrenceRule.daysOfWeek || [1]);
        setCustomInterval(task.recurrenceRule.interval || 2);
        setCustomUnit(task.recurrenceRule.unit || 'weeks');
        setEndOption(task.recurrenceRule.endType || 'never');
        setEndDate(task.recurrenceRule.endDate || '');
      } else {
        const recStr = (task.recurring || '').toLowerCase();
        if (recStr.includes('day') || recStr.includes('daily')) setRepeatFreq('daily');
        else if (recStr.includes('month')) setRepeatFreq('monthly');
        else if (recStr.includes('year')) setRepeatFreq('yearly');
        else setRepeatFreq('weekly');
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
  };

  const handleToggleWeekday = (day: number) => {
    if (selectedWeekdays.includes(day)) {
      if (selectedWeekdays.length > 1) {
        setSelectedWeekdays(selectedWeekdays.filter((d) => d !== day));
      }
    } else {
      setSelectedWeekdays([...selectedWeekdays, day].sort());
    }
  };

  const handleSelectWeekdaysShortcut = () => {
    setSelectedWeekdays([1, 2, 3, 4, 5]); // Mon - Fri
  };

  // Build recurrence rule
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

  // Submit Modal (Add or Edit)
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) return;

    const resolvedArea =
      modalArea === 'Custom'
        ? modalCustomArea.trim() || 'Custom'
        : modalArea;

    const currentRule = buildCurrentRule();
    const recurrenceLabel = currentRule ? formatRecurrenceLabel(currentRule) : undefined;

    if (editingTask) {
      if (editScope === 'this') {
        onEditTask({
          ...editingTask,
          title: modalTitle.trim(),
          dueDate: modalDueDate.trim() || undefined,
          time: modalTime.trim() || undefined,
          priority: modalPriority,
          area: resolvedArea,
        });
      } else {
        onEditTask({
          ...editingTask,
          title: modalTitle.trim(),
          dueDate: modalDueDate.trim() || undefined,
          time: modalTime.trim() || undefined,
          priority: modalPriority,
          area: resolvedArea,
          recurring: recurrenceLabel,
          recurrenceRule: currentRule,
          isRecurring: Boolean(currentRule),
        });
      }
      setEditingTask(null);
    } else {
      onAddTask({
        title: modalTitle.trim(),
        dueDate: modalDueDate.trim() || 'Today',
        time: modalTime.trim() || undefined,
        priority: modalPriority,
        area: resolvedArea,
        recurring: recurrenceLabel,
        recurrenceRule: currentRule,
        isRecurring: Boolean(currentRule),
        isFocus: modalPriority === 'high',
      });
      setIsAddModalOpen(false);
    }
  };

  // Delete with Undo toast
  const handleDeleteWithUndo = (task: Task) => {
    onDeleteTask(task.id);
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
    setDeletedTaskToast(task);
    const timeout = setTimeout(() => {
      setDeletedTaskToast(null);
    }, 4500);
    setToastTimeoutId(timeout);
  };

  const handleUndoDelete = () => {
    if (deletedTaskToast && onRestoreTask) {
      onRestoreTask(deletedTaskToast);
    }
    setDeletedTaskToast(null);
    if (toastTimeoutId) clearTimeout(toastTimeoutId);
  };

  // Filter Tasks
  const todayISO = getTodayString();
  const isTaskToday = (t: Task) =>
    !t.completed && (isTaskDueToday(t, todayISO) || isTaskOverdue(t, todayISO));
  const isTaskUpcoming = (t: Task) =>
    !t.completed && Boolean(t.dueDate) && !isTaskDueToday(t, todayISO) && !isTaskOverdue(t, todayISO);

  const todayTasks = tasks.filter(isTaskToday);
  const upcomingTasks = tasks.filter(isTaskUpcoming);
  const allActiveTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const displayedTasks =
    filter === 'today'
      ? todayTasks
      : filter === 'upcoming'
      ? upcomingTasks
      : filter === 'all'
      ? allActiveTasks
      : completedTasks;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 flex flex-col gap-6 md:gap-8">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight">
            Tasks
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant">
            Everything you need to get done.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-medium text-sm shadow-sm hover:bg-primary-container transition-all cursor-pointer active:scale-98"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>+ Add task</span>
        </button>
      </header>

      {/* QUICK TASK CREATION */}
      <section aria-label="Quick task creation" className="w-full">
        <form
          onSubmit={handleQuickAddSubmit}
          className="relative w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-2 shadow-sm focus-within:shadow-md focus-within:border-primary/40 transition-all flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-outline ml-3 text-[22px]">
            add_circle
          </span>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Add a task (e.g. Plan weekly schedule, drink water every day...)"
            className="w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline focus:outline-none py-1.5"
          />
          <div className="hidden sm:flex items-center gap-1.5 pr-3 text-outline text-xs">
            <kbd className="px-2 py-0.5 rounded bg-surface-container text-[11px] text-on-surface-variant font-mono">
              Return
            </kbd>
            <span>to save</span>
          </div>
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="sm:hidden px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold mr-1 disabled:opacity-50 cursor-pointer"
          >
            Add
          </button>
        </form>
      </section>

      {/* TASK FILTERS: Today | Upcoming | All | Completed */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-outline-variant/15 pb-2">
        <div className="flex items-center gap-2 flex-wrap" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'today'}
            onClick={() => setFilter('today')}
            className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              filter === 'today'
                ? 'bg-secondary-container text-on-secondary-fixed shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Today <span className="opacity-75 ml-1">{todayTasks.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'upcoming'}
            onClick={() => setFilter('upcoming')}
            className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              filter === 'upcoming'
                ? 'bg-secondary-container text-on-secondary-fixed shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Upcoming <span className="opacity-75 ml-1">{upcomingTasks.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-secondary-container text-on-secondary-fixed shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            All <span className="opacity-75 ml-1">{allActiveTasks.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'completed'}
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              filter === 'completed'
                ? 'bg-secondary-container text-on-secondary-fixed shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Completed <span className="opacity-75 ml-1">{completedTasks.length}</span>
          </button>
        </div>
        <span className="text-xs text-outline hidden sm:inline">
          {displayedTasks.length} item{displayedTasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* TASK LIST */}
      <section aria-label="Task list" className="flex flex-col gap-2.5">
        {displayedTasks.length === 0 ? (
          <div className="py-12 px-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
              <span className="material-symbols-outlined text-[24px]">
                {filter === 'completed' ? 'done_all' : 'check'}
              </span>
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h2 className="text-base sm:text-lg font-semibold text-on-surface">
                {filter === 'today'
                  ? 'What matters today?'
                  : filter === 'upcoming'
                  ? 'Nothing upcoming.'
                  : filter === 'completed'
                  ? 'No completed tasks yet.'
                  : 'Nothing here yet. Add something you need to get done.'}
              </h2>
            </div>
            {filter !== 'completed' && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="mt-1 px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm hover:bg-primary-container transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add a task</span>
              </button>
            )}
          </div>
        ) : (
          displayedTasks.map((task) => {
            const isCompleted = task.completed;
            const hasRecurrence = Boolean(task.isRecurring || task.recurrenceRule || task.recurring);
            const recurrenceLabel = task.recurring || (task.recurrenceRule ? formatRecurrenceLabel(task.recurrenceRule) : undefined);

            return (
              <article
                key={task.id}
                className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm hover:shadow-md transition-all gap-3 ${
                  isCompleted ? 'opacity-65' : ''
                }`}
              >
                {/* Checkbox and Content */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    aria-label={isCompleted ? `Mark ${task.title} uncompleted` : `Complete ${task.title}`}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      isCompleted
                        ? 'bg-secondary border-secondary text-on-secondary'
                        : 'border-outline-variant hover:border-secondary text-transparent hover:text-on-secondary-fixed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[13px]">check</span>
                  </button>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm sm:text-base font-medium truncate ${
                        isCompleted ? 'line-through text-outline' : 'text-on-surface'
                      }`}
                    >
                      {task.title}
                    </span>
                    {/* Metadata line */}
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-outline flex-wrap">
                      {!isCompleted && isTaskOverdue(task, todayISO) && (
                        <span className="text-error font-semibold">
                          Overdue ({formatDisplayDate(task.dueDate || '')})
                        </span>
                      )}
                      {task.dueDate && !isTaskOverdue(task, todayISO) && (
                        <span>{formatDisplayDate(task.dueDate)}</span>
                      )}
                      {task.time && <span>• {task.time}</span>}
                      {task.priority && task.priority !== 'medium' && (
                        <span>
                          •{' '}
                          <span
                            className={
                              task.priority === 'high' ? 'text-tertiary font-semibold' : 'text-outline'
                            }
                          >
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        </span>
                      )}
                      {task.area && <span>• {task.area}</span>}
                      {hasRecurrence && recurrenceLabel && (
                        <span className="text-secondary font-medium flex items-center gap-1">
                          • <span className="material-symbols-outlined text-[13px]">sync</span>
                          {recurrenceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row Action Controls: Skip, Edit, Delete */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  {hasRecurrence && !isCompleted && onSkipTask && (
                    <button
                      type="button"
                      onClick={() => onSkipTask(task.id)}
                      className="px-2 py-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container text-xs transition-colors cursor-pointer flex items-center gap-1"
                      title="Skip this occurrence and move to next"
                      aria-label={`Skip this occurrence of ${task.title}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">skip_next</span>
                      <span className="hidden sm:inline text-[11px]">Skip</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(task)}
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                    title="Edit task"
                    aria-label={`Edit ${task.title}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteWithUndo(task)}
                    className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors cursor-pointer"
                    title="Delete task"
                    aria-label={`Delete ${task.title}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Accidental Delete Undo Toast */}
      {deletedTaskToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm animate-fade-in"
        >
          <span className="truncate max-w-[200px] sm:max-w-xs">
            Deleted "{deletedTaskToast.title}"
          </span>
          <button
            type="button"
            onClick={handleUndoDelete}
            className="text-primary-fixed hover:underline font-semibold text-xs uppercase tracking-wide cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}

      {/* ADD / EDIT TASK MODAL */}
      {(isAddModalOpen || editingTask) && (
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
                {editingTask ? 'Edit Task' : 'Add Task'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingTask(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Recurring Task Scope */}
            {editingTask && (editingTask.isRecurring || editingTask.recurrenceRule || editingTask.recurring) && (
              <div className="p-3 rounded-xl bg-secondary-fixed/30 border border-secondary/20 flex flex-col gap-1.5 text-xs">
                <span className="font-semibold text-on-surface">This is a recurring task:</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-on-surface">
                    <input
                      type="radio"
                      name="editScope"
                      checked={editScope === 'series'}
                      onChange={() => setEditScope('series')}
                      className="accent-secondary"
                    />
                    <span>All future occurrences (series)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium text-on-surface">
                    <input
                      type="radio"
                      name="editScope"
                      checked={editScope === 'this'}
                      onChange={() => setEditScope('this')}
                      className="accent-secondary"
                    />
                    <span>This occurrence only</span>
                  </label>
                </div>
              </div>
            )}

            {/* Task Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Task title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="What do you need to get done?"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                autoFocus
                required
              />
            </div>

            {/* Due date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Due date</label>
                <input
                  type="text"
                  value={modalDueDate}
                  onChange={(e) => setModalDueDate(e.target.value)}
                  placeholder="Today, Tomorrow, Oct 12..."
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs sm:text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Time (optional)</label>
                <input
                  type="text"
                  value={modalTime}
                  onChange={(e) => setModalTime(e.target.value)}
                  placeholder="e.g. 11:30 AM, 4:00 PM"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs sm:text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                />
              </div>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Priority</label>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map((p) => {
                  const isSelected = modalPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setModalPriority(p)}
                      className={`py-2 rounded-xl text-xs font-semibold capitalize border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? p === 'high'
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary/40 shadow-sm'
                            : 'bg-secondary-container text-on-secondary-fixed border-secondary/40 shadow-sm'
                          : 'bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container'
                      }`}
                    >
                      {p === 'high' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                      )}
                      <span>{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Area */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Area</label>
              <div className="grid grid-cols-4 gap-1.5">
                {AREA_OPTIONS.map((area) => {
                  const isSelected = modalArea === area.name;
                  return (
                    <button
                      key={area.name}
                      type="button"
                      onClick={() => setModalArea(area.name)}
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

            {/* REPEAT / RECURRENCE SETTING */}
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
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-outline">Repeat on</span>
                        <button
                          type="button"
                          onClick={handleSelectWeekdaysShortcut}
                          className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                        >
                          Weekdays (Mon-Fri)
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        {WEEKDAY_KEYS.map(({ name, day }) => {
                          const isSelected = selectedWeekdays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => handleToggleWeekday(day)}
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

                  {editingTask && (editingTask.isRecurring || editingTask.recurrenceRule || editingTask.recurring) && onStopRecurring && (
                    <button
                      type="button"
                      onClick={() => {
                        onStopRecurring(editingTask.id);
                        setIsRepeatEnabled(false);
                      }}
                      className="text-error hover:underline text-[11px] self-start font-medium cursor-pointer pt-1"
                    >
                      Stop repeating (convert to one-time task)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingTask(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
              >
                {editingTask ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
