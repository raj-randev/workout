import { read, utils } from 'xlsx';
import type { DayName, Session } from './types';

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return null;
    const parsed = new Date(cleaned);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9.\-]/g, '');
    if (!digits) return 0;
    const parsed = Number(digits);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function parseDay(value: unknown): DayName {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('lower') && normalized.includes('b')) return 'Lower B';
  if (normalized.includes('upper') && normalized.includes('b')) return 'Upper B';
  if (normalized.includes('upper') && normalized.includes('a')) return 'Upper A';
  if (normalized.includes('lower') && normalized.includes('a')) return 'Lower A';
  return 'Lower A';
}

function getColumnValue(row: Record<string, unknown>, aliases: string[]) {
  const normalized = Object.keys(row).map((key) => ({ original: key, normalized: normalizeHeader(key) }));
  const match = normalized.find((item) => aliases.includes(item.normalized));
  if (!match) return undefined;
  return row[match.original];
}

export async function importWorkbook(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(sheet, { defval: '', raw: false }) as Array<Record<string, unknown>>;

  const sessions = new Map<string, Session>();

  rows.forEach((row) => {
    const date = parseDate(getColumnValue(row, ['date', 'session date', 'workout date', 'training date'])) ?? new Date().toISOString().slice(0, 10);
    const day = parseDay(getColumnValue(row, ['day', 'training day', 'session day']));
    const exercise = String(getColumnValue(row, ['exercise', 'exercise name', 'movement', 'lift', 'name']) ?? '').trim();

    if (!exercise) {
      return;
    }

    const key = `${date}:${day}`;
    const session = sessions.get(key) ?? { date, day, entries: [] };

    const existingEntry = session.entries.find((entry) => entry.exercise === exercise);
    const sets = [{
      w: parseNumber(getColumnValue(row, ['weight', 'weight kg', 'kg', 'weight kg', 'load'])),
      r: parseNumber(getColumnValue(row, ['reps', 'repetitions', 'rep', 'reps completed'])),
      e: parseNumber(getColumnValue(row, ['effort', 'effort 10', 'rpe'])) || null,
    }];

    if (existingEntry) {
      existingEntry.sets.push(...sets);
    } else {
      session.entries.push({ exercise, sets });
    }

    sessions.set(key, session);
  });

  return Array.from(sessions.values()).sort((a, b) => a.date.localeCompare(b.date));
}
