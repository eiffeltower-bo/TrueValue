# **Implementation Report: TrueValue Backend v1 (Milestone 1)**

This document describes what was actually built in the initial backend bootstrap of TrueValue. It covers the key architectural decision to adopt Piccolo's native authentication system, the final monorepo structure, the dependencies and exposed routes, and an end-to-end verification checklist. It serves as a handoff for the Frontend and Edge teams.

Status: **Milestone 1 complete** ([Plan_Arquitectura_TrueValue_CRM_Edge.md](Plan_Arquitectura_TrueValue_CRM_Edge.md) — "Esqueleto del CRM").

## **1\. Executive Summary**

- Monorepo with `backend/`, `frontend/` (placeholder), `edge/` (placeholder), `infra/`, and `plans/`.
- Python 3.12 backend managed with **UV**, running **FastAPI** + **Piccolo ORM** on **PostgreSQL 16** via Docker Compose.
- Three MVP entities persisted: `users`, `properties`, `sales`, with the initial migration generated and applied.
- REST API at `/api/v1/*` with full CRUD (CREATE, READ list+by id, PATCH, DELETE) for the three entities.
- **`piccolo_admin`** mounted at `/admin/` provides CRUD via a Vue.js UI for the same tables, authenticated against `users`.
- Authentication based on Piccolo's `BaseUser`: passwords hashed with `pbkdf2_sha256` (600k iterations), session cookies.
- REST CRUD routes are **un-gated** (no JWT gate); the `/admin/` UI does require login with `admin=true`.
- Bootstrap commands consolidated in a **`justfile`** at the repo root.

## **2\. Final Monorepo Structure**

```
TrueValue/
├── backend/                # Python: FastAPI + Piccolo + UV
│   ├── app/
│   │   ├── main.py             # FastAPI app factory + mounts /admin/
│   │   ├── settings.py         # pydantic-settings (reads .env)
│   │   ├── piccolo_app.py      # AppConfig: registers tables and migrations
│   │   ├── tables/             # Piccolo ORM tables
│   │   │   ├── users.py        # User(BaseUser, tablename="users")
│   │   │   ├── properties.py
│   │   │   └── sales.py
│   │   ├── schemas/            # Pydantic request/response models
│   │   │   ├── users.py
│   │   │   ├── properties.py
│   │   │   └── sales.py
│   │   └── api/
│   │       ├── crm/            # CRUD: users, properties, sales
│   │       ├── edge/           # Empty router (Milestone 2)
│   │       └── ai/             # Empty router (Milestone 3)
│   ├── scripts/
│   │   └── create_superuser.py # Backs `just superuser`
│   ├── tests/
│   │   └── test_health.py      # Smoke test on /health and /
│   ├── piccolo_migrations/
│   │   └── truevalue_2026_05_16t17_01_48_363706.py   # Initial CREATE TABLE migration
│   ├── piccolo_conf.py         # Postgres engine + AppRegistry
│   ├── pyproject.toml          # Deps managed by UV
│   ├── .python-version         # 3.12
│   ├── .env.example
│   └── README.md
├── frontend/.gitkeep           # Reserved: Vite + React + TS
├── edge/.gitkeep               # Reserved: ESP32 + Jetson clients
├── infra/
│   └── docker-compose.yml      # Postgres 16-alpine
├── plans/                      # This folder
├── justfile                    # Recipes for all common tasks
├── .gitignore
└── README.md
```

**Why this shape:** it matches the architecture doc literally (humans vs. machines separation), keeps each app independent (its own deps and runtime), and reserves explicit space for the edge clients in Milestone 2 without polluting the backend.

## **3\. Stack and Dependencies**

| Layer | Technology | Version |
| :---- | :---- | :---- |
| Runtime | Python | 3.12.11 (via UV) |
| Web framework | FastAPI | 0.136 |
| ORM | Piccolo | 1.34 |
| Piccolo extras | piccolo-api, piccolo-admin | 1.9, 1.13 |
| DB driver | asyncpg | 0.31 |
| Validation | Pydantic / pydantic-settings | 2.13 / 2.14 |
| DB | PostgreSQL | 16-alpine (Docker) |
| Test | pytest, pytest-asyncio, httpx | 9.0 / 1.3 / 0.28 |
| Lint+format | ruff | 0.15 |
| Task runner | just | 1.50 |

Note that we **do not use `bcrypt`** or `passlib`: BaseUser already hashes with `pbkdf2_sha256`. We also do not use Pydantic's `EmailStr`; the `email-validator` package rejects reserved TLDs like `.local`, and that blocks useful addresses in development. We validate email with a lightweight regex in the schemas.

