# AGENTS.md

This file provides guidance to Agents when working with code in this repository.

## Repository shape

Monorepo for a Proptech CRM (INTERSIM TECH hackathon). Three runtime targets share one Postgres:

- `backend/` — FastAPI + Piccolo ORM, managed by `uv` (Python 3.12).
- `frontend/` — Vite + React 19 + TS SPA (Tailwind v4). Uses Piccolo session cookies for auth, not JWT.
- `edge/` — placeholder for ESP32 / Jetson Orin Nano clients (Hito 2).
- `infra/docker-compose.yml` — local Postgres 16.
- `plans/` — architecture & implementation docs. **English by default** for working docs; Spanish only for final audience-facing deliverables.

Top-level `justfile` is the canonical entry point — prefer it over raw `uv`/`npm`/`docker compose` commands when both exist.

## Common commands

```bash
just bootstrap         # uv sync + npm install + start Postgres + apply migrations
just superuser admin pw admin@truevalue.local   # required once; the SPA login needs an admin=True user
just backend           # FastAPI on http://localhost:8000 (Swagger at /docs, Piccolo admin at /admin/)
just fe                # Vite SPA on http://localhost:5173
just fe-lan            # same as `fe` but bound to 0.0.0.0 — Vite still proxies /api + /admin to localhost:8000
just db-reset          # destructive: drops the volume, restarts, re-migrates
just migration-new     # autogen migration for the `truevalue` app from current table state
just migrate           # apply all pending migrations (truevalue + session_auth)
just test              # backend pytest
just lint              # ruff check + ruff format --check
just format            # ruff format (writes)
```

Run a single backend test: `cd backend && uv run pytest tests/test_health.py::test_health -q`.
Frontend has no test runner yet; `cd frontend && npm run build` runs `tsc -b && vite build` and is the type-check gate. `npm run lint` runs ESLint.

## Architecture notes that aren't obvious from the file tree

### Two Piccolo apps are registered, not one

`backend/piccolo_conf.py` registers both `app.piccolo_app` (our tables) **and** `piccolo_api.session_auth.piccolo_app`. The second one owns the `sessions` table that `piccolo_admin` uses for login. `just migrate` and `piccolo migrations forwards all` apply both — never migrate just `truevalue`, or admin login will break.

### Auth is session-cookie via Piccolo Admin, not JWT — and this is final

There is **no `/api/v1/login`**, and there won't be. The auth model is frozen: the SPA logs in by talking to `piccolo_admin`'s public endpoints (see `frontend/src/api/auth.ts`):

1. `GET /admin/` to obtain a `csrftoken` cookie.
2. `POST /admin/public/login/` with `{username, password}` + `X-CSRFToken` header.
3. `GET /admin/api/user/` to read the current user.

`fetch` calls go through `frontend/src/api/client.ts` which sets `credentials: "include"` on every request. The backend `CORSMiddleware` (`app/main.py`) uses `allow_credentials=True` and `cors_origins` from settings — keep both in sync if you change ports or hosts.

The CRUD routes under `/api/v1/*` are **un-gated by design** and stay that way. Do not add JWT, OAuth, or per-route session checks. If the M2M edge endpoints eventually need device authentication, that's a separate concern handled at the `/api/v1/edge` layer — it does not touch the human CRM auth.

### Frontend UX conventions (hard rules)

Agents use the CRM on-site, on phones, on flaky networks. Apply these to any new SPA code — they're hard requirements for the demo, not polish:

- **Mobile-first, one-handed.** Design and verify layouts at ~375px width first. Tap targets ≥44px. The Sales registration flow especially must be operable with one thumb.
- **Optimistic UI for mutations.** When the user creates/updates a property or sale, update local state immediately and fire the request in the background. On failure, roll back and surface the error inline — never block the UI on the round-trip.
- **Skeletons, not spinners, for long calls.** Anything that can take more than ~300ms (list fetches, anything that will hit the NLP module) renders skeleton placeholders matching the eventual layout. Reserve spinners for sub-second button-press feedback only.
- **Translate telemetry into insight.** Raw numbers from edge devices (people counted, presence events) should be rendered as actionable copy for the agent ("High demand — consider raising reserve price"), not bare metrics. The threshold logic lives in the frontend until/unless the backend exposes it.

### Vite dev proxy

`frontend/vite.config.ts` proxies `/api` and `/admin` to `BACKEND_URL` (default `http://127.0.0.1:8000`). The SPA therefore uses **relative** base URLs (`/api/v1`, `/admin`) by default — only set `VITE_API_BASE_URL`/`VITE_ADMIN_BASE_URL` for prod builds served without the proxy. For LAN sharing use `just fe-lan` (Vite still proxies to localhost) rather than `just backend-lan`.

### User model: role is derived, not stored

`app.tables.users.User` subclasses Piccolo's `BaseUser` (auto-hashes passwords via pbkdf2_sha256 on assignment). The CRM `role` field exposed by `UserRead` is **derived** in `app/api/crm/users.py::_derive_role` from the `admin`/`superuser` boolean flags — there is no `role` column. When creating/updating users via the API, `role="admin"` sets both `admin=True` and `superuser=True`; `role="agent"` clears both.

### API router layout maps to milestones

`app/main.py` mounts three routers:

- `/api/v1` ← `app.api.crm` (users / properties / sales — Hito 1, implemented).
- `/api/v1/edge` ← `app.api.edge` (ESP32 / Jetson ingestion — Hito 2, empty router).
- `/api/v1/ai` ← `app.api.ai` (NLP / matchmaking — Hito 3, empty router).

The edge/ai routers exist as empty `APIRouter()` stubs in their `__init__.py` so the include doesn't fail — add endpoints inside those packages, then re-export from `__init__.py`.

### Schemas vs. tables

Pydantic schemas live in `app/schemas/*` and are independent from Piccolo tables — handlers manually shape responses (see the `_to_read` helpers). `UserRead` uses `model_config = ConfigDict(from_attributes=True)` but `_to_read` still constructs explicitly so it can compute `role`. Email validation uses a permissive regex (not `EmailStr`) to allow `.local` / `.test` TLDs in dev.

### Quick env reference

Backend reads `.env` via `pydantic-settings` (`app/settings.py`): `APP_ENV`, `DATABASE_URL`, `CORS_ORIGINS` (comma-separated string accepted). Piccolo CLI reads `DATABASE_URL` directly in `piccolo_conf.py`, defaulting to the docker-compose creds (`truevalue:truevalue@localhost:5432/truevalue`).
