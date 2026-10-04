/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { TabType, Task, CalendarEvent, ScenarioPreset, LifeArea, AreaNote, PersonalMemory } from './types';
import {
  DEFAULT_TASKS,
  DEFAULT_EVENTS,
  INITIAL_AREAS,
  DEFAULT_AREA_NOTES,
  DEFAULT_MEMORIES,
  getScenarioData,
  isDemoRecord,
} from './utils/initialData';
import { getTodayString } from './utils/dateUtils';
import { calculateNextOccurrence, extractRecurrencePattern } from './utils/recurringUtils';
import {
  auth,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  testConnection,
  FirebaseUser,
} from './firebase';
import {
  SyncState,
  loadCloudData,
  migrateGuestDataToCloud,
  checkCloudDataExists,
  syncTaskToCloud,
  removeTaskFromCloud,
  syncEventToCloud,
  removeEventFromCloud,
  syncAreaToCloud,
  removeAreaFromCloud,
  syncMemoryToCloud,
  removeMemoryFromCloud,
} from './utils/cloudSync';
import { Navigation } from './components/Navigation';
import { Header } from './components/Header';
import { TodayView } from './components/TodayView';
import { TasksView } from './components/TasksView';
import { CalendarView } from './components/CalendarView';
import { AreasView } from './components/AreasView';
import { AiView } from './components/AiView';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MigrationDialog } from './components/MigrationDialog';
import { PublicLandingModal } from './components/PublicLandingModal';
import { FeedbackModal } from './components/FeedbackModal';
import { ShareModal } from './components/ShareModal';
import { AuthErrorModal, AuthErrorInfo } from './components/AuthErrorModal';
import { MagicCaptureModal } from './components/MagicCaptureModal';
import { WeeklyReviewModal } from './components/WeeklyReviewModal';
import { trackEvent } from './utils/analytics';

// Storage key scoping helpers for 100% guest and user isolation
function getStorageKey(user: FirebaseUser | null, type: string): string {
  if (user && user.uid) {
    return `lifedesk_user_${user.uid}_${type}`;
  }
  return `lifedesk_guest_${type}`;
}

