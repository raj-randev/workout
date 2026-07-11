import type { AppData, CustomExercise, DayName, ExerciseEntry, SessionProgram, SetEntry, Session } from './types';
import { DAYS } from './data/days';
import { loadAppDataFromCloud, saveAppDataToCloud } from './cloudData';

const STORAGE_KEY = 'lift-log-app-data';
const APP_DATA_UPDATED_EVENT = 'app-data-updated';

const emptyData: AppData = {
  sessions: [],
  custom: [],
};

export function initializeProgram(data: AppData): SessionProgram[] {
  const base: SessionProgram[] = (Object.entries(DAYS) as [string, Array<[string, number, string]>][]).map(
    ([name, exercises]) => ({
      name,
      type: (name.startsWith('Upper') ? 'upper' : 'lower') as 'upper' | 'lower',
      exercises: exercises.map(([exName, sets, reps]) => ({
        name: exName,
        sets,
        reps,
        restSeconds: 60,
      })),
    })
  );
  // Merge existing custom exercises into the right session
  for (const c of data.custom) {
    const session = base.find((s) => s.name === c.day);
    if (session && !session.exercises.some((e) => e.name === c.name)) {
      session.exercises.push({ name: c.name, sets: c.sets, reps: c.reps, restSeconds: 60 });
    }
  }
  return base;
}

function createBlankSets(count: number): SetEntry[] {
  return Array.from({ length: count }, () => ({ w: 0, r: 0, e: null }));
}

function loadLocalAppData(): AppData {
  if (typeof window === 'undefined') return emptyData;

  const json = window.localStorage.getItem(STORAGE_KEY);
  if (!json) return emptyData;

  try {
    const parsed = JSON.parse(json) as AppData;
    if (!parsed.program) {
      parsed.program = initializeProgram(parsed);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
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
  const localData = loadLocalAppData();
  const cloudData = await loadAppDataFromCloud();

  if (cloudData) {
    if (!cloudData.program) cloudData.program = initializeProgram(cloudData);
    // Only trust cloud data if it is at least as complete as local.
    // This prevents an expired/empty cloud record from silently wiping localStorage.
    if (cloudData.sessions.length >= localData.sessions.length) {
      persistLocalAppData(cloudData);
      return { data: cloudData, source: 'cloud' };
    }
    // Local is richer — push it up to cloud and continue with local.
    void saveAppDataToCloud(localData);
  }

  return { data: localData, source: 'local' };
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

export function createSessionDraft(date: string, day: DayName, appData: AppData): Session {
  const sessionProgram = appData.program?.find((s) => s.name === day);
  if (sessionProgram) {
    const programEntries: ExerciseEntry[] = sessionProgram.exercises.map((e) => ({
      exercise: e.name,
      sets: createBlankSets(e.sets),
    }));
    // Also include any custom exercises not already in the program
    const customEntries: ExerciseEntry[] = appData.custom
      .filter((c) => c.day === day && !sessionProgram.exercises.some((e) => e.name === c.name))
      .map((c) => ({ exercise: c.name, sets: createBlankSets(c.sets) }));
    return { date, day, entries: [...programEntries, ...customEntries] };
  }
  // Fallback: use DAYS for known day names
  const dayExercises = (DAYS as Record<string, Array<[string, number, string]>>)[day];
  const baseEntries: ExerciseEntry[] = (dayExercises ?? []).map(([exercise, sets]) => ({
    exercise,
    sets: createBlankSets(sets),
  }));
  const customEntries: ExerciseEntry[] = appData.custom
    .filter((c) => c.day === day)
    .map((c) => ({ exercise: c.name, sets: createBlankSets(c.sets) }));
  return { date, day, entries: [...baseEntries, ...customEntries] };
}

export function addCustomExercise(exercise: CustomExercise, data: AppData): AppData {
  return { ...data, custom: [...data.custom, exercise] };
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