## **4\. Data Model**

A single Piccolo "app" (`truevalue`) registers the three tables. Plus a second app registered indirectly (`piccolo_api.session_auth.piccolo_app`) which provides the `sessions` table required by `piccolo_admin` to maintain login state. Total tables in the `public` schema:

| Table | Purpose | Origin |
| :---- | :---- | :---- |
| `users` | CRM agents and admins | `BaseUser` subclass (defined in `app/tables/users.py`) |
| `properties` | Real-estate inventory | `truevalue` app |
| `sales` | Sales records | `truevalue` app |
| `sessions` | Session cookies for admin login | `session_auth` app (bundled) |
| `migration` | Piccolo's internal tracking | Piccolo CLI |

### **4.1 `users` table (BaseUser subclass)**

Columns inherited from `BaseUser`:

- `id` (serial, PK), `username` (varchar 100, unique, **case-sensitive**), `password` (varchar 255, auto-hashed pbkdf2_sha256), `email` (varchar 255, unique, **required**), `first_name` and `last_name` (varchar 255, nullable), `active` (bool, default false → set to true by our endpoints), `admin` (bool, default false → gates the admin UI), `superuser` (bool, default false → can manage other users in the admin UI), `last_login` (timestamp).

Column added by the subclass:

- `created_at` (timestamptz, default now()).

**Important:** there is no `role` column in the DB. The CRM "role" (`agent` vs `admin`) is **derived** at the API layer from the `admin` and `superuser` flags. To create an admin via the REST endpoint, sending `{"role": "admin"}` sets `admin=true` and `superuser=true`.

### **4.2 `properties` table**

- `id`, `title` (varchar 255), `price` (numeric(12,2)), `property_type` (varchar 64), `location` (varchar 255), `agent` (FK → users.id, `ON DELETE RESTRICT`), `created_at`.

### **4.3 `sales` table**

- `id`, `product_or_service` (varchar 255), `amount` (numeric(12,2)), `payment_method` (varchar 32), `location` (varchar 255), `sold_at` (timestamptz, default now()), `agent` (FK → users.id, `ON DELETE RESTRICT`).

## **5\. REST API**

The full API lives under `/api/v1`. CRUD routes are **un-gated** in this pass (explicit decision — see §10).

| Resource | Methods | Notes |
| :---- | :---- | :---- |
| `/api/v1/users` | POST, GET (list), GET `/{id}`, PATCH, DELETE | Plain `password` accepted on request, never returned in response. `email` field required and unique. `role` (agent\|admin) maps to the `admin`/`superuser` flags. 409 on username or email collision. |
| `/api/v1/properties` | POST, GET (list), GET `/{id}`, PATCH, DELETE | `agent_id` required on create; 400 if the agent does not exist. |
| `/api/v1/sales` | POST, GET (list), GET `/{id}`, PATCH, DELETE | Same pattern as properties; `sold_at` optional (defaults to now). |
| `/api/v1/edge/*` | empty router | Ready for Milestone 2 |
| `/api/v1/ai/*` | empty router | Ready for Milestone 3 |
| `/health` | GET | `{"status":"ok"}` — does not touch the DB. |
| `/` | GET | Service metadata. |
| `/docs`, `/redoc` | GET | Swagger / ReDoc auto-generated by FastAPI. |

Pydantic schemas (`*Create`, `*Update`, `*Read`) live in [backend/app/schemas/](../backend/app/schemas/). Each one explicitly declares which fields it accepts and which it exposes — `UserRead` never includes `password`.

## **6\. Admin UI: `/admin/`**

