# TrueValue

Proptech CRM for the INTERSIM TECH hackathon. Monolithic FastAPI backend + Vite/React frontend + edge clients (ESP32, Jetson Orin Nano).

See [plans/Plan_Arquitectura_TrueValue_CRM_Edge.md](plans/Plan_Arquitectura_TrueValue_CRM_Edge.md) for the architecture.

## Repository layout

```
TrueValue/
├── backend/    # FastAPI + Piccolo ORM, managed by UV
├── frontend/   # Vite + React + TS (placeholder)
├── edge/       # ESP32 / Jetson clients (placeholder)
├── infra/      # docker-compose.yml (Postgres)
└── plans/      # architecture & planning docs
```

## Quickstart

The fastest path uses [`just`](https://github.com/casey/just) from the repo root:

```bash
just bootstrap                                  # uv sync + start Postgres + apply migrations
just superuser admin pw admin@truevalue.local   # create the first admin (or `just superuser` to be prompted)
just backend                                    # run FastAPI on http://localhost:8000
```

Once running: REST API at `/api/v1/*` (Swagger at `/docs`), Piccolo admin UI at `/admin/`.

Run `just` (no args) for the full recipe list. Common ones:

| Command | What it does |
| --- | --- |
| `just db` / `just db-down` | start / stop the Postgres container |
| `just db-shell` | open `psql` against the local DB |
| `just migrate` | apply pending Piccolo migrations |
| `just migration-new` | autogenerate a new migration from table changes |
| `just superuser [user] [pw]` | create or upsert an admin |
| `just backend` | run uvicorn with reload |
| `just test` / `just lint` / `just format` | quality gates |

See [backend/README.md](backend/README.md) for the raw `uv` / `docker compose` equivalents.
