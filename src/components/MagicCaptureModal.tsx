import React, { useState, useEffect, useRef } from 'react';
import { Task, CalendarEvent, PersonalMemory, LifeArea, PriorityLevel } from '../types';
import {
  parseMagicCapture,
  MagicCaptureItem,
  MagicCaptureAmbiguity,
} from '../utils/naturalLanguageParser';
import { normalizeDate } from '../utils/dateUtils';

interface MagicCaptureModalProps {
  isOpen: boolean;
  initialText?: string;
  defaultArea?: string;
  areas?: LifeArea[];
  onClose: () => void;
  onSaveItems: (payload: {
    tasks: Array<Omit<Task, 'id' | 'completed'>>;
    events: Array<Omit<CalendarEvent, 'id'>>;
    memories: Array<Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>>;
  }) => void;
}

const DEFAULT_AREAS = ['Personal', 'Work', 'Home', 'Finance', 'Travel', 'Learning', 'Devices'];

export const MagicCaptureModal: React.FC<MagicCaptureModalProps> = ({
  isOpen,
  initialText = '',
  defaultArea,
  areas,
  onClose,
  onSaveItems,
}) => {
  const [rawText, setRawText] = useState(initialText);
  const [items, setItems] = useState<MagicCaptureItem[]>([]);
  const [ambiguity, setAmbiguity] = useState<MagicCaptureAmbiguity | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const areaOptions =
    areas && areas.length > 0
      ? areas.filter((a) => !a.hidden).map((a) => a.name)
      : DEFAULT_AREAS;

  useEffect(() => {
    if (isOpen) {
      setRawText(initialText);
      if (initialText.trim()) {
        const result = parseMagicCapture(initialText, defaultArea);
        setItems(result.items);
        setAmbiguity(result.ambiguity);
      } else {
        setItems([]);
        setAmbiguity(undefined);
        setTimeout(() => inputRef.current?.focus(), 60);
      }
    }
  }, [isOpen, initialText, defaultArea]);

  if (!isOpen) return null;

  const handleAnalyzeInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rawText.trim()) {
      setItems([]);
      setAmbiguity(undefined);
      return;
    }
    const result = parseMagicCapture(rawText, defaultArea);
    setItems(result.items);
    setAmbiguity(result.ambiguity);
  };

  const handleUpdateItem = (id: string, patch: Partial<MagicCaptureItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleResolveAmbiguity = (chosenValue: string) => {
    if (!ambiguity) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === ambiguity.targetItemIndex
          ? { ...item, [ambiguity.field]: chosenValue }
          : item
      )
    );
    setAmbiguity(undefined);
  };

  const handleConfirmSaveAll = () => {
    // If user typed something and clicked Add without analyzing first, parse it now
    let targetItems = items;
    if (targetItems.length === 0 && rawText.trim()) {
      const parsed = parseMagicCapture(rawText, defaultArea);
      if (parsed.items.length > 1 || parsed.ambiguity) {
        setItems(parsed.items);
        setAmbiguity(parsed.ambiguity);
        return;
      }
      targetItems = parsed.items;
    }

    if (targetItems.length === 0) return;

    const tasksToCreate: Array<Omit<Task, 'id' | 'completed'>> = [];
    const eventsToCreate: Array<Omit<CalendarEvent, 'id'>> = [];
    const memoriesToCreate: Array<Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>> = [];

    targetItems.forEach((item) => {
      if (item.type === 'event') {
        eventsToCreate.push({
          title: item.title.trim() || 'Untitled Event',
          date: normalizeDate(item.date || 'Today'),
          startTime: item.isAllDay ? undefined : item.time,
          endTime: item.endTime,
          time: item.isAllDay ? 'All day' : item.time || '',
          isAllDay: Boolean(item.isAllDay),
          area: item.area || defaultArea || 'Personal',
          recurring: item.recurring,
          recurrenceRule: item.recurrenceRule,
          isRecurring: Boolean(item.recurrenceRule || item.recurring),
          notes: item.notes,
        });
      } else if (item.type === 'memory') {
        memoriesToCreate.push({
          title: item.title.trim() || 'Saved Note',
          content: item.memoryContent || item.title.trim(),
          area: item.area || defaultArea || 'Personal',
        });
      } else {
        tasksToCreate.push({
          title: item.title.trim() || 'Untitled Task',
          dueDate: item.date || 'Today',
          time: item.time || undefined,
          priority: item.priority || 'medium',
          area: item.area || defaultArea || 'Personal',
          recurring: item.recurring,
          recurrenceRule: item.recurrenceRule,
          isRecurring: Boolean(item.recurrenceRule || item.recurring),
          isFocus: item.priority === 'high',
          notes: item.relationship || item.notes,
        });
      }
    });

    onSaveItems({
      tasks: tasksToCreate,
      events: eventsToCreate,
      memories: memoriesToCreate,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/25 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Magic Capture"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl p-5 sm:p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/15 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-base sm:text-lg font-semibold text-on-surface">
                Quick Capture
              </h2>
              <p className="text-xs text-outline">
                Type anything naturally — tasks, calendar events, or reminders together.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close capture"
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Natural Language Input */}
        <form onSubmit={handleAnalyzeInput} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl border border-outline-variant/30 focus-within:border-primary/50 px-3.5 py-2.5">
            <span className="material-symbols-outlined text-outline text-[20px]">
              magic_button
            </span>
            <input
              ref={inputRef}
              type="text"
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (e.target.value.trim()) {
                  const res = parseMagicCapture(e.target.value, defaultArea);
                  setItems(res.items);
                  setAmbiguity(res.ambiguity);
                } else {
                  setItems([]);
                  setAmbiguity(undefined);
                }
              }}
              placeholder='e.g. "Tomorrow dentist at 5 and remind me to buy toothpaste before that"'
              className="w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline focus:outline-none"
            />
          </div>
        </form>

        {/* Clarification Banner if Ambiguous */}
        {ambiguity && (
          <div className="p-3.5 rounded-xl bg-secondary-container/40 border border-secondary/30 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-on-surface">
              <span className="material-symbols-outlined text-secondary text-[18px]">
                help
              </span>
              <span>{ambiguity.question}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ambiguity.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleResolveAmbiguity(opt)}
                  className="px-3 py-1 rounded-full bg-surface-container-lowest hover:bg-secondary-container text-on-surface hover:text-on-secondary-fixed border border-outline-variant/30 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detected Records List (Confirmation / Edit Screen) */}
        {items.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-outline">
              <span className="font-semibold uppercase tracking-wider">
                Detected items ({items.length}) — review or edit before saving
              </span>
              {items.length > 1 && (
                <span className="text-secondary font-medium">Multi-item capture</span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-surface-container-low/60 border border-outline-variant/25 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Record Type Selector */}
                    <div className="flex items-center gap-1.5">
                      {(['task', 'event', 'memory'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => handleUpdateItem(item.id, { type: t })}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize transition-colors cursor-pointer flex items-center gap-1 ${
                            item.type === t
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {t === 'event'
                              ? 'calendar_today'
                              : t === 'memory'
                              ? 'psychology'
                              : 'check_circle'}
                          </span>
                          <span>{t === 'event' ? 'Calendar Event' : t === 'memory' ? 'Memory' : 'Task'}</span>
                        </button>
                      ))}
                    </div>

                    {/* Remove individual item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors cursor-pointer"
                      title="Remove this item"
                      aria-label={`Remove ${item.title}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>

                  {/* Title input */}
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-sm font-medium text-on-surface focus:outline-none focus:border-primary/40"
                    placeholder="Title"
                  />

                  {/* Metadata controls: Date, Time, Area, Priority */}
                  {item.type !== 'memory' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] text-outline font-medium">Date</label>
                        <input
                          type="text"
                          value={item.date}
                          onChange={(e) => handleUpdateItem(item.id, { date: e.target.value })}
                          placeholder="Today / Tomorrow"
                          className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-on-surface focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] text-outline font-medium">Time</label>
                        <input
                          type="text"
                          value={item.time || ''}
                          onChange={(e) => handleUpdateItem(item.id, { time: e.target.value })}
                          placeholder="Optional (e.g. 5:00 PM)"
                          className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-on-surface focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[10px] text-outline font-medium">Area</label>
                        <select
                          value={item.area}
                          onChange={(e) => handleUpdateItem(item.id, { area: e.target.value })}
                          className="px-2 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-on-surface focus:outline-none"
                        >
                          {areaOptions.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                      {item.type === 'task' && (
                        <div className="flex flex-col gap-0.5">
                          <label className="text-[10px] text-outline font-medium">Priority</label>
                          <select
                            value={item.priority || 'medium'}
                            onChange={(e) =>
                              handleUpdateItem(item.id, {
                                priority: e.target.value as PriorityLevel,
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-on-surface focus:outline-none"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="text-[10px] text-outline font-medium">Memory Details</label>
                      <input
                        type="text"
                        value={item.memoryContent || item.title}
                        onChange={(e) =>
                          handleUpdateItem(item.id, { memoryContent: e.target.value })
                        }
                        className="px-2.5 py-1 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-on-surface focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Relationship or Recurrence badge */}
                  {(item.relationship || item.recurring) && (
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {item.relationship && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container/70 text-on-secondary-fixed text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[13px]">link</span>
                          <span>Relationship: {item.relationship}</span>
                        </span>
                      )}
                      {item.recurring && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-secondary text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[13px]">sync</span>
                          <span>{item.recurring}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 px-3 rounded-xl bg-surface-container-low/40 border border-outline-variant/15 text-xs text-outline flex flex-col gap-1.5">
            <span className="font-semibold text-on-surface-variant">Examples you can try:</span>
            <span>• &ldquo;Tomorrow dentist at 5 and remind me to buy toothpaste before that&rdquo;</span>
            <span>• &ldquo;Finish project proposal by Friday high priority&rdquo;</span>
            <span>• &ldquo;Pay electricity bill every month&rdquo;</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={items.length === 0 && !rawText.trim()}
            onClick={handleConfirmSaveAll}
            className={`px-5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              items.length > 0 || rawText.trim()
                ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-container cursor-pointer'
                : 'bg-surface-container-high text-outline cursor-not-allowed opacity-60'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            <span>
              {items.length > 1 ? `Add all (${items.length})` : 'Save'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
