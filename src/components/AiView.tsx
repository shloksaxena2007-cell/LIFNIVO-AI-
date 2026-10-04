import React, { useState, useRef, useEffect } from 'react';
import { Task, CalendarEvent, LifeArea, PersonalMemory } from '../types';
import { processUserRequest, AiActionResult, AssistantContext } from '../utils/aiAssistant';
import { LifnivoLogo } from './LifnivoLogo';
import { UserProfileAvatar } from './UserProfileAvatar';
import { FirebaseUser } from '../firebase';
import { MagicCaptureItem } from '../utils/naturalLanguageParser';
import { normalizeDate } from '../utils/dateUtils';

interface AiViewProps {
  tasks: Task[];
  events: CalendarEvent[];
  areas: LifeArea[];
  memories: PersonalMemory[];
  user?: FirebaseUser | null;
  onAddTask: (task: Omit<Task, 'id' | 'completed'>) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onAddMemory: (memory: Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onBatchDeleteCompletedTasks?: () => void;
  onOpenMagicCapture?: (initialText: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  actionResult?: AiActionResult;
  isPendingConfirmation?: boolean;
}

const QUICK_SUGGESTIONS = [
  'What should I do now?',
  'Plan my day.',
  'What do I need to do today?',
  'Weekly review.',
  'Organize my tasks.',
];

export const AiView: React.FC<AiViewProps> = ({
  tasks,
  events,
  areas,
  memories,
  user,
  onAddTask,
  onToggleTask,
  onEditTask,
  onAddEvent,
  onAddMemory,
  onBatchDeleteCompletedTasks,
  onOpenMagicCapture,
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [assistantContext, setAssistantContext] = useState<AssistantContext>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial calm greeting message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greeting',
      role: 'assistant',
      content:
        "Hello. I'm connected to your real LIFNIVO tasks, schedule, and life areas. Ask me to help organize or plan your life, add commitments, check deadlines, or organize your workload.",
      time: 'Ready',
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      try {
        const { reply, newContext } = processUserRequest(
          text,
          tasks,
          events,
          areas,
          memories,
          assistantContext
        );
        setAssistantContext(newContext);

        // Execute deterministic actions on real user data
        if (reply.type === 'task_created' && reply.createdTask) {
          onAddTask(reply.createdTask);
        } else if (reply.type === 'event_created' && reply.createdEvent) {
          onAddEvent(reply.createdEvent);
        } else if (reply.type === 'memory_saved' && reply.createdMemory) {
          onAddMemory(reply.createdMemory);
        } else if (reply.type === 'task_completed' && reply.affectedTask) {
          onToggleTask(reply.affectedTask.id);
        } else if (
          (reply.type === 'task_rescheduled' || reply.type === 'task_priority_updated') &&
          reply.affectedTask
        ) {
          onEditTask(reply.affectedTask);
        }

        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: reply.message,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionResult: reply,
          isPendingConfirmation: Boolean(reply.pendingConfirmation),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch {
        const fallbackMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "I couldn't complete that right now. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const handleConfirmAction = (msgId: string, actionType: string, payload?: any) => {
    if (actionType === 'delete_completed_tasks' && onBatchDeleteCompletedTasks) {
      onBatchDeleteCompletedTasks();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                isPendingConfirmation: false,
                content: 'All completed tasks have been deleted from your history.',
              }
            : m
        )
      );
    } else if (actionType === 'magic_capture' && Array.isArray(payload)) {
      const items = payload as MagicCaptureItem[];
      items.forEach((item) => {
        if (item.type === 'event') {
          onAddEvent({
            title: item.title,
            date: normalizeDate(item.date || 'Today'),
            startTime: item.isAllDay ? undefined : item.time,
            endTime: item.endTime,
            time: item.isAllDay ? 'All day' : item.time || '',
            isAllDay: Boolean(item.isAllDay),
            area: item.area || 'Personal',
            recurring: item.recurring,
            recurrenceRule: item.recurrenceRule,
            isRecurring: Boolean(item.recurrenceRule || item.recurring),
          });
        } else if (item.type === 'memory') {
          onAddMemory({
            title: item.title,
            content: item.memoryContent || item.title,
            area: item.area || 'Personal',
          });
        } else {
          onAddTask({
            title: item.title,
            dueDate: item.date || 'Today',
            time: item.time,
            priority: item.priority || 'medium',
            area: item.area || 'Personal',
            recurring: item.recurring,
            recurrenceRule: item.recurrenceRule,
            isRecurring: Boolean(item.recurrenceRule || item.recurring),
            isFocus: item.priority === 'high',
            notes: item.relationship || item.notes,
          });
        }
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                isPendingConfirmation: false,
                content: `Saved all ${items.length} items to your workspace.`,
              }
            : m
        )
      );
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              isPendingConfirmation: false,
              content: 'Action cancelled. Your tasks remain unchanged.',
            }
          : m
      )
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 flex flex-col gap-6 md:gap-8 min-h-[calc(100vh-140px)] justify-between">
      {/* HEADER */}
      <header className="flex flex-col items-center text-center gap-2 pb-2">
        <LifnivoLogo size={44} variant="icon" />
        <h1 className="text-3xl sm:text-4xl font-bold text-on-surface tracking-tight flex items-center gap-1.5">
          <span>LIFNIVO</span>
          <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent">AI</span>
        </h1>
        <p className="text-sm sm:text-base text-on-surface-variant max-w-lg">
          An AI-powered personal life organizer that brings tasks, calendar, notes, goals, reminders, plans, and important information into one place.
        </p>
      </header>

