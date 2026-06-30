import type { DayName } from '../types';

export const DAYS: Record<DayName, Array<[string, number, string]>> = {
  'Lower A': [
    ['Leg Press', 4, '5–8'],
    ['Seated Leg Curl', 3, '8–12'],
    ['Leg Extension', 3, '8–12'],
    ['Leg Press Calf Raise', 3, '10–15'],
    ['Abdominal Crunch', 3, '12–15'],
  ],
  'Upper A': [
    ['Chest Press', 4, '5–8'],
    ['Lat Pulldown', 4, '6–10'],
    ['Shoulder Press', 3, '8–12'],
    ['Seated Row', 3, '8–12'],
    ['Lateral Raise', 3, '12–15'],
    ['Triceps Pushdown', 3, '10–12'],
    ['Biceps Curl (single-arm)', 3, '10–12'],
  ],
  'Lower B': [
    ['Leg Press', 4, '6–10'],
    ['Seated Leg Curl', 3, '8–12'],
    ['Leg Extension', 3, '10–12'],
    ['Hip Abductor', 3, '12–15'],
    ['Hip Adduction', 3, '12–15'],
    ['Leg Press Calf Raise', 3, '10–15'],
    ['Back Extension', 3, '10–15'],
  ],
  'Upper B': [
    ['Seated Row', 4, '5–8'],
    ['Shoulder Press', 4, '6–10'],
    ['Pec Deck / Chest Fly', 3, '10–12'],
    ['Rear Delt', 3, '12–15'],
    ['Lateral Raise', 3, '12–15'],
    ['Biceps Curl (single-arm)', 3, '10–12'],
    ['Triceps Pushdown', 3, '10–12'],
  ],
};
