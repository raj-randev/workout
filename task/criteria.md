# Lift Log — Build Prompt for Claude Code

Paste this whole file into Claude Code (VS Code) as the project brief. It describes a React web app to build and deploy to **AWS Amplify Hosting** at **`workout.raj-ran.dev`**. Work through it in the order given, pausing for my confirmation at each deploy/AWS step.

---

## 1. Goal

A personal, mobile-first strength-training app for a machine-based 4-day upper/lower programme. It must:

- Log sessions (weight, reps, effort) per exercise, structured by training day.
- Persist data **reliably** (this is replacing an artifact prototype whose sandbox storage failed on mobile — a real deployed site with proper storage is the whole point).
- Show progress graphs per lift with selectable time ranges.
- Let me add/edit/delete sessions and add custom exercises.
- Include a **Form Reference** section with a cue card per exercise.
- Export a session as text ("Copy for Claude") so I can paste it into a chat for coaching.
- Deploy to AWS Amplify on the custom domain `workout.raj-ran.dev`.

I'm a web developer (WordPress/DevOps background, comfortable with CI/CD, AWS CLI, DNS), so you can be technical and move quickly, but **always show me AWS commands before running them** and never put secrets in code.

---

## 2. Tech stack

- **React 18 + Vite + TypeScript**.
- Routing: `react-router-dom` (tabs: Log, Progress, Form).
- Charts: hand-rolled SVG (no heavy chart lib needed) — or `recharts` if you prefer, your call.
- State: React hooks + a small store module; no Redux.
- **Persistence (Phase 1): `localStorage` via a typed wrapper.** localStorage works fine in a normally-hosted site (the earlier failure was specific to a sandboxed artifact). Abstract it behind a `storage` interface so it can be swapped later.
- **Persistence (Phase 2, optional stretch): AWS Amplify Gen 2 backend** (`@aws-amplify/backend`) with Cognito auth + a `Session` data model in DynamoDB, for cross-device sync. Build Phase 1 first and deploy it; only do Phase 2 if I ask.
- Styling: plain CSS (CSS variables) or CSS modules. No Tailwind required.
- PWA: add a web manifest + service worker so I can "Add to Home Screen" and use it offline at the gym. Use `vite-plugin-pwa`.

---

## 3. Design tokens (match the existing prototype)

Athletic, dark, high-contrast for gym lighting. Fonts via Google Fonts: **Oswald** (display/headings/labels, uppercase) and **Inter** (body).

```
--bg:#15171C; --card:#F7F6F2; --ink:#1F2530; --muted:#6A7180;
--accent:#F2683C;            /* movement / primary */
--lower:#1E8F84;             /* Lower day tag */
--upper:#4C63B6;             /* Upper day tag */
--ok:#2E9E5B; --avoid:#C0392B;
```

Cards: off-white on dark bg, 3px accent top border, rounded 14px. Day filter pills coloured by lower/upper. Mobile-first, single column; 2 columns ≥640px.

---

## 4. Data model

```ts
type SetEntry = { w: number; r: number; e: number | null }; // weight kg, reps, effort/10
type ExerciseEntry = { exercise: string; sets: SetEntry[] };
type Session = { date: string; day: DayName; entries: ExerciseEntry[] }; // date = YYYY-MM-DD
type CustomExercise = { name: string; day: DayName; sets: number; reps: string };
type AppData = { sessions: Session[]; custom: CustomExercise[] };
type DayName = 'Lower A' | 'Upper A' | 'Lower B' | 'Upper B';
```

Sessions are keyed/identified by `date + day`. Keep sessions sorted ascending by date.

---

## 5. The programme (seed `DAYS`)

Each entry is `[exerciseName, sets, repRange]`.

