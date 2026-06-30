# Lift Log PRD

This PRD maps the requirements in `task/criteria.md` into product goals, features, data model, UX, and deployment steps.

## 1. Product overview

Build a mobile-first strength-training web app for a 4-day upper/lower machine programme. It must log workouts, persist data reliably, show progress, include form-cue cards, and deploy to AWS Amplify on `workout.raj-ran.dev`.

## 2. Objectives

- Record session details for each exercise: weight, reps, effort.
- Group sessions by training day and date.
- Persist data reliably in Phase 1 with localStorage, with a storage abstraction for future backend swap.
- Visualize lift progress with selectable time ranges.
- Support add/edit/delete of sessions and custom exercises.
- Provide a Form Reference section with cues and demo links.
- Allow session export as text for Claude coaching.
- Deploy the production SPA to AWS Amplify on the custom domain.

## 3. Success criteria

- Users can save and update sessions for any date + day.
- Saved sessions survive browser reloads and mobile usage.
- Progress charts display top-set weight histories for selected exercises.
- Form Reference shows clearly structured cue cards and external demo links.
- Copy-for-Claude export generates correctly formatted text from the latest session.
- App builds and deploys successfully on Amplify Hosting with the specified domain.

## 4. Tech stack

- React 18 + Vite + TypeScript
- `react-router-dom` for navigation: tabs `Log`, `Progress`, `Form`
- Charts with hand-rolled SVG (or `recharts` if needed)
- React hooks + a small store module for state
- Local persistence via typed localStorage wrapper
- Optional future backend with AWS Amplify Gen 2 + Cognito + DynamoDB
- Plain CSS or CSS modules for styling
- PWA support with `vite-plugin-pwa`

## 5. Design system

- Theme: dark, high-contrast, athletic
- Fonts: Oswald for headings, Inter for body
- Color tokens:
  - `--bg:#15171C`
  - `--card:#F7F6F2`
  - `--ink:#1F2530`
  - `--muted:#6A7180`
  - `--accent:#F2683C`
  - `--lower:#1E8F84`
  - `--upper:#4C63B6`
  - `--ok:#2E9E5B`
  - `--avoid:#C0392B`
- Cards: off-white on dark background, 3px accent top border, rounded 14px
- Mobile-first layout, with two-column grid above 640px

## 6. Data model

- `DayName = 'Lower A' | 'Upper A' | 'Lower B' | 'Upper B'`
- `SetEntry = { w: number; r: number; e: number | null }`
- `ExerciseEntry = { exercise: string; sets: SetEntry[] }`
- `Session = { date: string; day: DayName; entries: ExerciseEntry[] }`
- `CustomExercise = { name: string; day: DayName; sets: number; reps: string }`
- `AppData = { sessions: Session[]; custom: CustomExercise[] }`
- Session identity: `date + day`
- Sort sessions ascending by date

## 7. Seed programme data

Initial `DAYS` seed data for each training day:

- Lower A
- Upper A
- Lower B
- Upper B

Each entry includes exercise name, sets count, and rep range.

## 8. Form Reference data

Create `EXERCISES` cue cards with:
- `muscle`
- `look` search term
- `vid` link (Leg Press pinned video)
- `set`, `mv`, `av`

Use Google search URLs for demo links, except Leg Press with its pinned video.

## 9. Core features

### Log tab
- Day pills + date picker (default today)
- Show programme exercises for selected day
- Render cards with exercise name, target sets×reps, last session summary, and input rows
- Placeholder weights drawn from last session
- Load saved session when `date + day` exists
- Show editing banner, update/save button label, and delete option
- Custom exercises show `Custom` badge and remove control

### Add exercise
- Modal to add a custom exercise
- Fields: name, day, sets, rep range
- Reject duplicates for the same day
- Persist to `custom`

### Progress tab
- Exercise selector including programme and custom exercises
- Range filter pills: `1W`, `1M`, `3M`, `6M`, `1Y`, `All`
- Line chart of top-set weight over the selected range
- Point labels and session history list
- Empty-state messaging if no data exists for the range

### Copy for Claude
- Generate a plain-text summary of the latest session
- Include previous same-day session for context
- Format: `Exercise: weight×reps@effort, …`
- Provide clipboard copy + textarea fallback

### Seed on first run
- If storage is empty, seed the programme so day lists render
- Historical session data is optional and can be imported later

## 10. Deployment plan

### GitHub + Amplify
- Initialize git repo and push to GitHub
- Connect Amplify Hosting to the repo on `main`
- Use Vite build settings for Amplify

### Amplify build settings
```yaml
version: 1
frontend:
  phases:
    preBuild: { commands: [ "npm ci" ] }
    build:    { commands: [ "npm run build" ] }
  artifacts: { baseDirectory: dist, files: [ "**/*" ] }
  cache:     { paths: [ "node_modules/**/*" ] }
```

### Routing
- Add SPA rewrite rule for client-side navigation

## 11. Notes

- Show AWS commands before running them
- Do not include secrets in code
- Deploy Phase 1 first; Phase 2 backend sync only if requested
