# Repository Guidelines

## Project Structure & Modules
- Backend (FastAPI): `FastApi_AI/` — app entry `main.py`, routers in `routers/`, models in `models.py`, config in `config.py`, data in `data/`, cached models in `models_cache/`.
- Admin Web (Vite + React): `AdminDashboard/` — app entry `src/main.jsx`, pages in `src/pages/`, components in `src/components/`.
- Mobile Client (Expo + React Native): `Client/` — routes in `app/`, UI in `components/`, hooks in `hooks/`, config in `constants/`.
- Docs/Config: root `README.md`, `ecosystem.config.js` (optional PM2), env samples in `FastApi_AI/.env.sample`, `AdminDashboard/.env.example`, `Client/.env.sample`.

## Build, Test, and Development
- Backend
  - Setup: `cd FastApi_AI && python -m venv .venv && . .venv/Scripts/Activate` (Windows) then `pip install -r requirements.txt` and `copy .env.sample .env`.
  - Run: `uvicorn main:app --reload --port 5001`.
- Admin Web
  - Setup: `cd AdminDashboard && npm ci`.
  - Dev: `npm run dev` (Vite), Build: `npm run build`, Lint: `npm run lint`, Preview: `npm run preview`.
- Mobile Client
  - Setup: `cd Client && npm ci`.
  - Dev: `npm run start` (Expo), Platforms: `npm run android` | `npm run ios` | `npm run web`, Lint: `npm run lint`.

## Coding Style & Naming
- Python (backend): 4‑space indent, snake_case for functions/vars, PascalCase for classes, prefer type hints. Keep routers under `FastApi_AI/routers/`.
- JS/TS (web/mobile): ESLint enforced (`eslint.config.js`). Use camelCase for vars, PascalCase for React components, hooks named `useX`. Co-locate component styles next to components.

## Testing Guidelines
- Current repo has no formal tests. For JS/TS, add `*.test.tsx?/js` near code or under `__tests__/` and run via project script when added. For Python, prefer `pytest` with files named `test_*.py`.
- Aim for coverage on routers, key hooks, and data parsing.

## Commit & PR Guidelines
- Recent commits are short (e.g., “updated”). Prefer Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`.
- PRs: include purpose, linked issues, setup/run notes, and screenshots for UI. Ensure lint passes and dev servers start.

## Security & Config
- Copy env samples and set `OPENAI_API_KEY`, and `CORS_ORIGINS` in backend `.env`. Frontends: set API base URLs in `AdminDashboard/src/config.js` and `Client/constants/api.ts`.

## Current AR Tab Status
- Client `app/(tabs)/ar.tsx` now computes every route waypoint’s world coordinates via `mapPointToWorld` and passes them to `ARTestScreen` as `routePointsWorld`.
- `ARTestScreen` (Viro scene) no longer remounts per update; it keeps a single `Viro3DObject` and updates its position/rotation through `setNativeProps`, while markers are drawn for all waypoints.
- SLAM initialization is guarded so tab switches do not reset the pose; focus effect only reloads lists instead of clearing route state.
- Remaining issue: AR model still lags behind 2D route because Viro scene ignores prop updates in some cases; we are exploring navigator-driven refreshes or alternative cues (2D guidance) as next steps.