```ts
const DAYS = {
  'Lower A': [['Leg Press',4,'5–8'],['Seated Leg Curl',3,'8–12'],['Leg Extension',3,'8–12'],
    ['Leg Press Calf Raise',3,'10–15'],['Abdominal Crunch',3,'12–15']],
  'Upper A': [['Chest Press',4,'5–8'],['Lat Pulldown',4,'6–10'],['Shoulder Press',3,'8–12'],
    ['Seated Row',3,'8–12'],['Lateral Raise',3,'12–15'],['Triceps Pushdown',3,'10–12'],
    ['Biceps Curl (single-arm)',3,'10–12']],
  'Lower B': [['Leg Press',4,'6–10'],['Seated Leg Curl',3,'8–12'],['Leg Extension',3,'10–12'],
    ['Hip Abductor',3,'12–15'],['Hip Adduction',3,'12–15'],['Leg Press Calf Raise',3,'10–15'],
    ['Back Extension',3,'10–15']],
  'Upper B': [['Seated Row',4,'5–8'],['Shoulder Press',4,'6–10'],['Pec Deck / Chest Fly',3,'10–12'],
    ['Rear Delt',3,'12–15'],['Lateral Raise',3,'12–15'],['Biceps Curl (single-arm)',3,'10–12'],
    ['Triceps Pushdown',3,'10–12']],
};
```

Notes to honour in the UI/cues: feet flatter and lower on the Leg Press (avoids foot-pad pressure); single-arm Biceps Curl leads with the **left** (weaker) arm and matches reps on the right; keep the deeper Leg Press seat for fuller range.

---

## 6. Form Reference cue cards (seed `EXERCISES`)

Each card shows: name, working muscle, three cues (**Set up / Move / Avoid**), and a "Watch demo" link. Use the per-exercise search term to build a demo link `https://www.google.com/search?q=<encoded term>+machine+form`, except Leg Press which has a pinned video.

```ts
const EXERCISES = {
  'Leg Press': { muscle:'Quads & glutes', look:'leg press machine',
    vid:'https://www.youtube.com/shorts/nDh_BlnLCGc',
    set:'Hips and lower back flat against the pad; feet flat, mid-platform, shoulder-width.',
    mv:'Push through the whole foot to near-lockout, lower under control to ~90°.',
    av:"Don't lock knees hard or let knees cave; keep feet flatter/lower to avoid pad pressure." },
  'Seated Leg Curl': { muscle:'Hamstrings', look:'seated leg curl',
    set:'Back into the seat, thigh pad snug, ankle pad on the back of the lower shin.',
    mv:'Curl heels down and under, squeeze the hamstrings, return slowly.',
    av:"Don't let the hips lift off the seat or swing the weight." },
  'Leg Extension': { muscle:'Quads', look:'leg extension machine',
    set:'Knee joint lined up with the machine pivot; back against the pad, pad on lower shin.',
    mv:'Extend smoothly to straight, squeeze the quads, lower with control.',
    av:"Don't kick or swing into the top; keep it steady." },
  'Leg Press Calf Raise': { muscle:'Calves', look:'calf raise on leg press',
    set:'On the leg press: legs almost straight (slight bend), balls of feet on the platform edge.',
    mv:'Drop the heels for a big stretch, then press up through the toes; slow tempo.',
    av:"Don't bend the knees to push; the movement is at the ankle only." },
  'Abdominal Crunch': { muscle:'Abs', look:'machine ab crunch',
    set:'Sit tall, grip the handles/pads, ribs stacked over hips.',
    mv:'Curl the ribs toward the pelvis, breathe out, control the return.',
    av:"Don't just hinge at the hips or yank with the arms — round through the middle." },
  'Chest Press': { muscle:'Chest', look:'machine chest press',
    set:'Back flat to the pad, handles level with mid-chest, elbows ~45° from the body.',
    mv:'Press forward to near-extension, control the handles back to a stretch.',
    av:"Don't flare elbows to 90° or slam into lockout." },
  'Lat Pulldown': { muscle:'Lats & upper back', look:'lat pulldown',
    set:'Thighs locked under the pads, slight lean back, grip wider than shoulders.',
    mv:'Pull elbows down toward your ribs, bar to the collarbone, control it back up.',
    av:"Don't heave with the whole body or pull behind the neck." },
  'Shoulder Press': { muscle:'Shoulders', look:'machine shoulder press',
    set:'Back supported, handles starting at about shoulder height.',
    mv:'Press up smoothly, lower under control to shoulder height.',
    av:"Don't shrug the shoulders up or crash into a hard lockout." },
  'Seated Row': { muscle:'Mid-back', look:'seated row machine',
    set:'Chest tall, feet braced, slight forward reach to a stretch — no rounding.',
    mv:'Pull the handles to your torso, drive elbows back, squeeze the shoulder blades.',
    av:"Don't round the back or jerk the torso to start the pull." },
  'Lateral Raise': { muscle:'Side delts', look:'machine lateral raise',
    set:'Sit tall, arms by your sides, a slight bend held in the elbows.',
    mv:'Lead with the elbows and raise to shoulder height, lower slowly.',
    av:"Don't swing or go above shoulder height; keep it strict." },
  'Triceps Pushdown': { muscle:'Triceps', look:'tricep pushdown cable',
    set:'Stand close, elbows pinned to your sides, slight forward lean.',
    mv:'Push down to full extension, control back up to about 90°.',
    av:"Don't let the elbows drift forward or flare out." },
  'Biceps Curl (single-arm)': { muscle:'Biceps', look:'single arm cable bicep curl',
    set:'One arm at a time, upper arm fixed at your side. Lead with the weaker left arm.',
    mv:'Curl up and squeeze, lower slowly to a full stretch. Match reps on the right.',
    av:"Don't swing the elbow forward or use body momentum." },
  'Hip Abductor': { muscle:'Glutes & abductors', look:'hip abduction machine',
    set:'Sit upright, outer pads against the knees/thighs.',
    mv:'Press the knees outward against the pads, return slowly.',
    av:"Don't lean back or bounce out of the bottom." },
  'Hip Adduction': { muscle:'Inner thigh (adductors)', look:'hip adduction machine',
    set:'Sit upright, pads against the inner knees/thighs, legs apart.',
    mv:'Squeeze the knees together against the pads, return slowly.',
    av:"Don't lean or use momentum; controlled squeeze." },
  'Back Extension': { muscle:'Lower back & erectors', look:'seated back extension machine',
    set:'Seated lower-back machine: pad across the upper back, hips at the pivot.',
    mv:'Extend back through the hips against the pad, return forward under control.',
    av:"Don't overextend or fling backward — controlled range only." },
  'Pec Deck / Chest Fly': { muscle:'Chest', look:'pec deck',
    set:'Back flat, slight fixed bend in the elbows, forearms on the pads.',
    mv:'Bring the pads together in front of the chest, squeeze, open slowly.',
    av:"Don't shrug or let the shoulders roll forward." },
  'Rear Delt': { muscle:'Rear delts', look:'reverse pec deck rear delt',
    set:'Chest against the pad, slight fixed elbow bend, arms forward.',
    mv:'Pull the arms back and out, squeezing the shoulder blades; control the return.',
    av:"Don't shrug or jerk; keep the chest pinned to the pad." },
};
```

