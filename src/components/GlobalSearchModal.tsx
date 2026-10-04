import React, { useState, useEffect, useRef } from 'react';
import { Task, CalendarEvent, LifeArea, PersonalMemory, SearchResultItem } from '../types';
import { performGlobalSearch, detectSensitiveContent } from '../utils/searchEngine';
import { isDemoRecord } from '../utils/initialData';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  events: CalendarEvent[];
  areas: LifeArea[];
  memories: PersonalMemory[];
  onSelectTask: (task: Task) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectArea: (areaId: string) => void;
  onAddMemory: (memory: Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onEditMemory: (memory: PersonalMemory) => void;
  onDeleteMemory: (id: string) => void;
}

type SearchFilter = 'all' | 'tasks' | 'events' | 'areas' | 'memory';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  tasks,
  events,
  areas,
  memories,
  onSelectTask,
  onSelectEvent,
  onSelectArea,
  onAddMemory,
  onEditMemory,
  onDeleteMemory,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('lifedesk_recent_searches');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean out any demo or seeded search terms
        return Array.isArray(parsed)
          ? parsed.filter((term: string) => !isDemoRecord(undefined, term))
          : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  // Memory creation & editing state
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [editingMemory, setEditingMemory] = useState<PersonalMemory | null>(null);
  const [viewingMemory, setViewingMemory] = useState<PersonalMemory | null>(null);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryArea, setMemoryArea] = useState('Personal');
  const [memoryTags, setMemoryTags] = useState('');
  const [sensitiveWarning, setSensitiveWarning] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setShowMemoryForm(false);
      setEditingMemory(null);
      setViewingMemory(null);
      setSensitiveWarning(null);
      setIsConfirmingDelete(false);
    }
  }, [isOpen]);

  // Keyboard shortcut listener: Escape closes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Save recent searches to localStorage
  const recordSearchTerm = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('lifedesk_recent_searches', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('lifedesk_recent_searches');
    } catch {
      // ignore
    }
  };

  // Perform search strictly on real user data
  const searchResults: SearchResultItem[] = query.trim()
    ? performGlobalSearch(query, activeFilter, { tasks, events, areas, memories })
    : [];

  // Memory management handlers
  const handleOpenAddMemory = () => {
    setEditingMemory(null);
    setMemoryTitle('');
    setMemoryContent('');
    setMemoryArea('Personal');
    setMemoryTags('');
    setSensitiveWarning(null);
    setShowMemoryForm(true);
  };

  const handleOpenEditMemory = (mem: PersonalMemory) => {
    setEditingMemory(mem);
    setViewingMemory(null);
    setMemoryTitle(mem.title);
    setMemoryContent(mem.content);
    setMemoryArea(mem.area || 'Personal');
    setMemoryTags((mem.tags || []).join(', '));
    setSensitiveWarning(null);
    setShowMemoryForm(true);
  };

  const handleSaveMemoryForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryTitle.trim() || !memoryContent.trim()) return;

    if (detectSensitiveContent(memoryTitle + ' ' + memoryContent)) {
      setSensitiveWarning(
        'For your privacy and protection, avoid storing passwords or payment cards in plain text.'
      );
    }

    const tagsArray = memoryTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (editingMemory) {
      onEditMemory({
        ...editingMemory,
        title: memoryTitle.trim(),
        content: memoryContent.trim(),
        area: memoryArea,
        tags: tagsArray,
        updatedAt: new Date().toISOString().split('T')[0],
      });
      setEditingMemory(null);
    } else {
      onAddMemory({
        title: memoryTitle.trim(),
        content: memoryContent.trim(),
        area: memoryArea,
        tags: tagsArray,
      });
    }
    setShowMemoryForm(false);
  };

  const handleDeleteMemoryConfirm = (id: string) => {
    onDeleteMemory(id);
    setViewingMemory(null);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 md:p-10 bg-on-surface/25 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 flex flex-col overflow-hidden max-h-[85vh] text-left transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* SEARCH INPUT BAR */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-outline-variant/15 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-outline text-[22px]">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.length > 2) {
                recordSearchTerm(e.target.value);
              }
            }}
            placeholder="Search LIFNIVO..."
            className="w-full bg-transparent text-sm sm:text-base text-on-surface placeholder:text-outline focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-outline hover:text-on-surface cursor-pointer"
              title="Clear input"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <kbd className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container text-outline">
            ESC
          </kbd>
        </div>

        {/* SEARCH FILTERS */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10 bg-surface-container-low/40 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'tasks', 'events', 'areas', 'memory'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-full font-medium capitalize transition-all cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-secondary-container text-on-secondary-fixed font-semibold shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {filter === 'memory' ? 'Memory' : filter}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleOpenAddMemory}
            className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">bookmark_add</span>
            <span>+ Save memory</span>
          </button>
        </div>

        {/* SENSITIVE CREDENTIAL WARNING */}
        {detectSensitiveContent(query) && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-tertiary-fixed/30 border border-tertiary/20 text-xs text-tertiary flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] shrink-0">shield</span>
            <span>
              Safety tip: We recommend keeping private passwords and credit card credentials in a
              secure password manager.
            </span>
          </div>
        )}

        {/* RESULTS & RECENTS CONTAINER */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[220px]">
          {/* Query active and results exist */}
          {query.trim() && searchResults.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider px-1">
                Results ({searchResults.length})
              </span>
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.type === 'task') {
                      onSelectTask(item.rawItem as Task);
                    } else if (item.type === 'event') {
                      onSelectEvent(item.rawItem as CalendarEvent);
                    } else if (item.type === 'area') {
                      onSelectArea((item.rawItem as LifeArea).id);
                    } else if (item.type === 'memory') {
                      setViewingMemory(item.rawItem as PersonalMemory);
                    }
                    if (item.type !== 'memory') {
                      onClose();
                    }
                  }}
                  className="p-3 rounded-xl bg-surface-container-low/60 hover:bg-surface-container border border-outline-variant/15 transition-all cursor-pointer flex items-start justify-between gap-3 text-left group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                        item.type === 'task'
                          ? 'bg-secondary/15 text-secondary'
                          : item.type === 'event'
                          ? 'bg-primary/15 text-primary'
                          : item.type === 'area'
                          ? 'bg-surface-container-highest text-on-surface'
                          : 'bg-tertiary/15 text-tertiary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {item.type === 'task'
                          ? 'check_circle'
                          : item.type === 'event'
                          ? 'calendar_today'
                          : item.type === 'area'
                          ? 'folder'
                          : 'psychology'}
                      </span>
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </span>
                      {item.snippet && (
                        <p className="text-xs text-outline line-clamp-1 mt-0.5">{item.snippet}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-outline">
                    {item.area && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
                        {item.area}
                      </span>
                    )}
                    {item.date && <span>{item.date}</span>}
                    {item.time && <span>• {item.time}</span>}
                    {item.isRecurring && (
                      <span className="text-secondary font-medium flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[13px]">sync</span>
                        {item.recurringLabel || 'Recurring'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Query active and NO results found */}
          {query.trim() && searchResults.length === 0 && (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-outline text-[32px]">
                search_off
              </span>
              <h3 className="text-sm sm:text-base font-semibold text-on-surface">
                No matching information found.
              </h3>
              <p className="text-xs text-outline max-w-sm">
                Try a different word or search across all of LIFNIVO.
              </p>
            </div>
          )}

          {/* Input empty: Show Recent Searches & Saved Personal Memories */}
          {!query.trim() && (
            <div className="flex flex-col gap-5">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-semibold text-outline uppercase tracking-wider">
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRecentSearches}
                      className="text-outline hover:text-on-surface hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setQuery(term);
                          recordSearchTerm(term);
                        }}
                        className="px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/20 text-xs text-on-surface transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[14px] text-outline">
                          history
                        </span>
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Personal Memory Overview */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-semibold text-outline uppercase tracking-wider">
                    Personal Memory ({memories.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenAddMemory}
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    + Add memory
                  </button>
                </div>

                {memories.length === 0 ? (
                  <div className="p-6 rounded-xl bg-surface-container-low/40 border border-dashed border-outline-variant/40 text-center flex flex-col items-center gap-1.5">
                    <span className="material-symbols-outlined text-outline text-[24px]">
                      psychology
                    </span>
                    <h4 className="text-sm font-semibold text-on-surface">
                      Save something important for later.
                    </h4>
                    <p className="text-xs text-outline max-w-sm">
                      Keep personal notes, preferences, or reference details here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {memories.map((mem) => (
                      <div
                        key={mem.id}
                        onClick={() => setViewingMemory(mem)}
                        className="p-3.5 rounded-xl bg-surface-container-low/60 hover:bg-surface-container border border-outline-variant/15 transition-all cursor-pointer flex flex-col justify-between gap-2 text-left"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-on-surface truncate">
                              {mem.title}
                            </span>
                            {mem.area && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-medium">
                                {mem.area}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                            {mem.content}
                          </p>
                        </div>
                        {mem.tags && mem.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mem.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-outline"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* VIEW / DELETE MEMORY DETAIL DIALOG */}
      {viewingMemory && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"
          onClick={() => setViewingMemory(null)}
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed font-semibold">
                Personal Memory
              </span>
              <button
                type="button"
                onClick={() => setViewingMemory(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-semibold text-on-surface">{viewingMemory.title}</h3>
              {viewingMemory.area && (
                <span className="text-xs text-outline">Area: {viewingMemory.area}</span>
              )}
            </div>
            <div className="p-3.5 rounded-xl bg-surface-container-low text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              {viewingMemory.content}
            </div>
            {viewingMemory.tags && viewingMemory.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewingMemory.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-3 border-t border-outline-variant/15">
              {isConfirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-error font-medium">Delete this memory?</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleDeleteMemoryConfirm(viewingMemory.id);
                      setIsConfirmingDelete(false);
                    }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-error text-on-error hover:bg-error/90 cursor-pointer shadow-xs"
                  >
                    Delete memory
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2.5 py-1 text-xs text-outline hover:text-on-surface cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-xs text-error hover:underline font-medium cursor-pointer"
                >
                  Delete memory
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewingMemory(null);
                    setIsConfirmingDelete(false);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    handleOpenEditMemory(viewingMemory);
                  }}
                  className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MEMORY FORM MODAL */}
      {showMemoryForm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-on-surface/20 backdrop-blur-sm"
          onClick={() => setShowMemoryForm(false)}
        >
          <form
            onSubmit={handleSaveMemoryForm}
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl p-6 shadow-2xl border border-outline-variant/30 flex flex-col gap-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/15">
              <h3 className="text-base font-semibold text-on-surface">
                {editingMemory ? 'Edit Memory' : 'Save to Personal Memory'}
              </h3>
              <button
                type="button"
                onClick={() => setShowMemoryForm(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            {sensitiveWarning && (
              <div className="p-3 rounded-xl bg-tertiary-fixed/30 text-xs text-tertiary">
                {sensitiveWarning}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Title <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={memoryTitle}
                onChange={(e) => setMemoryTitle(e.target.value)}
                placeholder="e.g. Passport location, Router setup..."
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-sm text-on-surface focus:outline-none border border-outline-variant/20"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface">
                Information <span className="text-error">*</span>
              </label>
              <textarea
                value={memoryContent}
                onChange={(e) => setMemoryContent(e.target.value)}
                placeholder="What details would you like to recall later?"
                rows={3}
                className="w-full px-3.5 py-2 rounded-xl bg-surface-container-low text-xs sm:text-sm text-on-surface focus:outline-none border border-outline-variant/20 resize-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Area</label>
                <select
                  value={memoryArea}
                  onChange={(e) => setMemoryArea(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/20 cursor-pointer"
                >
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Home">Home</option>
                  <option value="Learning">Learning</option>
                  <option value="Travel">Travel</option>
                  <option value="Devices">Devices</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-outline">Tags (optional)</label>
                <input
                  type="text"
                  value={memoryTags}
                  onChange={(e) => setMemoryTags(e.target.value)}
                  placeholder="wifi, docs, project"
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface border border-outline-variant/20"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
              <button
                type="button"
                onClick={() => setShowMemoryForm(false)}
                className="px-4 py-2 rounded-full text-xs font-medium text-outline hover:text-on-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full text-xs font-semibold bg-primary text-on-primary hover:bg-primary-container shadow-sm cursor-pointer"
              >
                {editingMemory ? 'Save changes' : 'Save memory'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
