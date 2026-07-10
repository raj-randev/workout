export type DayName = 'Lower A' | 'Upper A' | 'Lower B' | 'Upper B';

export type SetEntry = {
  w: number;
  r: number;
  e: number | null;
};

export type ExerciseEntry = {
  exercise: string;
  sets: SetEntry[];
  notes?: string;
};

export type Session = {
  date: string;
  day: DayName;
  entries: ExerciseEntry[];
  partial?: boolean;
};

export type CustomExercise = {
  name: string;
  day: DayName;
  sets: number;
  reps: string;
};

export type AppData = {
  sessions: Session[];
  custom: CustomExercise[];
};