---

## 7. Features in detail

**Log tab.** Day pills (Lower A / Upper A / Lower B / Upper B) + a date picker (defaults to today). Render each exercise for the day as a card: name, target `sets×reps`, "Last (date): …" line from history, and `sets` input rows of `weight / reps / effort`. Pre-fill weight inputs with last session's weight as a placeholder. If a session already exists for the selected **date + day**, load its values into the inputs, show an "Editing saved session" banner, change the Save button to "Update session", and offer a two-tap **Delete**. Custom exercises render with a "Custom" badge and a Remove control.

**Add exercise.** Modal: name, day, sets (1–6), rep range (free text). Reject duplicate name on the same day. Persists in `custom`.

**Progress tab.** Exercise dropdown (all programme + custom exercises) + range filter pills **1W / 1M / 3M / 6M / 1Y / All** (anchored to today). Line chart of top-set weight per session over the range, with point labels, plus a session-history list below. Empty-state messaging when no data in range.

**Copy for Claude.** Build a plain-text summary of the latest session (and the previous same-day session for context) in the format `Exercise: weight×reps@effort, …`, and copy to clipboard (with a textarea fallback).

**Seed-on-first-run.** On first load with empty storage, optionally seed the programme so the day lists render. (Historical session seeding is optional — I can paste my history later or you can import a JSON file I provide.)

---

## 8. Deployment — AWS Amplify Hosting

Target: SPA on Amplify Hosting, custom domain `workout.raj-ran.dev`, HTTPS.