[`piccolo_admin`](https://piccolo-admin.readthedocs.io/) is mounted at `/admin/` with this configuration:

```python
admin = create_admin(
    tables=[User, Property, Sale],
    auth_table=User,                  # authenticates against our users table
    site_name="TrueValue Admin",
    production=False,
)
app.mount("/admin/", admin)
```

Only users with `admin=true` (or `superuser=true`) and `active=true` can log in.

### **Login flow (programmatic)**

1. `GET /admin/` → receives a `csrftoken` cookie.
2. `POST /admin/public/login/` with JSON body `{"username","password"}` and header `X-CSRFToken: <token>`.
3. Response `200 {"message":"logged in"}` plus a session cookie `id=...` (HttpOnly, SameSite=lax).
4. Subsequent calls to `/admin/api/*` send the session cookie.

The browser handles this transparently through the admin's login form.

### **Useful admin endpoints (all require login)**

- `GET /admin/api/user/` — info about the logged-in user.
- `GET /admin/api/tables/` — list of manageable tables (`["properties","sales","users"]`).
- Generic CRUD per table at `/admin/api/tables/{table_name}/`.

## **7\. Authentication and Hashing**

Decision: we use Piccolo's system **end-to-end**, instead of maintaining our own stack with `bcrypt`/`passlib`.

### **How hashing works**

`BaseUser` overrides `__init__` and `__setattr__` so that any assignment like `user.password = "plaintext"` or construction like `User(password="plaintext")` is automatically hashed to `pbkdf2_sha256$600000$<salt>$<hash>`. There is no in-house `core/security.py` module (it was deleted).

### **How to create users**

Three paths, all of which end up hashing:

1. CLI/script: `just superuser <user> <password> [email]` invokes [backend/scripts/create_superuser.py](../backend/scripts/create_superuser.py), which upserts (if the user exists → reset password and force `admin=superuser=active=true`).
2. REST: `POST /api/v1/users {"username","password","email","role":"admin"}` → sets `admin=superuser=true` when `role=="admin"`.
3. Admin UI: create from the Vue UI with admin/superuser flags configurable manually.

### **What is NOT implemented yet**

- REST `/api/v1/auth/login` issuing a JWT for the SPA frontend.
- Auth gate over `/api/v1/properties` and `/api/v1/sales`.
- Per-agent data isolation (Property/Sale filtered by the logged-in user).

Explicit decision: the frontend can mock auth during this sprint; the real login flow is implemented in the next pass.

## **8\. Local Infrastructure**

[infra/docker-compose.yml](../infra/docker-compose.yml) exposes a single `postgres` service:

- Image: `postgres:16-alpine`.
- Named volume: `truevalue_pg_data` (persists data).
- Healthcheck with `pg_isready`.
- Host port 5432.
- Credentials: `truevalue` / `truevalue` / DB `truevalue`.

The `DATABASE_URL` consumed by the backend lives in `backend/.env` (copied from `.env.example`).

## **9\. Tooling: justfile and scripts**

[justfile](../justfile) consolidates every command. `just` (no args) lists the recipes. Summary:

| Recipe | Action |
| :---- | :---- |
| `bootstrap` | One-shot: `install` + `db` + `migrate`. For fresh clones. |
| `install` | `uv sync` (deps + venv). |
| `db` / `db-down` / `db-logs` | Bring up / tear down / tail Postgres. |
| `db-shell` | `psql` inside the container. |
| `db-reset` | **Destructive:** `down -v` + `db` + `migrate`. |
| `migrate` | `piccolo migrations forwards all` (truevalue + session_auth). |
| `migration-new` | Auto-generate a migration for the `truevalue` app. |
| `migration-status` | Status across all registered apps. |
| `backend` | `uvicorn --reload` (API on :8000, admin at /admin/). |
| `superuser [user] [pw] [email]` | Create/update admin. No args → interactive prompts. |
| `test` / `lint` / `format` | pytest / ruff check / ruff format. |

The `create_superuser.py` script accepts positional arguments, env vars (`SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` / `SUPERUSER_EMAIL`), or interactive prompts. It is idempotent (upsert).

## **10\. Design Decisions and Trade-offs**

### **10.1 BaseUser subclass vs. custom User table**

Two paths were evaluated:
- **A**: add `piccolo_admin` without changing the existing custom User (fast, but implied maintaining two user tables — ours and a standalone `piccolo_user` for the admin's own login).
- **B**: subclass `BaseUser` (more work, ~45 min of migration, but unifies auth and eliminates our custom hashing layer).

**B** was chosen. Rationale: in a hackathon, removing 150+ lines of our own code (model, hashing, validation) and replacing them with a battle-tested library is a big win. Plus, getting a free admin UI for back-office management has real value.

### **10.2 Not registering `piccolo_admin.piccolo_app` in APP_REGISTRY**

`piccolo_admin.piccolo_app` declares `migration_dependencies=["piccolo.apps.user.piccolo_app", ...]`, which would force us to also register `piccolo.apps.user.piccolo_app` — which creates a `piccolo_user` table we would NOT use (we already have `users` via the subclass). To avoid that orphan table, we register only `app.piccolo_app` and `piccolo_api.session_auth.piccolo_app`, and we consume `piccolo_admin` at runtime via `create_admin(auth_table=User, ...)`.

### **10.3 Derived `role` instead of a column**

`BaseUser` already provides `admin` and `superuser` flags. Keeping an additional `role` column (Varchar "agent"|"admin") would be redundant and would create room for inconsistencies (what happens when `role="agent"` but `admin=true`?). We removed the column; the `role` is computed in the response model as `"admin" if (user.admin or user.superuser) else "agent"`.

### **10.4 `email` required and unique**

`BaseUser.email` comes with `unique=True`. If we did not require email in `UserCreate`, two users without email would break the unique constraint. We made it mandatory in the API — which also matches realistic CRM expectations.

### **10.5 No Pydantic `EmailStr`**

`email-validator` (the package behind `EmailStr`) rejects reserved TLDs like `.local`, `.test`, `.example`. That blocks useful addresses in dev (`admin@truevalue.local`). We replaced it with a lightweight regex `^[^@\s]+@[^@\s]+\.[^@\s]+$` in the schemas. The frontend can apply stricter validation if needed.

### **10.6 Un-gated CRUD REST**

Explicit decision made in planning: in this pass we only hash passwords; there is no JWT or gate on `/api/v1/*`. The frontend can mock auth and get immediate CRUD. JWT/login is work for Milestone 1.5.

## **11\. End-to-End Verification (what was run live)**

| Check | Result |
| :---- | :---- |
| `just install` (uv sync) | OK — Python 3.12.11, 57 packages |
| `just db` | OK — Postgres healthy in <5s |
| `just migrate` | OK — runs `truevalue` (3 tables, 23 columns) + `session_auth` (1 table) |
| `just superuser admin s3cr3tpass admin@truevalue.local` | OK — admin id=1 created with `pbkdf2_sha256$...` hash |
| `POST /api/v1/users` (agent) | 201 — alice id=2, role="agent" correctly derived |
| `GET /api/v1/users` | 200 — lists both, password never exposed |
| `POST /api/v1/properties {agent_id:2}` | 201 |
| `POST /api/v1/sales {agent_id:2}` | 201 |
| Error: duplicate username | 409 |
| Error: nonexistent agent_id | 400 |
| Error: user not found | 404 |
| `GET /admin/` | 200 — login page, sets `csrftoken` cookie |
| `POST /admin/public/login/` with CSRF header | 200 — `{"message":"logged in"}` + session cookie |
| `GET /admin/api/user/` authenticated | 200 — `{"username":"admin","user_id":"1"}` |
| `GET /admin/api/tables/` | 200 — `["properties","sales","users"]` |
| `just test` | 2/2 passing |
| `just lint` | clean (26 files formatted) |

## **12\. Out of Scope (next milestones)**

### **Milestone 1.5 (auth)**
- `/api/v1/auth/login` issuing JWT.
- `get_current_user` dependency in `app/api/deps.py` (placeholder already created).
- Auth gate over properties + sales.
- Per-agent data isolation (`WHERE agent_id = current_user.id` except for admins).

### **Milestone 2 (Edge Clients)**
- Implement [backend/app/api/edge/__init__.py](../backend/app/api/edge/__init__.py): routes for ESP32 (telemetry / presence counting) and Jetson Orin Nano (computer vision).
- Pydantic schemas for the JSON payloads from each device.

### **Milestone 3 (Analytics + AI)**
- Endpoints in [backend/app/api/ai/__init__.py](../backend/app/api/ai/__init__.py): NLP for contract analysis, property-client matchmaking engine.
- Financial reports: `GET /reports/sales/total?from=&to=&payment_method=` (explicit filters required by the challenge brief).

### **Frontend**
- Scaffold `frontend/` with Vite + React + TS (see [Plan_Frontend_TrueValue_Basico.md](Plan_Frontend_TrueValue_Basico.md)).
- Integrate with `/api/v1/*` and/or consume the admin UI for back-office tasks.

## **13\. Quick References**

- **Original architecture doc:** [Plan_Arquitectura_TrueValue_CRM_Edge.md](Plan_Arquitectura_TrueValue_CRM_Edge.md)
- **Frontend plan:** [Plan_Frontend_TrueValue_Basico.md](Plan_Frontend_TrueValue_Basico.md)
- **Detailed backend setup:** [backend/README.md](../backend/README.md)
- **List of `just` recipes:** run `just` with no args from the repo root
- **Swagger:** http://localhost:8000/docs (when the server is running)
- **Admin UI:** http://localhost:8000/admin/ (log in with a user that has `admin=true`)
