# TrueValue dev commands. Run `just` to list them.

set shell := ["bash", "-ceu"]

# Default: list recipes
default:
    @just --list

# === Setup ===

# Install backend Python deps via uv
install:
    cd backend && uv sync

# Full bootstrap: install deps, start DB, run migrations
bootstrap: install db migrate
    @echo "✅ Backend bootstrapped. Run 'just backend' to start the API, 'just superuser' to create an admin."

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
