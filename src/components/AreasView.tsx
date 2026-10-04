import React, { useState } from 'react';
import { LifeArea, Task, CalendarEvent, AreaNote } from '../types';
import { parseNaturalLanguageTask, parseMagicCapture } from '../utils/naturalLanguageParser';
import { formatDisplayDate } from '../utils/dateUtils';

interface AreasViewProps {
  areas: LifeArea[];
  notes: AreaNote[];
  tasks: Task[];
  events: CalendarEvent[];
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onAddArea: (area: Omit<LifeArea, 'id'>) => void;
  onEditArea: (area: LifeArea) => void;
  onDeleteArea: (areaId: string, itemAction: 'keep' | 'reassign', reassignAreaName?: string) => void;
  onAddNote: (note: Omit<AreaNote, 'id' | 'updatedAt'>) => void;
  onDeleteNote: (id: string) => void;
  onOpenMagicCapture?: (initialText: string, defaultArea?: string) => void;
}

type AreaFilter = 'all' | 'tasks' | 'calendar';

const ICON_PRESETS = ['🏠', '💼', '🌿', '📚', '💳', '✈️', '💻', '🎨', '🏋️', '🍳', '🛠️', '🎯', '🌱', '💡', '🎵', '🚗'];

export const AreasView: React.FC<AreasViewProps> = ({
  areas,
  notes,
  tasks,
  events,
  onAddTask,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onAddEvent,
  onDeleteEvent,
  onAddArea,
  onEditArea,
  onDeleteArea,
  onAddNote,
  onDeleteNote,
  onOpenMagicCapture,
}) => {
  // Navigation inside Areas: null = overview grid, or selected Area ID
  const [activeAreaId, setActiveAreaId] = useState<string | null>(null);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>('all');

  // Contextual Quick Add input inside focused area
  const [quickInput, setQuickInput] = useState('');

  // Modals
  const [showAddAreaModal, setShowAddAreaModal] = useState(false);
  const [editingArea, setEditingArea] = useState<LifeArea | null>(null);
  const [deletingArea, setDeletingArea] = useState<LifeArea | null>(null);
  const [deleteAction, setDeleteAction] = useState<'keep' | 'reassign'>('keep');
  const [reassignTarget, setReassignTarget] = useState<string>('Personal');

  // Form states for Create/Edit Area
  const [areaFormName, setAreaFormName] = useState('');
  const [areaFormEmoji, setAreaFormEmoji] = useState('📁');
  const [areaFormDesc, setAreaFormDesc] = useState('');

  // Form state for Adding a Task in this Area
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('Today');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');

  // Form state for Adding an Event in this Area
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('Today');
  const [eventTime, setEventTime] = useState('10:00 AM');
  const [eventIsAllDay, setEventIsAllDay] = useState(false);

  // Form state for Adding a Note
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Active Area object (if in focused view)
  const activeArea = areas.find((a) => a.id === activeAreaId);

  // Handle Quick Add inside current Area or Areas overview
  const handleQuickAddInsideArea = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;
    const magic = parseMagicCapture(trimmed, activeArea?.name);
    if (magic.requiresConfirmation && onOpenMagicCapture) {
      onOpenMagicCapture(trimmed, activeArea?.name);
      setQuickInput('');
      return;
    }
    const parsed = parseNaturalLanguageTask(trimmed);
    onAddTask({
      ...parsed,
      area: activeArea ? activeArea.name : parsed.area,
    });
    setQuickInput('');
  };

  // Open Add Area Modal
  const handleOpenAddArea = () => {
    setAreaFormName('');
    setAreaFormEmoji('📁');
    setAreaFormDesc('');
    setShowAddAreaModal(true);
  };

  // Open Edit Area Modal
  const handleOpenEditArea = (area: LifeArea) => {
    setEditingArea(area);
    setAreaFormName(area.name);
    setAreaFormEmoji(area.emoji);
    setAreaFormDesc(area.description || '');
  };

  // Submit Area Create/Edit
  const handleSaveAreaModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaFormName.trim()) return;

    if (editingArea) {
      onEditArea({
        ...editingArea,
        name: areaFormName.trim(),
        emoji: areaFormEmoji,
        description: areaFormDesc.trim() || undefined,
      });
      setEditingArea(null);
    } else {
      onAddArea({
        name: areaFormName.trim(),
        emoji: areaFormEmoji,
        description: areaFormDesc.trim() || undefined,
        isCustom: true,
      });
      setShowAddAreaModal(false);
    }
  };

  // Handle Delete Area Confirm
  const handleConfirmDeleteArea = () => {
    if (!deletingArea) return;
    onDeleteArea(deletingArea.id, deleteAction, reassignTarget);
    if (activeAreaId === deletingArea.id) {
      setActiveAreaId(null);
    }
    setDeletingArea(null);
  };

  // Create Task in Area
  const handleCreateAreaTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeArea) return;
    onAddTask({
      title: taskTitle.trim(),
      dueDate: taskDueDate,
      priority: taskPriority,
      area: activeArea.name,
      isFocus: taskPriority === 'high',
    });
    setTaskTitle('');
    setShowTaskModal(false);
  };

  // Create Event in Area
  const handleCreateAreaEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !activeArea) return;
    onAddEvent({
      title: eventTitle.trim(),
      date: eventDate,
      time: eventIsAllDay ? 'All day' : eventTime,
      isAllDay: eventIsAllDay,
      area: activeArea.name,
    });
    setEventTitle('');
    setShowEventModal(false);
  };

  // Create Note in Area
  const handleCreateAreaNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !activeArea) return;
    onAddNote({
      area: activeArea.name,
      title: noteTitle.trim(),
      content: noteContent.trim(),
    });
    setNoteTitle('');
    setNoteContent('');
    setShowNoteModal(false);
  };

  const visibleAreas = areas.filter((a) => !a.hidden);

  const areaTasks = activeArea
    ? tasks.filter((t) => t.area.toLowerCase() === activeArea.name.toLowerCase())
    : [];
  const activeAreaTasks = areaTasks.filter((t) => !t.completed);
  const completedAreaTasks = areaTasks.filter((t) => t.completed);

  const areaEvents = activeArea
    ? events.filter((e) => (e.area || '').toLowerCase() === activeArea.name.toLowerCase())
    : [];

  const areaRecurring = activeArea
    ? tasks.filter((t) => !t.completed && t.recurring && t.area.toLowerCase() === activeArea.name.toLowerCase())
    : [];

  const areaNotes = activeArea
    ? notes.filter((n) => n.area.toLowerCase() === activeArea.name.toLowerCase())
    : [];

  const isAreaEmpty =
    areaTasks.length === 0 && areaEvents.length === 0 && areaNotes.length === 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 flex flex-col gap-6 md:gap-8">
      {/* AREAS OVERVIEW (Grid of All Areas) */}
      {!activeArea ? (
        <>
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight">
                Areas
              </h1>
              <p className="text-sm sm:text-base text-on-surface-variant">
                Keep related parts of life together.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenAddArea}
              className="self-start sm:self-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-medium text-sm shadow-sm hover:bg-primary-container transition-all cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>+ New Area</span>
            </button>
          </header>

          {/* Quick Capture across all Areas */}
          <form
            onSubmit={handleQuickAddInsideArea}
            className="relative w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-2 shadow-sm focus-within:shadow-md focus-within:border-primary/40 transition-all flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-outline ml-3 text-[20px]">
              add_circle
            </span>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="Quick capture to any area (e.g. Pay rent tomorrow, Dentist at 5 and buy toothpaste before that...)"
              className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none py-1.5"
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-4 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold disabled:opacity-50 transition-opacity cursor-pointer shrink-0 mr-1"
            >
              Add
            </button>
          </form>

          <section aria-label="Life contexts grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleAreas.map((area) => {
              const activeCount = tasks.filter(
                (t) => !t.completed && t.area.toLowerCase() === area.name.toLowerCase()
              ).length;
              const upcomingCount = events.filter(
                (e) => (e.area || '').toLowerCase() === area.name.toLowerCase()
              ).length;

              return (
                <div
                  key={area.id}
                  onClick={() => setActiveAreaId(area.id)}
                  className="group p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col justify-between h-44 sm:h-48 text-left"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-xl shadow-xs">
                        {area.emoji}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-semibold">
                          {activeCount} active
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-base font-semibold text-on-surface group-hover:text-primary transition-colors">
                        {area.name}
                      </h2>
                      {area.description && (
                        <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">
                          {area.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10 text-xs">
                    <span className="font-medium text-outline group-hover:text-primary transition-colors flex items-center gap-1">
                      <span>Open space</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </span>
                    {upcomingCount > 0 && (
                      <span className="text-[11px] text-outline">
                        {upcomingCount} event{upcomingCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* + Custom Area Card */}
            <div
              onClick={handleOpenAddArea}
              className="group p-5 rounded-2xl bg-surface-container-low/40 border border-dashed border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-low transition-all cursor-pointer flex flex-col justify-between h-44 sm:h-48 text-left"
            >
              <div className="flex flex-col gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary text-xl shadow-xs">
                  📁
                </div>
                <div className="flex flex-col">
                  <h2 className="text-base font-semibold text-on-surface group-hover:text-primary transition-colors">
                    Custom Area
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Keep related parts of life together.
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <span>Create space</span>
                <span className="material-symbols-outlined text-[14px]">add</span>
              </span>
            </div>
          </section>
        </>
      ) : (
        /* FOCUSED AREA VIEW */
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 pb-3 border-b border-outline-variant/15">
            <button
              type="button"
              onClick={() => setActiveAreaId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-outline hover:text-on-surface transition-colors cursor-pointer self-start"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>All Areas</span>
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-2xl shadow-inner shrink-0">
                  {activeArea.emoji}
                </span>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight truncate">
                      {activeArea.name}
                    </h1>
                    {activeArea.isCustom && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
                        Custom
                      </span>
                    )}
                  </div>
                  {activeArea.description && (
                    <p className="text-xs sm:text-sm text-outline truncate">
                      {activeArea.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(true)}
                  className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm hover:bg-primary-container transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>+ Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEventModal(true)}
                  className="px-4 py-2 rounded-full bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-all cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  <span>+ Event</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditArea(activeArea)}
                  className="p-2 rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  title="Configure this Area"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Capture in current area */}
          <form
            onSubmit={handleQuickAddInsideArea}
            className="relative w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/30 p-2 shadow-sm focus-within:shadow-md focus-within:border-primary/40 transition-all flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-outline ml-3 text-[20px]">
              add_circle
            </span>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder={`Add task to ${activeArea.name}...`}
              className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none py-1.5"
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-4 py-1.5 rounded-full bg-primary text-on-primary text-xs font-semibold disabled:opacity-50 transition-opacity cursor-pointer shrink-0 mr-1"
            >
              Add
            </button>
          </form>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-outline mr-1">Filter:</span>
            {(['all', 'tasks', 'calendar'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAreaFilter(mode)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                  areaFilter === mode
                    ? 'bg-secondary-container text-on-secondary-fixed shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Empty Area Experience */}
          {isAreaEmpty ? (
            <div className="py-12 px-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-center flex flex-col items-center justify-center gap-3 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[24px]">folder_open</span>
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h3 className="text-base sm:text-lg font-semibold text-on-surface">
                  Nothing here yet.
                </h3>
                <p className="text-xs sm:text-sm text-outline">
                  Add something related to this area of your life.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(true)}
                  className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm hover:bg-primary-container transition-all cursor-pointer"
                >
                  Add task
                </button>
                <button
                  type="button"
                  onClick={() => setShowEventModal(true)}
                  className="px-4 py-2 rounded-full bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  Add event
                </button>
              </div>
            </div>
          ) : (
            /* CONTEXTUAL AREA CONTENT */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Tasks & Upcoming (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {(areaFilter === 'all' || areaFilter === 'tasks') && activeAreaTasks.length > 0 && (
                  <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                      <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wide">
                        Active Tasks ({activeAreaTasks.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowTaskModal(true)}
                        className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                      >
                        + Add task
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {activeAreaTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/40 hover:bg-surface-container-low transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onToggleTask(task.id)}
                              className="w-5 h-5 rounded-full border border-outline-variant hover:border-secondary flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-[13px] text-transparent hover:text-secondary">
                                check
                              </span>
                            </button>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium text-on-surface truncate">
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 text-xs text-outline mt-0.5">
                                {task.dueDate && <span>{task.dueDate}</span>}
                                {task.time && <span>• {task.time}</span>}
                                {task.priority === 'high' && (
                                  <span className="text-tertiary font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                                    High
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(areaFilter === 'all' || areaFilter === 'calendar') && areaEvents.length > 0 && (
                  <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 sm:p-6 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                      <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wide">
                        Scheduled Events ({areaEvents.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowEventModal(true)}
                        className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                      >
                        + Add event
                      </button>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {areaEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="flex items-start justify-between p-3 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-low transition-colors gap-3"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></span>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-on-surface truncate">
                                {evt.title}
                              </span>
                              <span className="text-xs text-primary font-medium mt-0.5">
                                {formatDisplayDate(evt.date)} • {evt.isAllDay ? 'All day' : evt.time || evt.startTime || ''}
                              </span>
                              {evt.location && (
                                <span className="text-xs text-outline mt-0.5">{evt.location}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onDeleteEvent(evt.id)}
                            className="p-1 rounded text-outline hover:text-error transition-colors"
                            title="Delete event"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {completedAreaTasks.length > 0 && (
                  <div className="text-xs text-outline px-1">
                    <span>{completedAreaTasks.length} task{completedAreaTasks.length > 1 ? 's' : ''} completed in this area</span>
                  </div>
                )}
              </div>

              {/* Right Column: Recurring, Notes (5 cols) */}
              <aside className="lg:col-span-5 flex flex-col gap-6">
                {areaRecurring.length > 0 && (
                  <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                      <h3 className="text-xs font-semibold text-outline uppercase tracking-wider">
                        Recurring Rhythms
                      </h3>
                      <span className="text-[11px] text-secondary font-medium">
                        {areaRecurring.length} active
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {areaRecurring.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low/40 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-outline text-[16px]">
                              sync
                            </span>
                            <span className="font-medium text-on-surface truncate">{r.title}</span>
                          </div>
                          <span className="text-[11px] text-secondary shrink-0 font-medium ml-2">
                            {r.recurring}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
                    <h3 className="text-xs font-semibold text-outline uppercase tracking-wider">
                      Context Notes ({areaNotes.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowNoteModal(true)}
                      className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                    >
                      + Note
                    </button>
                  </div>
                  {areaNotes.length === 0 ? (
                    <p className="text-xs text-outline py-1">No reference notes in this area.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {areaNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col gap-1 text-xs relative group"
                        >
                          <div className="flex items-center justify-between font-semibold text-on-surface">
                            <span>{note.title}</span>
                            <button
                              type="button"
                              onClick={() => onDeleteNote(note.id)}
                              className="text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete note"
                            >
                              <span className="material-symbols-outlined text-[15px]">delete</span>
                            </button>
                          </div>
                          <p className="text-on-surface-variant leading-relaxed">{note.content}</p>
                          {note.updatedAt && (
                            <span className="text-[10px] text-outline mt-0.5">{note.updatedAt}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT CUSTOM AREA MODAL */}
      {(showAddAreaModal || editingArea) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm">
          <form
            onSubmit={handleSaveAreaModal}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <h2 className="text-lg font-semibold text-on-surface">
                {editingArea ? `Edit Area: ${editingArea.name}` : 'New Custom Area'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowAddAreaModal(false);
                  setEditingArea(null);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Area Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={areaFormName}
                onChange={(e) => setAreaFormName(e.target.value)}
                placeholder="e.g. Creative Studio, Fitness, Family"
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Icon / Motif</label>
              <div className="flex flex-wrap gap-2">
                {ICON_PRESETS.map((ico) => (
                  <button
                    key={ico}
                    type="button"
                    onClick={() => setAreaFormEmoji(ico)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                      areaFormEmoji === ico
                        ? 'bg-secondary-container ring-2 ring-secondary'
                        : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    {ico}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Description (optional)</label>
              <input
                type="text"
                value={areaFormDesc}
                onChange={(e) => setAreaFormDesc(e.target.value)}
                placeholder="What lives in this life context?"
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
              />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15">
              {editingArea ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeletingArea(editingArea);
                    setEditingArea(null);
                  }}
                  className="text-xs text-error hover:underline font-semibold cursor-pointer"
                >
                  Delete Area
                </button>
              ) : (
                <div></div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAreaModal(false);
                    setEditingArea(null);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
                >
                  Save Area
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DELETE AREA SAFEGUARD MODAL */}
      {deletingArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-2.5 text-error font-semibold text-base">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <h3>Delete Area "{deletingArea.name}"?</h3>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              We never delete your underlying tasks or events. Choose how you would like to handle
              items currently filed under this area:
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <label className="flex items-start gap-2 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer">
                <input
                  type="radio"
                  name="delAction"
                  checked={deleteAction === 'keep'}
                  onChange={() => setDeleteAction('keep')}
                  className="mt-0.5 accent-secondary"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface">Keep items (remove Area)</span>
                  <span className="text-outline">
                    Tasks and events remain available in your schedule and tasks lists without this
                    area tag.
                  </span>
                </div>
              </label>
              <label className="flex items-start gap-2 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer">
                <input
                  type="radio"
                  name="delAction"
                  checked={deleteAction === 'reassign'}
                  onChange={() => setDeleteAction('reassign')}
                  className="mt-0.5 accent-secondary"
                />
                <div className="flex flex-col w-full">
                  <span className="font-semibold text-on-surface">Reassign to another Area</span>
                  <select
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                    className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-lowest text-xs text-on-surface border border-outline-variant/30"
                  >
                    {areas
                      .filter((a) => a.id !== deletingArea.id)
                      .map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.emoji} {a.name}
                        </option>
                      ))}
                  </select>
                </div>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => setDeletingArea(null)}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteArea}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-error text-on-error hover:bg-error/90 shadow-sm cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD TASK IN AREA MODAL */}
      {showTaskModal && activeArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm">
          <form
            onSubmit={handleCreateAreaTask}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <h2 className="text-base font-semibold text-on-surface">
                New Task in {activeArea.name}
              </h2>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Task Title</label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Due Date</label>
                <select
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/20"
                >
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                  <option value="Friday">Friday</option>
                  <option value="Next week">Next week</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/20"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD EVENT IN AREA MODAL */}
      {showEventModal && activeArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm">
          <form
            onSubmit={handleCreateAreaEvent}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <h2 className="text-base font-semibold text-on-surface">
                New Event in {activeArea.name}
              </h2>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Event Title</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="e.g. Readout, Service visit..."
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Date</label>
                <select
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/20"
                >
                  <option value="Today">Today</option>
                  <option value="Tomorrow">Tomorrow</option>
                  <option value="Friday">Friday</option>
                </select>
              </div>
              <label className="flex items-center gap-2 p-2 rounded-xl bg-surface-container-low text-xs text-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={eventIsAllDay}
                  onChange={(e) => setEventIsAllDay(e.target.checked)}
                  className="rounded accent-secondary"
                />
                <span>All-day</span>
              </label>
            </div>
            {!eventIsAllDay && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Time</label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  placeholder="e.g. 10:00 AM - 11:00 AM"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/20"
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container"
              >
                Create Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD NOTE MODAL */}
      {showNoteModal && activeArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm">
          <form
            onSubmit={handleCreateAreaNote}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-xl border border-outline-variant/30 flex flex-col gap-4 text-left"
          >
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <h2 className="text-base font-semibold text-on-surface">
                New Note in {activeArea.name}
              </h2>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">Title</label>
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Key details, Guidelines..."
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/20"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-outline">Content</label>
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Contextual details, guidelines, reference info..."
                rows={3}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-xs sm:text-sm text-on-surface focus:outline-none border border-outline-variant/20 resize-none"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container"
              >
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
