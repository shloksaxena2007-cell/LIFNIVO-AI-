import {
  auth,
  db,
  doc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from '../firebase';
import { Task, CalendarEvent, LifeArea, PersonalMemory } from '../types';
import { isDemoRecord } from './initialData';

export type SyncState = 'saved' | 'saving' | 'synced' | 'syncing' | 'offline' | 'error';

export interface CloudUserData {
  tasks: Task[];
  events: CalendarEvent[];
  areas: LifeArea[];
  memories: PersonalMemory[];
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Checks if the user already has real user data stored in their cloud account.
 */
export async function checkCloudDataExists(userId: string): Promise<boolean> {
  const path = `users/${userId}/tasks`;
  try {
    const tasksSnapshot = await getDocs(collection(db, 'users', userId, 'tasks'));
    const realTasks = tasksSnapshot.docs.filter((d) => !isDemoRecord(d.id, d.data().title));
    if (realTasks.length > 0) return true;

    const eventsSnapshot = await getDocs(collection(db, 'users', userId, 'events'));
    const realEvents = eventsSnapshot.docs.filter((d) => !isDemoRecord(d.id, d.data().title));
    if (realEvents.length > 0) return true;

    const memoriesSnapshot = await getDocs(collection(db, 'users', userId, 'memories'));
    const realMemories = memoriesSnapshot.docs.filter((d) => !isDemoRecord(d.id, d.data().title));
    if (realMemories.length > 0) return true;

    const areasSnapshot = await getDocs(collection(db, 'users', userId, 'areas'));
    const realAreas = areasSnapshot.docs.filter((d) => d.data().isCustom);
    if (realAreas.length > 0) return true;

    return false;
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
    console.error('Error checking cloud data existence:', error);
    return false;
  }
}

/**
 * Loads all records belonging to the authenticated user from Firestore.
 * Automatically purges any legacy demo records if found.
 */
export async function loadCloudData(userId: string): Promise<CloudUserData> {
  let currentPath = `users/${userId}`;
  try {
    currentPath = `users/${userId}/tasks`;
    const tasksSnap = await getDocs(collection(db, 'users', userId, 'tasks'));
    currentPath = `users/${userId}/events`;
    const eventsSnap = await getDocs(collection(db, 'users', userId, 'events'));
    currentPath = `users/${userId}/areas`;
    const areasSnap = await getDocs(collection(db, 'users', userId, 'areas'));
    currentPath = `users/${userId}/memories`;
    const memoriesSnap = await getDocs(collection(db, 'users', userId, 'memories'));

    const tasks: Task[] = [];
    tasksSnap.forEach((d) => {
      const data = d.data() as Task;
      if (isDemoRecord(d.id, data.title)) {
        deleteDoc(doc(db, 'users', userId, 'tasks', d.id)).catch(() => {});
      } else {
        tasks.push({ ...data, id: d.id, userId });
      }
    });

    const events: CalendarEvent[] = [];
    eventsSnap.forEach((d) => {
      const data = d.data() as CalendarEvent;
      if (isDemoRecord(d.id, data.title)) {
        deleteDoc(doc(db, 'users', userId, 'events', d.id)).catch(() => {});
      } else {
        events.push({ ...data, id: d.id, userId });
      }
    });

    const areas: LifeArea[] = [];
    areasSnap.forEach((d) => {
      const data = d.data() as LifeArea;
      areas.push({ ...data, id: d.id, userId });
    });

    const memories: PersonalMemory[] = [];
    memoriesSnap.forEach((d) => {
      const data = d.data() as PersonalMemory;
      if (isDemoRecord(d.id, data.title)) {
        deleteDoc(doc(db, 'users', userId, 'memories', d.id)).catch(() => {});
      } else {
        memories.push({ ...data, id: d.id, userId });
      }
    });

    return { tasks, events, areas, memories };
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.GET, currentPath);
    }
    throw error;
  }
}

/**
 * Migrates local guest data to the user's Firestore cloud storage.
 * Only genuine user data is migrated; demo records are strictly excluded.
 */
