# TrueValue

Proptech CRM for the INTERSIM TECH hackathon. Monolithic FastAPI backend + Vite/React frontend + edge clients (ESP32, Jetson Orin Nano).

See [plans/Plan_Arquitectura_TrueValue_CRM_Edge.md](plans/Plan_Arquitectura_TrueValue_CRM_Edge.md) for the architecture.

## Repository layout

```
TrueValue/
├── backend/    # FastAPI + Piccolo ORM, managed by UV
├── frontend/   # Vite + React + TS SPA (login + properties + sales)
├── edge/       # ESP32 / Jetson clients (placeholder)
├── infra/      # docker-compose.yml (Postgres)
└── plans/      # architecture & planning docs
```

## Quickstart

The fastest path uses [`just`](https://github.com/casey/just) from the repo root:

```bash
just bootstrap                                  # uv sync + npm install + start Postgres + apply migrations
just superuser admin pw admin@truevalue.local   # create the first admin (or `just superuser` to be prompted)
just backend                                    # terminal A — FastAPI on http://localhost:8000
just fe                                         # terminal B — Vite SPA on http://localhost:5173
```

Once running: SPA at `http://localhost:5173`, REST API at `/api/v1/*` (Swagger at `/docs`), Piccolo admin UI at `/admin/`. Default superuser after running `just superuser admin s3cr3tpass admin@truevalue.local`.

Run `just` (no args) for the full recipe list. Common ones:

| Command | What it does |
| --- | --- |
| `just db` / `just db-down` | start / stop the Postgres container |
| `just db-shell` | open `psql` against the local DB |
| `just migrate` | apply pending Piccolo migrations |
| `just migration-new` | autogenerate a new migration from table changes |
| `just superuser [user] [pw]` | create or upsert an admin |
| `just backend` / `just fe` | run the API / SPA dev servers |
| `just fe-lan` + `just lan-ip` | bind Vite to 0.0.0.0 and print your LAN IPv4 so teammates on the same Wi-Fi can open `http://<ip>:5173` |
| `just test` / `just lint` / `just format` | backend quality gates |

See [backend/README.md](backend/README.md) for raw `uv` / `docker compose` equivalents, and [plans/Implementation_Report_Frontend_v1.md](plans/Implementation_Report_Frontend_v1.md) for the frontend overview.
