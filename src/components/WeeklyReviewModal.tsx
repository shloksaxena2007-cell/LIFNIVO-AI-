import React, { useMemo } from 'react';
import { Task, CalendarEvent } from '../types';
import { computeWeeklyReview, isTaskOverdue } from '../utils/reminderIntelligence';
import { formatDisplayDate, getTodayString } from '../utils/dateUtils';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  events: CalendarEvent[];
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  tasks,
  events,
  onToggleTask,
  onEditTask,
}) => {
  const review = useMemo(() => computeWeeklyReview(tasks, events), [tasks, events]);
  const todayISO = getTodayString();

  if (!isOpen) return null;

  const handleRescheduleTask = (task: Task, newDueDate: string) => {
    onEditTask({
      ...task,
      dueDate: newDueDate,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/25 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Weekly Life Review"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-2xl p-5 sm:p-7 flex flex-col gap-6 max-h-[90vh] overflow-y-auto text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/15 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">event_note</span>
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg sm:text-xl font-semibold text-on-surface tracking-tight">
                Weekly Life Review
              </h2>
              <p className="text-xs text-outline">
                A calm look at what you finished, what remains, and what is ahead.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close weekly review"
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* AI Observation Banner */}
        <section
          aria-label="AI weekly observation"
          className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3"
        >
          <span
            className="material-symbols-outlined text-primary text-[20px] mt-0.5 shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
            {review.aiObservation}
          </p>
        </section>

        {/* Quick Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/15 flex flex-col">
            <span className="text-[11px] text-outline font-medium">Completed</span>
            <span className="text-xl font-bold text-secondary mt-0.5">
              {review.completedTasks.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/15 flex flex-col">
            <span className="text-[11px] text-outline font-medium">Unfinished</span>
            <span className="text-xl font-bold text-on-surface mt-0.5">
              {review.unfinishedTasks.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/15 flex flex-col">
            <span className="text-[11px] text-outline font-medium">Upcoming (7d)</span>
            <span className="text-xl font-bold text-primary mt-0.5">
              {review.upcomingCommitments.length}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-surface-container-low/60 border border-outline-variant/15 flex flex-col">
            <span className="text-[11px] text-outline font-medium">Recurring</span>
            <span className="text-xl font-bold text-on-surface mt-0.5">
              {review.recurringItems.length}
            </span>
          </div>
        </div>

        {/* Unfinished & Needs Rescheduling Section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-on-surface">
              Unfinished tasks & items to reschedule ({review.unfinishedTasks.length})
            </h3>
            {review.overdueTasks.length > 0 && (
              <span className="text-[11px] font-semibold text-tertiary">
                {review.overdueTasks.length} overdue
              </span>
            )}
          </div>

          {review.unfinishedTasks.length === 0 ? (
            <p className="text-xs text-outline py-2 px-3 rounded-xl bg-surface-container-low/40">
              No unfinished tasks waiting for you.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
              {review.unfinishedTasks.slice(0, 8).map((task) => {
                const overdue = isTaskOverdue(task, todayISO);
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-medium text-on-surface truncate">
                          {task.title}
                        </span>
                        {overdue && (
                          <span className="px-2 py-0.5 rounded-full bg-error-container/40 text-error text-[10px] font-semibold shrink-0">
                            Overdue
                          </span>
                        )}
                        {task.priority === 'high' && (
                          <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[10px] font-semibold shrink-0">
                            High
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-outline mt-0.5">
                        {formatDisplayDate(task.dueDate || 'Today')} • {task.area}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task.id)}
                        className="px-2.5 py-1 rounded-full bg-secondary-container hover:bg-secondary-fixed text-on-secondary-fixed text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRescheduleTask(task, 'Today')}
                        className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRescheduleTask(task, 'Tomorrow')}
                        className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRescheduleTask(task, 'Next week')}
                        className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Next week
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming Commitments & Recurring Responsibilities */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">
              Upcoming commitments (Next 7 days)
            </h3>
            {review.upcomingCommitments.length === 0 ? (
              <p className="text-xs text-outline py-2 px-3 rounded-xl bg-surface-container-low/40">
                No calendar events in the next 7 days.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {review.upcomingCommitments.map((item, idx) => (
                  <div
                    key={`${item.event.id}-${idx}`}
                    className="p-2.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/15 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-on-surface truncate">
                        {item.event.title}
                      </span>
                      <span className="text-[11px] text-outline">
                        {item.event.time || item.event.startTime || 'All day'} • {item.event.area || 'Personal'}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-secondary shrink-0">
                      {item.displayDate}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">
              Recurring responsibilities
            </h3>
            {review.recurringItems.length === 0 ? (
              <p className="text-xs text-outline py-2 px-3 rounded-xl bg-surface-container-low/40">
                No recurring routines set up yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {review.recurringItems.map((rec) => (
                  <div
                    key={`${rec.type}-${rec.id}`}
                    className="p-2.5 rounded-xl bg-surface-container-low/50 border border-outline-variant/15 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-secondary text-[15px] shrink-0">
                        sync
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-on-surface truncate">
                          {rec.title}
                        </span>
                        <span className="text-[11px] text-outline">{rec.schedule}</span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant shrink-0">
                      {rec.area}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Completed Tasks History */}
        {review.completedTasks.length > 0 && (
          <section className="flex flex-col gap-2 pt-2 border-t border-outline-variant/15">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-outline">
              Recently completed ({review.completedTasks.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {review.completedTasks.slice(0, 8).map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-low text-outline text-xs line-through"
                >
                  <span className="material-symbols-outlined text-secondary text-[13px]">
                    check_circle
                  </span>
                  <span className="truncate max-w-[180px]">{t.title}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow-sm hover:bg-primary-container transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
