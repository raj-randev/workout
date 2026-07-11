export type DayName = string;

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

export type ExerciseProgramEntry = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
};

export type SessionProgram = {
  name: string;
  type: 'upper' | 'lower';
  exercises: ExerciseProgramEntry[];
};

export type AppData = {
  sessions: Session[];
  custom: CustomExercise[];
  program?: SessionProgram[];
};
