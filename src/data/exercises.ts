type ExerciseCue = {
  muscle: string;
  look: string;
  vid?: string;
  set: string;
  mv: string;
  av: string;
};

export const EXERCISES: Record<string, ExerciseCue> = {
  'Leg Press': {
    muscle: 'Quads & glutes',
    look: 'leg press machine',
    vid: 'https://www.youtube.com/shorts/nDh_BlnLCGc',
    set: 'Hips and lower back flat against the pad; feet flat, mid-platform, shoulder-width.',
    mv: 'Push through the whole foot to near-lockout, lower under control to ~90°.',
    av: "Don't lock knees hard or let knees cave; keep feet flatter/lower to avoid pad pressure.",
  },
  'Seated Leg Curl': {
    muscle: 'Hamstrings',
    look: 'seated leg curl',
    set: 'Back into the seat, thigh pad snug, ankle pad on the back of the lower shin.',
    mv: 'Curl heels down and under, squeeze the hamstrings, return slowly.',
    av: "Don't let the hips lift off the seat or swing the weight.",
  },
  'Leg Extension': {
    muscle: 'Quads',
    look: 'leg extension machine',
    set: 'Knee joint lined up with the machine pivot; back against the pad, pad on lower shin.',
    mv: 'Extend smoothly to straight, squeeze the quads, lower with control.',
    av: "Don't kick or swing into the top; keep it steady.",
  },
  'Leg Press Calf Raise': {
    muscle: 'Calves',
    look: 'calf raise on leg press',
    set: 'On the leg press: legs almost straight (slight bend), balls of feet on the platform edge.',
    mv: 'Drop the heels for a big stretch, then press up through the toes; slow tempo.',
    av: "Don't bend the knees to push; the movement is at the ankle only.",
  },
  'Abdominal Crunch': {
    muscle: 'Abs',
    look: 'machine ab crunch',
    set: 'Sit tall, grip the handles/pads, ribs stacked over hips.',
    mv: 'Curl the ribs toward the pelvis, breathe out, control the return.',
    av: "Don't just hinge at the hips or yank with the arms — round through the middle.",
  },
  'Chest Press': {
    muscle: 'Chest',
    look: 'machine chest press',
    set: 'Back flat to the pad, handles level with mid-chest, elbows ~45° from the body.',
    mv: 'Press forward to near-extension, control the handles back to a stretch.',
    av: "Don't flare elbows to 90° or slam into lockout.",
  },
  'Lat Pulldown': {
    muscle: 'Lats & upper back',
    look: 'lat pulldown',
    set: 'Thighs locked under the pads, slight lean back, grip wider than shoulders.',
    mv: 'Pull elbows down toward your ribs, bar to the collarbone, control it back up.',
    av: "Don't heave with the whole body or pull behind the neck.",
  },
  'Shoulder Press': {
    muscle: 'Shoulders',
    look: 'machine shoulder press',
    set: 'Back supported, handles starting at about shoulder height.',
    mv: 'Press up smoothly, lower under control to shoulder height.',
    av: "Don't shrug the shoulders up or crash into a hard lockout.",
  },
  'Seated Row': {
    muscle: 'Mid-back',
    look: 'seated row machine',
    set: 'Chest tall, feet braced, slight forward reach to a stretch — no rounding.',
    mv: 'Pull the handles to your torso, drive elbows back, squeeze the shoulder blades.',
    av: "Don't round the back or jerk the torso to start the pull.",
  },
  'Lateral Raise': {
    muscle: 'Side delts',
    look: 'machine lateral raise',
    set: 'Sit tall, arms by your sides, a slight bend held in the elbows.',
    mv: 'Lead with the elbows and raise to shoulder height, lower slowly.',
    av: "Don't swing or go above shoulder height; keep it strict.",
  },
  'Triceps Pushdown': {
    muscle: 'Triceps',
    look: 'tricep pushdown cable',
    set: 'Stand close, elbows pinned to your sides, slight forward lean.',
    mv: 'Push down to full extension, control back up to about 90°.',
    av: "Don't let the elbows drift forward or flare out.",
  },
  'Biceps Curl (single-arm)': {
    muscle: 'Biceps',
    look: 'single arm cable bicep curl',
    set: 'One arm at a time, upper arm fixed at your side. Lead with the weaker left arm.',
    mv: 'Curl up and squeeze, lower slowly to a full stretch. Match reps on the right.',
    av: "Don't swing the elbow forward or use body momentum.",
  },
  'Hip Abductor': {
    muscle: 'Glutes & abductors',
    look: 'hip abduction machine',
    set: 'Sit upright, outer pads against the knees/thighs.',
    mv: 'Press the knees outward against the pads, return slowly.',
    av: "Don't lean back or bounce out of the bottom.",
  },
  'Hip Adduction': {
    muscle: 'Inner thigh (adductors)',
    look: 'hip adduction machine',
    set: 'Sit upright, pads against the inner knees/thighs, legs apart.',
    mv: 'Squeeze the knees together against the pads, return slowly.',
    av: "Don't lean or use momentum; controlled squeeze.",
  },
  'Back Extension': {
    muscle: 'Lower back & erectors',
    look: 'seated back extension machine',
    set: 'Seated lower-back machine: pad across the upper back, hips at the pivot.',
    mv: 'Extend back through the hips against the pad, return forward under control.',
    av: "Don't overextend or fling backward — controlled range only.",
  },
  'Pec Deck / Chest Fly': {
    muscle: 'Chest',
    look: 'pec deck',
    set: 'Back flat, slight fixed bend in the elbows, forearms on the pads.',
    mv: 'Bring the pads together in front of the chest, squeeze, open slowly.',
    av: "Don't shrug or let the shoulders roll forward.",
  },
  'Rear Delt': {
    muscle: 'Rear delts',
    look: 'reverse pec deck rear delt',
    set: 'Chest against the pad, slight fixed elbow bend, arms forward.',
    mv: 'Pull the arms back and out, squeezing the shoulder blades; control the return.',
    av: "Don't shrug or jerk; keep the chest pinned to the pad.",
  },
};

export function getExerciseDemoLink(exercise: string) {
  const item = EXERCISES[exercise];
  if (!item) return null;
  if (item.vid) return item.vid;
  return `https://www.google.com/search?q=${encodeURIComponent(item.look)}+machine+form`;
}
