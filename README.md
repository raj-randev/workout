# Lift Log

A React + Vite + TypeScript workout log app for a 4-day upper/lower strength programme.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open the local URL displayed by Vite.

## Available scripts

- `npm run dev` — start the development server
- `npm run build` — build the production site
- `npm run preview` — preview the production build locally

## PWA support

The app is configured as a PWA with `vite-plugin-pwa`. It includes:

- service worker registration
- installable manifest
- offline-ready caching for assets

## AWS Amplify

A ready-to-use `amplify.yml` is included for Amplify Hosting.

## Project structure

- `src/` — React app source files
- `src/pages/` — route pages for Log, Progress, and Form
- `src/data/` — seed programme and exercise cue data
- `src/storage.ts` — localStorage wrapper and app persistence
- `task/` — PRD and criteria notes
