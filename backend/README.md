# TrueValue Backend

FastAPI + Piccolo ORM, managed by [UV](https://docs.astral.sh/uv/).

## Prerequisites

- Python 3.12 (UV will install it via `.python-version`)
- Docker / Docker Compose (for Postgres)
- UV (`brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)

## Setup

From the repo root:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Then from `backend/`:

```bash
uv sync                                  # install deps
cp .env.example .env                     # local env vars
uv run piccolo migrations forwards truevalue   # apply schema
uv run uvicorn app.main:app --reload     # http://localhost:8000
```

Open <http://localhost:8000/docs> for Swagger.

## Common commands

```bash
uv run uvicorn app.main:app --reload                  # dev server (API + /admin/)
uv run piccolo migrations new truevalue --auto        # autogen migration
uv run piccolo migrations forwards all                # apply all (truevalue + session_auth)
uv run piccolo migrations backwards truevalue         # revert
uv run pytest                                          # tests
uv run ruff check . && uv run ruff format .           # lint + format
```

Prefer the [`just`](../justfile) recipes from the repo root (`just db`, `just migrate`, `just superuser`, `just backend`, `just seed`).

## Demo data

Populate the database with credible Bolivia-context fake data (eje troncal cities, real zonas, USD pricing, mixed real-estate services):

```bash
just seed                                              # defaults: 25 agents, 200 properties, 500 sales
just seed --agents 50 --properties 1000 --sales 3000   # scale up
just seed --rng-seed 42                                # reproducible
```

The seeder is idempotent: rows tagged with the `@seed.truevalue.local` email domain (plus their properties / sales) are wiped before re-inserting. Real users are untouched. It also (re)creates a demo admin: `seed_admin` / `seed-demo-1234`.

## Layout

```
backend/
├── pyproject.toml
├── piccolo_conf.py             # Piccolo engine config
├── app/
│   ├── main.py                 # FastAPI app factory + /admin/ mount
│   ├── settings.py             # pydantic-settings
│   ├── piccolo_app.py          # registers tables + migrations
│   ├── tables/                 # Piccolo ORM tables (User subclasses BaseUser)
│   ├── schemas/                # Pydantic request/response models
│   └── api/
│       ├── crm/                # CRUD: users, properties, sales
│       ├── edge/               # ESP32 / Jetson endpoints (Hito 2)
│       └── ai/                 # NLP / matchmaking endpoints (Hito 3)
├── scripts/
│   ├── create_superuser.py     # backs `just superuser`
│   └── seed_demo.py            # backs `just seed` — Bolivia-context demo data
├── tests/
└── piccolo_migrations/
```

## API surface (Hito 1)

REST API under `/api/v1`:

- `users`   — POST, GET (list/by id), PATCH, DELETE
- `properties` — POST, GET (list/by id), PATCH, DELETE
- `sales`   — POST, GET (list/by id), PATCH, DELETE

CRUD routes are **un-gated** (no auth) — JWT/login is a planned follow-up.

## Admin UI: `/admin/`

[`piccolo_admin`](https://piccolo-admin.readthedocs.io/) is mounted at `/admin/`,
authenticating against the `users` table. Log in with an account that has
`admin=true` (use `just superuser <name> <pw>`). Provides CRUD over Users,
Properties, and Sales out of the box — no extra UI code.

The login endpoint is `POST /admin/public/login/` (JSON body
`{"username","password"}` + `X-CSRFToken` header populated from the `csrftoken`
cookie). The browser flow handles this automatically.

## Authentication model

We use Piccolo's `BaseUser` (subclassed as `app.tables.users.User`):

- Passwords are auto-hashed (pbkdf2_sha256, 600k iterations) by `BaseUser` when
  you set `user.password = "..."` or call `User.create_user(...)`.
- Fields: `username` (unique), `password`, `email` (unique), `first_name`,
  `last_name`, `active`, `admin`, `superuser`, `last_login` + our `created_at`.
- The CRM `role` ("agent" / "admin") is **derived** from the `admin` /
  `superuser` flags in the API response — there is no `role` column in the DB.
