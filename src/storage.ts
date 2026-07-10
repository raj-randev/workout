import type { AppData, CustomExercise, DayName, ExerciseEntry, SetEntry, Session } from './types';
import { DAYS } from './data/days';
import { loadAppDataFromCloud, saveAppDataToCloud } from './cloudData';

const STORAGE_KEY = 'lift-log-app-data';
const APP_DATA_UPDATED_EVENT = 'app-data-updated';

const emptyData: AppData = {
  sessions: [],
  custom: [],
};

function createDefaultSession(day: DayName, date: string): Session {
  return {
    date,
    day,
    entries: DAYS[day].map(([exercise, sets]) => ({
      exercise,
      sets: Array.from({ length: sets }, () => ({ w: 0, r: 0, e: null })),
    })),
  };
}

function createBlankSets(count: number): SetEntry[] {
  return Array.from({ length: count }, () => ({ w: 0, r: 0, e: null }));
}

function loadLocalAppData(): AppData {
  if (typeof window === 'undefined') {
    return emptyData;
  }

  const json = window.localStorage.getItem(STORAGE_KEY);
  if (!json) {
    return emptyData;
  }

  try {
    return JSON.parse(json) as AppData;
  } catch {
    return emptyData;
  }
}

function persistLocalAppData(data: AppData) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadAppData(): AppData {
  return loadLocalAppData();
}

export async function loadAppDataAsync(): Promise<{ data: AppData; source: 'cloud' | 'local' }> {
  const cloudData = await loadAppDataFromCloud();
  if (cloudData) {
    persistLocalAppData(cloudData);
    return { data: cloudData, source: 'cloud' };
  }

  return { data: loadLocalAppData(), source: 'local' };
}

export function saveAppData(data: AppData) {
  if (typeof window === 'undefined') return;
  persistLocalAppData(data);
  void saveAppDataToCloud(data);
  window.dispatchEvent(new Event(APP_DATA_UPDATED_EVENT));
}

export function findSession(date: string, day: DayName, data: AppData) {
  return data.sessions.find((session) => session.date === date && session.day === day);
}

export function deleteSession(date: string, day: DayName, data: AppData): AppData {
  return {
    ...data,
    sessions: data.sessions.filter((session) => !(session.date === date && session.day === day)),
  };
}

export function createSessionDraft(date: string, day: DayName, custom: CustomExercise[]): Session {
  const base = createDefaultSession(day, date);
  const customEntries: ExerciseEntry[] = custom
    .filter((exercise) => exercise.day === day)
    .map((exercise) => ({
      exercise: exercise.name,
      sets: createBlankSets(exercise.sets),
    }));

  return { ...base, entries: [...base.entries, ...customEntries] };
}

export function addCustomExercise(exercise: CustomExercise, data: AppData): AppData {
  return {
    ...data,
    custom: [...data.custom, exercise],
  };
}

export function removeCustomExercise(name: string, day: DayName, data: AppData): AppData {
  return {
    ...data,
    custom: data.custom.filter((exercise) => !(exercise.name === name && exercise.day === day)),
  };
}

const DRAFT_KEY = 'lift-log-draft';

export function saveDraftSession(session: Session): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
}

export function loadDraftSession(date: string, day: DayName): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Session;
    return data.date === date && data.day === day ? data : null;
  } catch {
    return null;
  }
}

export function clearDraftSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}
