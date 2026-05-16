# TrueValue dev commands. Run `just` to list them.

set shell := ["bash", "-ceu"]

# Default: list recipes
default:
    @just --list

# === Setup ===

# Install backend Python deps via uv
install:
    cd backend && uv sync

# Install frontend npm deps
fe-install:
    cd frontend && npm install

# Full bootstrap: install backend + frontend deps, start DB, run migrations
bootstrap: install fe-install db migrate
    @echo "✅ TrueValue bootstrapped. Run 'just backend' + 'just fe' in two terminals."

# === Database (Postgres via Docker Compose) ===

# Start Postgres (waits until healthy)
db:
    docker compose -f infra/docker-compose.yml up -d --wait

# Stop Postgres (keeps volume)
db-down:
    docker compose -f infra/docker-compose.yml down

# Tail Postgres logs
db-logs:
    docker compose -f infra/docker-compose.yml logs -f postgres

# Open a psql shell against the local Postgres
db-shell:
    docker exec -it truevalue_postgres psql -U truevalue -d truevalue

# Drop the volume and recreate from scratch (DESTROYS DATA)
db-reset:
    docker compose -f infra/docker-compose.yml down -v
    just db
    just migrate

# === Migrations (Piccolo) ===

# Apply all pending migrations (truevalue + session_auth)
migrate:
    cd backend && uv run piccolo migrations forwards all

# Auto-generate a new migration for the truevalue app from current table state
migration-new:
    cd backend && uv run piccolo migrations new truevalue --auto

# Show migration status across all registered apps
migration-status:
    cd backend && uv run piccolo migrations check

# === Backend ===

# Run FastAPI dev server with autoreload (API: http://localhost:8000 — admin UI: /admin/)
backend:
    cd backend && uv run uvicorn app.main:app --reload

# Run FastAPI bound to 0.0.0.0 (raw API reachable from other LAN devices).
# Not required for the SPA — Vite's dev proxy already covers it.
backend-lan:
    cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0

# Run Vite dev server for the SPA (http://localhost:5173)
fe:
    cd frontend && npm run dev

# Run Vite bound to 0.0.0.0 so teammates can open http://<your-lan-ip>:5173.
# Vite's proxy still forwards /api + /admin to the local backend.
fe-lan:
    cd frontend && npm run dev -- --host 0.0.0.0

# Print this machine's primary IPv4 address so you can share http://<ip>:5173 with friends.
lan-ip:
    @ipconfig getifaddr en0 2>/dev/null \
        || ipconfig getifaddr en1 2>/dev/null \
        || ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}'

# Create or upsert an admin user (sets admin=superuser=active=true). Args: username password [email].
superuser username="" password="" email="":
    cd backend && SUPERUSER_USERNAME="{{username}}" SUPERUSER_PASSWORD="{{password}}" SUPERUSER_EMAIL="{{email}}" uv run python -m scripts.create_superuser

# === Quality ===

# Run backend tests
test:
    cd backend && uv run pytest

# Lint + format check (no changes)
lint:
    cd backend && uv run ruff check .
    cd backend && uv run ruff format --check .

# Auto-format the backend
format:
    cd backend && uv run ruff format .