1. Init a git repo, push to GitHub (`raj-ran/lift-log` or similar).
2. Use **Amplify Hosting** connected to the GitHub repo (CI/CD on push to `main`). Build settings for Vite:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild: { commands: [ "npm ci" ] }
       build:    { commands: [ "npm run build" ] }
     artifacts: { baseDirectory: dist, files: [ "**/*" ] }
     cache:     { paths: [ "node_modules/**/*" ] }
   ```
3. Add an SPA rewrite rule (200 rewrite of `</^[^.]+$|\.(?!(css|js|png|svg|json|ico|webmanifest)$)([^.]+$)/>` → `/index.html`) so client routes work.

---

## 9. Custom domain `workout.raj-ran.dev`

`.dev` is on the HSTS preload list, so it **must** serve HTTPS — Amplify handles this with a managed ACM cert. Steps depend on where `raj-ran.dev` is registered:

- **If the domain's DNS is in Route 53:** in Amplify → Domain management, add `raj-ran.dev` and map the subdomain `workout`. Amplify creates the ACM cert and the records in the hosted zone automatically.
- **If DNS is elsewhere (registrar/Cloudflare):** add the domain in Amplify, then create the **CNAME records** Amplify gives you at your DNS provider — one for the ACM validation and one pointing `workout` to the Amplify CloudFront target. Wait for validation, then it goes live on HTTPS.

Confirm with me which provider holds `raj-ran.dev`'s DNS before doing this step.

---

## 10. Granting you (Claude) the AWS access you need

You'll run AWS CLI / Amplify commands locally. Here's how I'll set up access — propose the exact policy/commands and I'll run the credential-creating parts myself.

**Principles:** least privilege, credentials live in `~/.aws` (never in the repo or in chat), use a named profile. I will create credentials; you will *use* them via the CLI. **Never ask me to paste an access key or secret into the chat — read them from the configured profile/environment instead.**

Recommended setup (suggest commands, I'll execute the sign-in ones):

1. **IAM Identity Center (SSO) profile** (preferred):
   ```bash
   aws configure sso        # I run this; sets up a named profile, e.g. "amplify-liftlog"
   export AWS_PROFILE=amplify-liftlog
   aws sts get-caller-identity   # you can run this to confirm access
   ```
   *Or* an **IAM user** with programmatic keys if I'm not on SSO — I'll create the user + access key in the console and run `aws configure --profile amplify-liftlog` myself.

2. **Permissions to request** (attach to that user/role — start minimal):
   - For hosting + domain: managed policy **`AdministratorAccess-Amplify`** (scopes to Amplify, plus the CloudFront/ACM/Route 53/IAM bits Amplify needs).
   - If we do the **Phase 2 backend** (Amplify Gen 2): also **`AmplifyBackendDeployFullAccess`**.
   - If you need anything beyond these, tell me the specific actions/resources and why, and I'll decide whether to add a scoped inline policy.

3. **What you may do** once the profile is active: run `git`, `npm`, `npx ampx` / Amplify CLI, and read-only `aws` describe/list calls freely. **Pause and get my explicit OK before:** anything that creates/deletes cloud resources, changes DNS, modifies IAM, or incurs cost. Show me the command first.

4. **Guardrails:** don't hardcode credentials, region, or account IDs in committed files; use env vars / the profile. Add `.env*`, `amplify_outputs.json` (if it contains anything sensitive), and `.aws` to `.gitignore`. Don't commit secrets.

---

## 11. Build order (work through, confirming with me at the ⏸ points)

1. Scaffold Vite + React + TS, add fonts, design tokens, routing, PWA plugin.
2. Implement the data model, the `localStorage` storage wrapper, and the `DAYS` + `EXERCISES` seeds.
3. Build the **Log** tab (logging, edit-existing-session, custom exercises).
4. Build the **Progress** tab (chart + range filters).
5. Build the **Form** tab (cue cards + demo links).
6. Implement **Copy for Claude** export.
7. Run locally, I test it. ⏸
8. Push to GitHub. ⏸ (confirm repo)
9. Set up Amplify Hosting + build settings + SPA rewrite; first deploy. ⏸ (AWS — show commands)
10. Add the `workout.raj-ran.dev` domain + HTTPS. ⏸ (confirm DNS provider)
11. (Optional) Phase 2: Amplify Gen 2 Auth + Data for cross-device sync. ⏸ (only if I ask)

Start with step 1 and check in after step 2 with a quick summary of the structure before going further.