export async function migrateGuestDataToCloud(
  userId: string,
  guestData: {
    tasks: Task[];
    events: CalendarEvent[];
    areas: LifeArea[];
    memories: PersonalMemory[];
  }
): Promise<void> {
  const userPath = `users/${userId}`;
  try {
    const batch = writeBatch(db);

    const userRef = doc(db, 'users', userId);
    batch.set(
      userRef,
      {
        uid: userId,
        lastSyncedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    guestData.tasks
      .filter((t) => !isDemoRecord(t.id, t.title))
      .forEach((t) => {
        const taskRef = doc(db, 'users', userId, 'tasks', t.id);
        batch.set(taskRef, { ...t, userId });
      });

    guestData.events
      .filter((e) => !isDemoRecord(e.id, e.title))
      .forEach((e) => {
        const eventRef = doc(db, 'users', userId, 'events', e.id);
        batch.set(eventRef, { ...e, userId });
      });

    guestData.areas.forEach((a) => {
      if (a.isCustom) {
        const areaRef = doc(db, 'users', userId, 'areas', a.id);
        batch.set(areaRef, { ...a, userId });
      }
    });

    guestData.memories
      .filter((m) => !isDemoRecord(m.id, m.title))
      .forEach((m) => {
        const memoryRef = doc(db, 'users', userId, 'memories', m.id);
        batch.set(memoryRef, { ...m, userId });
      });

    await batch.commit();
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
    throw error;
  }
}

/**
 * Saves or updates a single task in Firestore.
 */
export async function syncTaskToCloud(userId: string, task: Task): Promise<void> {
  if (isDemoRecord(task.id, task.title)) return;
  const path = `users/${userId}/tasks/${task.id}`;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', task.id);
    await setDoc(taskRef, { ...task, userId }, { merge: true });
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

/**
 * Deletes a task from Firestore.
 */
export async function removeTaskFromCloud(userId: string, taskId: string): Promise<void> {
  const path = `users/${userId}/tasks/${taskId}`;
  try {
    const taskRef = doc(db, 'users', userId, 'tasks', taskId);
    await deleteDoc(taskRef);
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    throw error;
  }
}

/**
 * Saves or updates a calendar event in Firestore.
 */
export async function syncEventToCloud(userId: string, event: CalendarEvent): Promise<void> {
  if (isDemoRecord(event.id, event.title)) return;
  const path = `users/${userId}/events/${event.id}`;
  try {
    const eventRef = doc(db, 'users', userId, 'events', event.id);
    await setDoc(eventRef, { ...event, userId }, { merge: true });
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

/**
 * Deletes a calendar event from Firestore.
 */
export async function removeEventFromCloud(userId: string, eventId: string): Promise<void> {
  const path = `users/${userId}/events/${eventId}`;
  try {
    const eventRef = doc(db, 'users', userId, 'events', eventId);
    await deleteDoc(eventRef);
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    throw error;
  }
}

/**
 * Saves or updates a custom area in Firestore.
 */
export async function syncAreaToCloud(userId: string, area: LifeArea): Promise<void> {
  const path = `users/${userId}/areas/${area.id}`;
  try {
    const areaRef = doc(db, 'users', userId, 'areas', area.id);
    await setDoc(areaRef, { ...area, userId }, { merge: true });
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

/**
 * Deletes a custom area from Firestore.
 */
export async function removeAreaFromCloud(userId: string, areaId: string): Promise<void> {
  const path = `users/${userId}/areas/${areaId}`;
  try {
    const areaRef = doc(db, 'users', userId, 'areas', areaId);
    await deleteDoc(areaRef);
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    throw error;
  }
}

/**
 * Saves or updates a personal memory in Firestore.
 */
export async function syncMemoryToCloud(userId: string, memory: PersonalMemory): Promise<void> {
  if (isDemoRecord(memory.id, memory.title)) return;
  const path = `users/${userId}/memories/${memory.id}`;
  try {
    const memoryRef = doc(db, 'users', userId, 'memories', memory.id);
    await setDoc(memoryRef, { ...memory, userId }, { merge: true });
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    throw error;
  }
}

/**
 * Deletes a personal memory from Firestore.
 */
export async function removeMemoryFromCloud(userId: string, memoryId: string): Promise<void> {
  const path = `users/${userId}/memories/${memoryId}`;
  try {
    const memoryRef = doc(db, 'users', userId, 'memories', memoryId);
    await deleteDoc(memoryRef);
  } catch (error) {
    if (String(error).includes('permission-denied') || String(error).includes('Missing or insufficient permissions')) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
    throw error;
  }
}