function loadScopedData<T>(user: FirebaseUser | null, type: string, fallback: T): T {
  try {
    const key = getStorageKey(user, type);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter((item: any) => !isDemoRecord(item.id, item.title)) as unknown as T;
      }
      return parsed;
    }
    // Also check if legacy unscoped key exists and has real non-demo data for guest
    if (!user) {
      const legacySaved = localStorage.getItem(`lifedesk_${type}`);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved);
        if (Array.isArray(parsed)) {
          const nonDemo = parsed.filter((item: any) => !isDemoRecord(item.id, item.title));
          // Clean legacy key to prevent demo resurgence
          localStorage.removeItem(`lifedesk_${type}`);
          if (nonDemo.length > 0) {
            localStorage.setItem(`lifedesk_guest_${type}`, JSON.stringify(nonDemo));
            return nonDemo as unknown as T;
          }
        }
      }
    }
  } catch {
    // fallback
  }
  return fallback;
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('today');
  const [, setScenario] = useState<ScenarioPreset>('new_user');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Authentication & Cloud Sync State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('saved');
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [hasExistingCloudData, setHasExistingCloudData] = useState(false);

  // Growth / Welcome Modals
  const [showLandingModal, setShowLandingModal] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lifedesk_visited') !== 'true';
    } catch {
      return false;
    }
  });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const [isMagicCaptureOpen, setIsMagicCaptureOpen] = useState(false);
  const [magicCaptureInitialText, setMagicCaptureInitialText] = useState('');
  const [magicCaptureDefaultArea, setMagicCaptureDefaultArea] = useState<string | undefined>(undefined);
  const [showWeeklyReviewModal, setShowWeeklyReviewModal] = useState(false);

  // Scoped User / Guest state
  const [tasks, setTasks] = useState<Task[]>(() => loadScopedData<Task[]>(null, 'tasks', DEFAULT_TASKS));
  const [events, setEvents] = useState<CalendarEvent[]>(() => loadScopedData<CalendarEvent[]>(null, 'events', DEFAULT_EVENTS));
  const [areas, setAreas] = useState<LifeArea[]>(() => loadScopedData<LifeArea[]>(null, 'areas', INITIAL_AREAS));
  const [notes, setNotes] = useState<AreaNote[]>(() => loadScopedData<AreaNote[]>(null, 'notes', DEFAULT_AREA_NOTES));
  const [memories, setMemories] = useState<PersonalMemory[]>(() => loadScopedData<PersonalMemory[]>(null, 'memories', DEFAULT_MEMORIES));

  // Ref to track user changes and prevent writing previous user's data to new user's keys
  const activeUserRef = useRef<FirebaseUser | null>(null);
  const isAuthTransitioningRef = useRef(false);

  // Keyboard shortcut for Global Search (Cmd+K / Ctrl+K / /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save to scoped localStorage
  useEffect(() => {
    if (isAuthTransitioningRef.current) return;
    try {
      const key = getStorageKey(user, 'tasks');
      const cleanTasks = tasks.filter((t) => !isDemoRecord(t.id, t.title));
      localStorage.setItem(key, JSON.stringify(cleanTasks));
    } catch {
      // ignore
    }
  }, [tasks, user]);

  useEffect(() => {
    if (isAuthTransitioningRef.current) return;
    try {
      const key = getStorageKey(user, 'events');
      const cleanEvents = events.filter((e) => !isDemoRecord(e.id, e.title));
      localStorage.setItem(key, JSON.stringify(cleanEvents));
    } catch {
      // ignore
    }
  }, [events, user]);

  useEffect(() => {
    if (isAuthTransitioningRef.current) return;
    try {
      const key = getStorageKey(user, 'areas');
      localStorage.setItem(key, JSON.stringify(areas));
    } catch {
      // ignore
    }
  }, [areas, user]);

  useEffect(() => {
    if (isAuthTransitioningRef.current) return;
    try {
      const key = getStorageKey(user, 'notes');
      localStorage.setItem(key, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes, user]);

  useEffect(() => {
    if (isAuthTransitioningRef.current) return;
    try {
      const key = getStorageKey(user, 'memories');
      const cleanMemories = memories.filter((m) => !isDemoRecord(m.id, m.title));
      localStorage.setItem(key, JSON.stringify(cleanMemories));
    } catch {
      // ignore
    }
  }, [memories, user]);

  // Auth Subscription with strict account switching and data isolation
  useEffect(() => {
    testConnection();
    trackEvent('app_started');

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const previousUser = activeUserRef.current;
      activeUserRef.current = currentUser;
      isAuthTransitioningRef.current = true;

      if (currentUser) {
        setUser(currentUser);
        setSyncState('syncing');
        try {
          const cloudExists = await checkCloudDataExists(currentUser.uid);
          setHasExistingCloudData(cloudExists);

          // Check if guest has local un-synced data before sign-in
          const guestTasks = loadScopedData<Task[]>(null, 'tasks', []);
          const guestEvents = loadScopedData<CalendarEvent[]>(null, 'events', []);
          const guestMemories = loadScopedData<PersonalMemory[]>(null, 'memories', []);
          const hasLocalGuestData = guestTasks.length > 0 || guestEvents.length > 0 || guestMemories.length > 0;

          if (cloudExists) {
            // Load this specific user's cloud data
            const cloud = await loadCloudData(currentUser.uid);
            setTasks(cloud.tasks);
            setEvents(cloud.events);
            setAreas(cloud.areas.length > 0 ? cloud.areas : INITIAL_AREAS);
            setMemories(cloud.memories);

            if (hasLocalGuestData && !previousUser) {
              // Guest had local data, offer migration merge
              setShowMigrationDialog(true);
            }
          } else {
            // New user account with NO cloud data
            if (hasLocalGuestData && !previousUser) {
              // Prompt to migrate guest data to the new account
              setTasks(guestTasks);
              setEvents(guestEvents);
              setMemories(guestMemories);
              setShowMigrationDialog(true);
            } else {
              // Completely clean fresh workspace!
              setTasks([]);
              setEvents([]);
              setAreas(INITIAL_AREAS);
              setNotes([]);
              setMemories([]);
            }
          }
          setSyncState('synced');
        } catch (error) {
          console.error('Error during cloud sync initialization:', error);
          setSyncState('error');
        } finally {
          isAuthTransitioningRef.current = false;
        }
      } else {
        // User logged out -> Switch back to clean isolated Guest mode
        setUser(null);
        // Load isolated guest data or clean empty state
        const guestTasks = loadScopedData<Task[]>(null, 'tasks', []);
        const guestEvents = loadScopedData<CalendarEvent[]>(null, 'events', []);
        const guestAreas = loadScopedData<LifeArea[]>(null, 'areas', INITIAL_AREAS);
        const guestNotes = loadScopedData<AreaNote[]>(null, 'notes', []);
        const guestMemories = loadScopedData<PersonalMemory[]>(null, 'memories', []);

        setTasks(guestTasks);
        setEvents(guestEvents);
        setAreas(guestAreas);
        setNotes(guestNotes);
        setMemories(guestMemories);
        setSyncState('saved');
        isAuthTransitioningRef.current = false;
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync helpers
  const syncTask = async (task: Task) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await syncTaskToCloud(user.uid, task);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const removeTask = async (id: string) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await removeTaskFromCloud(user.uid, id);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const syncEvent = async (event: CalendarEvent) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await syncEventToCloud(user.uid, event);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const removeEvent = async (id: string) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await removeEventFromCloud(user.uid, id);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const syncArea = async (area: LifeArea) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await syncAreaToCloud(user.uid, area);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const removeArea = async (id: string) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await removeAreaFromCloud(user.uid, id);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const syncMemory = async (memory: PersonalMemory) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await syncMemoryToCloud(user.uid, memory);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  const removeMemory = async (id: string) => {
    if (!user) return;
    try {
      setSyncState('saving');
      await removeMemoryFromCloud(user.uid, id);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  // Migration Handlers
  const handleConfirmMigration = async () => {
    if (!user) return;
    setSyncState('syncing');
    setShowMigrationDialog(false);
    try {
      const guestTasks = loadScopedData<Task[]>(null, 'tasks', []);
      const guestEvents = loadScopedData<CalendarEvent[]>(null, 'events', []);
      const guestAreas = loadScopedData<LifeArea[]>(null, 'areas', INITIAL_AREAS);
      const guestMemories = loadScopedData<PersonalMemory[]>(null, 'memories', []);

      if (hasExistingCloudData) {
        const cloudData = await loadCloudData(user.uid);
        const mergedTasks = [...cloudData.tasks];
        guestTasks.forEach((gt) => {
          if (!mergedTasks.some((t) => t.id === gt.id)) mergedTasks.push(gt);
        });
        const mergedEvents = [...cloudData.events];
        guestEvents.forEach((ge) => {
          if (!mergedEvents.some((e) => e.id === ge.id)) mergedEvents.push(ge);
        });
        const mergedAreas = [...cloudData.areas];
        guestAreas.forEach((ga) => {
          if (ga.isCustom && !mergedAreas.some((a) => a.id === ga.id)) mergedAreas.push(ga);
        });
        const mergedMemories = [...cloudData.memories];
        guestMemories.forEach((gm) => {
          if (!mergedMemories.some((m) => m.id === gm.id)) mergedMemories.push(gm);
        });

        setTasks(mergedTasks);
        setEvents(mergedEvents);
        setAreas(mergedAreas.length > 0 ? mergedAreas : INITIAL_AREAS);
        setMemories(mergedMemories);

        await migrateGuestDataToCloud(user.uid, {
          tasks: mergedTasks,
          events: mergedEvents,
          areas: mergedAreas,
          memories: mergedMemories,
        });
      } else {
        await migrateGuestDataToCloud(user.uid, {
          tasks: guestTasks,
          events: guestEvents,
          areas: guestAreas,
          memories: guestMemories,
        });
        setTasks(guestTasks);
        setEvents(guestEvents);
        setAreas(guestAreas);
        setMemories(guestMemories);
      }

      // Clear guest local data once migrated into account
      localStorage.removeItem('lifedesk_guest_tasks');
      localStorage.removeItem('lifedesk_guest_events');
      localStorage.removeItem('lifedesk_guest_memories');
      localStorage.removeItem('lifedesk_guest_notes');

      setSyncState('synced');
    } catch (err) {
      console.error('Migration error:', err);
      setSyncState('error');
    }
  };

  const handleKeepAccountData = async () => {
    if (!user) return;
    setSyncState('syncing');
    setShowMigrationDialog(false);
    try {
      const cloudData = await loadCloudData(user.uid);
      setTasks(cloudData.tasks);
      setEvents(cloudData.events);
      setAreas(cloudData.areas.length > 0 ? cloudData.areas : INITIAL_AREAS);
      setMemories(cloudData.memories);

      // Clear guest local data
      localStorage.removeItem('lifedesk_guest_tasks');
      localStorage.removeItem('lifedesk_guest_events');
      localStorage.removeItem('lifedesk_guest_memories');
      localStorage.removeItem('lifedesk_guest_notes');

      setSyncState('synced');
    } catch (err) {
      console.error('Keep cloud data error:', err);
      setSyncState('error');
    }
  };

  const handleSignInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      const errorCode = error?.code || '';
      if (errorCode === 'auth/unauthorized-domain') {
        setAuthError({
          code: 'auth/unauthorized-domain',
          domain: window.location.hostname,
          message: 'This domain is not yet authorized in Firebase Authentication.',
        });
      } else if (errorCode === 'auth/popup-blocked') {
        setAuthError({
          code: 'auth/popup-blocked',
          message: 'The sign-in popup was blocked by your browser. Please allow popups for this site.',
        });
      } else if (errorCode !== 'auth/popup-closed-by-user') {
        setAuthError({
          code: errorCode || 'auth/unknown',
          message: error?.message || 'Failed to sign in with Google. Please try again.',
        });
      }
    }
  };

  const handleSignOut = async () => {
    try {
      isAuthTransitioningRef.current = true;
      await firebaseSignOut(auth);
      setUser(null);
      activeUserRef.current = null;

      // Reset in-memory view to empty guest state
      const cleanGuestTasks = loadScopedData<Task[]>(null, 'tasks', []);
      const cleanGuestEvents = loadScopedData<CalendarEvent[]>(null, 'events', []);
      const cleanGuestAreas = loadScopedData<LifeArea[]>(null, 'areas', INITIAL_AREAS);
      const cleanGuestNotes = loadScopedData<AreaNote[]>(null, 'notes', []);
      const cleanGuestMemories = loadScopedData<PersonalMemory[]>(null, 'memories', []);

      setTasks(cleanGuestTasks);
      setEvents(cleanGuestEvents);
      setAreas(cleanGuestAreas);
      setNotes(cleanGuestNotes);
      setMemories(cleanGuestMemories);
      setSyncState('saved');
    } catch (error) {
      console.error('Sign-out error:', error);
    } finally {
      isAuthTransitioningRef.current = false;
    }
  };

  const handleRetrySync = async () => {
    if (!user) return;
    setSyncState('syncing');
    try {
      await migrateGuestDataToCloud(user.uid, {
        tasks,
        events,
        areas,
        memories,
      });
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  };

  // Scenario preset handler (always empty or user-driven)
  const _handleSelectScenario = (preset: ScenarioPreset) => {
    setScenario(preset);
    const data = getScenarioData(preset);
    setTasks(data.tasks);
    setEvents(data.events);
  };

  // Task actions
  const handleAddTask = (newTaskData: Omit<Task, 'id' | 'completed'>) => {
    const newTask: Task = {
      ...newTaskData,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      completed: false,
      userId: user?.uid,
    };
    setTasks((prev) => [newTask, ...prev]);
    syncTask(newTask);
    trackEvent('task_created');
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;

      // Uncompleting a task
      if (task.completed) {
        const updated = { ...task, completed: false, completedAt: undefined };
        syncTask(updated);
        return prev.map((t) => (t.id === id ? updated : t));
      }

      // If completing a normal (non-recurring) task
      if (!task.isRecurring && !task.recurrenceRule && !task.recurring) {
        const updated = { ...task, completed: true, completedAt: new Date().toISOString() };
        syncTask(updated);
        trackEvent('task_completed');
        return prev.map((t) => (t.id === id ? updated : t));
      }

      // Completing a recurring task occurrence
      const completedTask: Task = {
        ...task,
        completed: true,
        completedAt: new Date().toISOString(),
        seriesId: task.seriesId || task.id,
      };
      syncTask(completedTask);
      trackEvent('task_completed');

      let rule = task.recurrenceRule;
      if (!rule && task.recurring) {
        rule = extractRecurrencePattern(task.recurring).rule || {
          frequency: 'weekly',
          interval: 1,
          label: task.recurring,
        };
      }

      const nextDueDate = calculateNextOccurrence(task.dueDate || getTodayString(), rule);
      if (!nextDueDate) {
        return prev.map((t) => (t.id === id ? completedTask : t));
      }

      const nextTask: Task = {
        id: `task-${Date.now()}`,
        title: task.title,
        completed: false,
        dueDate: nextDueDate,
        time: task.time,
        priority: task.priority,
        area: task.area,
        isFocus: task.isFocus,
        recurring: task.recurring,
        recurrenceRule: rule,
        isRecurring: true,
        seriesId: task.seriesId || task.id,
        notes: task.notes,
        userId: user?.uid,
      };
      syncTask(nextTask);

      return [nextTask, ...prev.map((t) => (t.id === id ? completedTask : t))];
    });
  };

  const handleSkipTaskOccurrence = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        let rule = t.recurrenceRule;
        if (!rule && t.recurring) {
          rule = extractRecurrencePattern(t.recurring).rule;
        }
        const nextDate = calculateNextOccurrence(t.dueDate || getTodayString(), rule);
        if (!nextDate) return t;
        const updated = {
          ...t,
          dueDate: nextDate,
          skippedDates: [...(t.skippedDates || []), t.dueDate || getTodayString()],
        };
        syncTask(updated);
        return updated;
      })
    );
  };

  const handleStopTaskRecurring = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = {
          ...t,
          isRecurring: false,
          recurring: undefined,
          recurrenceRule: undefined,
        };
        syncTask(updated);
        return updated;
      })
    );
  };

  const handleToggleFocus = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, isFocus: !t.isFocus };
        syncTask(updated);
        return updated;
      })
    );
  };

  const handleEditTask = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    syncTask(updatedTask);
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    removeTask(id);
  };

  const handleBatchDeleteCompletedTasks = () => {
    const toDelete = tasks.filter((t) => t.completed);
    toDelete.forEach((t) => removeTask(t.id));
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  const handleRestoreTask = (restoredTask: Task) => {
    setTasks((prev) => [restoredTask, ...prev]);
    syncTask(restoredTask);
  };

  // Calendar event actions
  const handleAddEvent = (newEventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...newEventData,
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user?.uid,
    };
    setEvents((prev) => [newEvent, ...prev]);
    syncEvent(newEvent);
    trackEvent('calendar_event_created');
  };

  const handleEditEvent = (updatedEvent: CalendarEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    );
    syncEvent(updatedEvent);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    removeEvent(id);
  };

  const handleSkipEventOccurrence = (id: string, date: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const updated = {
          ...e,
          skippedDates: [...(e.skippedDates || []), date],
        };
        syncEvent(updated);
        return updated;
      })
    );
  };

  const handleStopEventRecurring = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const updated = {
          ...e,
          isRecurring: false,
          recurring: undefined,
          recurrenceRule: undefined,
        };
        syncEvent(updated);
        return updated;
      })
    );
  };

  // Area actions
  const handleAddArea = (newAreaData: Omit<LifeArea, 'id'>) => {
    const newArea: LifeArea = {
      ...newAreaData,
      id: `area-${Date.now()}`,
      userId: user?.uid,
    };
    setAreas((prev) => [...prev, newArea]);
    syncArea(newArea);
  };

  const handleEditArea = (updatedArea: LifeArea) => {
    const prevArea = areas.find((a) => a.id === updatedArea.id);
    const oldName = prevArea?.name;
    setAreas((prev) => prev.map((a) => (a.id === updatedArea.id ? updatedArea : a)));
    syncArea(updatedArea);

    if (oldName && oldName !== updatedArea.name) {
      setTasks((prev) =>
        prev.map((t) => (t.area === oldName ? { ...t, area: updatedArea.name } : t))
      );
      setEvents((prev) =>
        prev.map((e) => (e.area === oldName ? { ...e, area: updatedArea.name } : e))
      );
      setNotes((prev) =>
        prev.map((n) => (n.area === oldName ? { ...n, area: updatedArea.name } : n))
      );
    }
  };

  const handleDeleteArea = (
    areaId: string,
    itemAction: 'keep' | 'reassign',
    reassignAreaName?: string
  ) => {
    const areaToDelete = areas.find((a) => a.id === areaId);
    if (!areaToDelete) return;
    const targetName = itemAction === 'reassign' && reassignAreaName ? reassignAreaName : 'Personal';

    setAreas((prev) => prev.filter((a) => a.id !== areaId));
    removeArea(areaId);

    setTasks((prev) =>
      prev.map((t) =>
        t.area === areaToDelete.name ? { ...t, area: targetName } : t
      )
    );
    setEvents((prev) =>
      prev.map((e) =>
        e.area === areaToDelete.name ? { ...e, area: targetName } : e
      )
    );
    setNotes((prev) =>
      prev.map((n) =>
        n.area === areaToDelete.name ? { ...n, area: targetName } : n
      )
    );
  };

  // Note actions
  const handleAddNote = (newNoteData: Omit<AreaNote, 'id' | 'updatedAt'>) => {
    const newNote: AreaNote = {
      ...newNoteData,
      id: `note-${Date.now()}`,
      updatedAt: 'Just now',
      userId: user?.uid,
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Personal Memory actions
  const handleAddMemory = (newMemoryData: Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>) => {
    const todayISO = getTodayString();
    const newMemory: PersonalMemory = {
      ...newMemoryData,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: todayISO,
      updatedAt: todayISO,
      userId: user?.uid,
    };
    setMemories((prev) => [newMemory, ...prev]);
    syncMemory(newMemory);
    trackEvent('memory_saved');
  };

  const handleOpenMagicCapture = (initialText = '', defaultArea?: string) => {
    setMagicCaptureInitialText(initialText);
    setMagicCaptureDefaultArea(defaultArea);
    setIsMagicCaptureOpen(true);
  };

  const handleSaveMagicCaptureItems = (payload: {
    tasks: Array<Omit<Task, 'id' | 'completed'>>;
    events: Array<Omit<CalendarEvent, 'id'>>;
    memories: Array<Omit<PersonalMemory, 'id' | 'createdAt' | 'updatedAt'>>;
  }) => {
    payload.tasks.forEach((t) => handleAddTask(t));
    payload.events.forEach((e) => handleAddEvent(e));
    payload.memories.forEach((m) => handleAddMemory(m));
  };

  const handleEditMemory = (updatedMemory: PersonalMemory) => {
    setMemories((prev) =>
      prev.map((m) => (m.id === updatedMemory.id ? updatedMemory : m))
    );
    syncMemory(updatedMemory);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    removeMemory(id);
  };

  return (
    <div className="min-h-screen w-full bg-[#f9f9fc] text-[#1a1c1e] flex flex-col antialiased overflow-x-hidden relative">
      {/* Navigation (Desktop Left Sidebar + Mobile Bottom Dock) */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />

      {/* Main View Area */}
      <div className="md:pl-64 flex-1 flex flex-col min-h-screen w-full max-w-full overflow-x-hidden pt-16 pb-20 md:pb-12">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenQuickCapture={() => handleOpenMagicCapture('')}
          user={user}
          syncState={syncState}
          onSignInWithGoogle={handleSignInWithGoogle}
          onSignOut={handleSignOut}
          taskCount={tasks.length}
          eventCount={events.length}
          memoryCount={memories.length}
          onOpenAbout={() => setShowLandingModal(true)}
          onOpenFeedback={() => setShowFeedbackModal(true)}
          onOpenShare={() => setShowShareModal(true)}
          onRetrySync={handleRetrySync}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 w-full max-w-full">
          {currentTab === 'today' && (
            <TodayView
              tasks={tasks}
              events={events}
              memories={memories}
              user={user}
              onAddTask={handleAddTask}
              onAddEvent={handleAddEvent}
              onAddMemory={handleAddMemory}
              onToggleTask={handleToggleTask}
              onToggleFocus={handleToggleFocus}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onSkipTask={handleSkipTaskOccurrence}
              onOpenMagicCapture={(text) => handleOpenMagicCapture(text)}
              onOpenWeeklyReview={() => setShowWeeklyReviewModal(true)}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView
              tasks={tasks}
              areas={areas}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onRestoreTask={handleRestoreTask}
              onSkipTask={handleSkipTaskOccurrence}
              onStopRecurring={handleStopTaskRecurring}
              onOpenMagicCapture={(text) => handleOpenMagicCapture(text)}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView
              events={events}
              tasks={tasks}
              areas={areas}
              onAddEvent={handleAddEvent}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
              onToggleTask={handleToggleTask}
              onSkipEvent={handleSkipEventOccurrence}
              onStopRecurringEvent={handleStopEventRecurring}
              onOpenMagicCapture={(text) => handleOpenMagicCapture(text)}
            />
          )}

          {currentTab === 'areas' && (
            <AreasView
              areas={areas}
              notes={notes}
              tasks={tasks}
              events={events}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onAddEvent={handleAddEvent}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
              onAddArea={handleAddArea}
              onEditArea={handleEditArea}
              onDeleteArea={handleDeleteArea}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onOpenMagicCapture={(text, areaName) => handleOpenMagicCapture(text, areaName)}
            />
          )}

          {currentTab === 'ai' && (
            <AiView
              tasks={tasks}
              events={events}
              areas={areas}
              memories={memories}
              user={user}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onAddEvent={handleAddEvent}
              onEditEvent={handleEditEvent}
              onDeleteEvent={handleDeleteEvent}
              onAddMemory={handleAddMemory}
              onBatchDeleteCompletedTasks={handleBatchDeleteCompletedTasks}
              onOpenMagicCapture={(text) => handleOpenMagicCapture(text)}
            />
          )}
        </main>

        {/* Calm Public Footer */}
        <footer className="mt-auto pt-8 pb-4 px-4 sm:px-8 border-t border-outline-variant/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-outline">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-on-surface-variant">LIFNIVO AI</span>
            <span>•</span>
            <span>Your life. Simplified.</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowLandingModal(true)}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="hover:text-on-surface transition-colors cursor-pointer"
            >
              Feedback
            </button>
          </div>
        </footer>
      </div>

      {/* GLOBAL SEARCH & PERSONAL MEMORY MODAL */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        tasks={tasks}
        events={events}
        areas={areas}
        memories={memories}
        onSelectTask={() => setCurrentTab('tasks')}
        onSelectEvent={() => setCurrentTab('calendar')}
        onSelectArea={() => setCurrentTab('areas')}
        onAddMemory={handleAddMemory}
        onEditMemory={handleEditMemory}
        onDeleteMemory={handleDeleteMemory}
      />

      {/* GUEST-TO-ACCOUNT MIGRATION DIALOG */}
      <MigrationDialog
        isOpen={showMigrationDialog}
        hasCloudData={hasExistingCloudData}
        taskCount={tasks.length}
        eventCount={events.length}
        recurringCount={tasks.filter((t) => t.recurring || t.isRecurring).length}
        memoryCount={memories.length}
        onConfirmMigrate={handleConfirmMigration}
        onKeepAccountData={handleKeepAccountData}
        onCancel={() => setShowMigrationDialog(false)}
      />

      {/* PUBLIC LAUNCH LANDING MODAL */}
      <PublicLandingModal
        isOpen={showLandingModal}
        onClose={() => {
          setShowLandingModal(false);
          try {
            localStorage.setItem('lifedesk_visited', 'true');
          } catch {
            // ignore
          }
        }}
        onSignInWithGoogle={handleSignInWithGoogle}
      />

      {/* LIGHTWEIGHT FEEDBACK & REPORT A PROBLEM MODAL */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        userEmail={user?.email}
      />

      {/* SHARE MODAL */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* AUTH ERROR / DOMAIN AUTHORIZATION MODAL */}
      <AuthErrorModal
        error={authError}
        onClose={() => setAuthError(null)}
        onRetry={handleSignInWithGoogle}
      />

      {/* MAGIC CAPTURE & QUICK CAPTURE EVERYWHERE MODAL */}
      <MagicCaptureModal
        isOpen={isMagicCaptureOpen}
        initialText={magicCaptureInitialText}
        defaultArea={magicCaptureDefaultArea}
        areas={areas}
        onClose={() => setIsMagicCaptureOpen(false)}
        onSaveItems={handleSaveMagicCaptureItems}
      />

      {/* WEEKLY LIFE REVIEW MODAL */}
      <WeeklyReviewModal
        isOpen={showWeeklyReviewModal}
        onClose={() => setShowWeeklyReviewModal(false)}
        tasks={tasks}
        events={events}
        onToggleTask={handleToggleTask}
        onEditTask={handleEditTask}
      />
    </div>
  );
}