      {/* CONVERSATION STREAM */}
      <section
        aria-label="Conversation"
        className="flex-1 w-full flex flex-col gap-4 overflow-y-auto max-h-[58vh] pr-1 sm:pr-2"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const result = msg.actionResult;
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 max-w-[92%] sm:max-w-[85%] ${
                isUser ? 'self-end flex-row-reverse' : 'self-start flex-row'
              }`}
            >
              {isUser ? (
                <UserProfileAvatar
                  user={user || null}
                  size={32}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <LifnivoLogo
                  size={32}
                  variant="icon"
                  className="mt-0.5 shrink-0"
                />
              )}

              <div className="flex flex-col gap-1 min-w-0">
                <div
                  className={`rounded-2xl p-4 sm:p-5 shadow-sm text-sm sm:text-base leading-relaxed ${
                    isUser
                      ? 'bg-primary text-on-primary rounded-tr-xs'
                      : 'bg-surface-container-lowest text-on-surface border border-outline-variant/20 rounded-tl-xs'
                  }`}
                >
                <div className="whitespace-pre-line">{msg.content}</div>

                {result?.createdTask && (
                  <div className="mt-3 p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 text-xs text-on-surface flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-secondary text-[18px]">
                        task_alt
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate">{result.createdTask.title}</span>
                        <span className="text-[11px] text-outline">
                          {result.createdTask.dueDate || 'Today'} • {result.createdTask.area}
                          {result.createdTask.recurring && ` • ${result.createdTask.recurring}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {result?.createdEvent && (
                  <div className="mt-3 p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 text-xs text-on-surface flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-primary text-[18px]">
                        calendar_today
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate">{result.createdEvent.title}</span>
                        <span className="text-[11px] text-outline">
                          {result.createdEvent.date} • {result.createdEvent.time || 'All day'} •{' '}
                          {result.createdEvent.area}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {result?.createdMemory && (
                  <div className="mt-3 p-3 rounded-xl bg-surface-container-low/70 border border-outline-variant/20 text-xs text-on-surface flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-tertiary text-[18px]">
                        psychology
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold truncate">{result.createdMemory.title}</span>
                        <span className="text-[11px] text-outline truncate">
                          {result.createdMemory.content} • {result.createdMemory.area}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {result?.retrievedMemory && (
                  <div className="mt-3 p-3 rounded-xl bg-secondary-fixed/20 border border-secondary/20 text-xs text-on-surface flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">
                      bookmark
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-secondary">{result.retrievedMemory.title}</span>
                      <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                        {result.retrievedMemory.content}
                      </p>
                      {result.retrievedMemory.area && (
                        <span className="text-[10px] text-outline mt-1">
                          Context: {result.retrievedMemory.area}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {msg.isPendingConfirmation && result?.pendingConfirmation && (
                  <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center gap-2 justify-end flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleCancelAction(msg.id)}
                      className="px-3.5 py-1.5 rounded-full text-xs font-medium text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    {result.pendingConfirmation.action === 'magic_capture' && onOpenMagicCapture && (
                      <button
                        type="button"
                        onClick={() => {
                          const userMsg = messages.find((m) => m.role === 'user');
                          onOpenMagicCapture(userMsg?.content || '');
                        }}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer transition-colors"
                      >
                        Edit items
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        handleConfirmAction(
                          msg.id,
                          result.pendingConfirmation!.action,
                          result.pendingConfirmation!.payload
                        )
                      }
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm cursor-pointer transition-all ${
                        result.pendingConfirmation.action === 'magic_capture'
                          ? 'bg-primary text-on-primary hover:bg-primary-container'
                          : 'bg-error text-on-error hover:bg-error/90'
                      }`}
                    >
                      {result.pendingConfirmation.action === 'magic_capture' ? 'Add all' : 'Confirm'}
                    </button>
                  </div>
                )}
              </div>
              <span className={`text-[10px] text-outline px-1.5 ${isUser ? 'text-right' : 'text-left'}`}>{msg.time}</span>
            </div>
          </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-outline py-2 pl-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      {/* INPUT AREA & QUICK ACTIONS */}
      <footer className="w-full flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-center flex-wrap gap-2">
          {QUICK_SUGGESTIONS.map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => handleSendMessage(pill)}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 text-xs font-medium text-on-surface transition-all cursor-pointer shadow-xs active:scale-98"
            >
              {pill}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="relative w-full rounded-2xl sm:rounded-full bg-surface-container-lowest border border-outline-variant/30 shadow-md p-2 focus-within:shadow-xl focus-within:border-primary/40 transition-all flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-outline ml-3 text-[22px]">
            chat
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you need..."
            disabled={isLoading}
            className="w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline focus:outline-none py-2"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-10 px-5 rounded-full bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary-container transition-all disabled:opacity-50 cursor-pointer shrink-0 mr-1"
          >
            <span>Send</span>
            <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
          </button>
        </form>
      </footer>
    </div>
  );
};
