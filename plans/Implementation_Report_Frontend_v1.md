# **Implementation Report: TrueValue Frontend v1 (Milestone "Frontend MVP")**

This document describes what was actually built in the initial frontend bootstrap of TrueValue. It complements [Implementation_Report_Backend_v1.md](Implementation_Report_Backend_v1.md) and supersedes the now-stale [Plan_Frontend_TrueValue_Basico.md](Plan_Frontend_TrueValue_Basico.md) (which targeted `/api/crm/*`, a JWT login endpoint that does not exist, and an NLP view whose backend is Milestone 3).

Status: **Frontend MVP complete** — SPA boots, authenticates against Piccolo's session_auth (the same backend the `/admin/` UI uses), and CRUDs properties and sales against `/api/v1/*`. Designed and verified for local development and LAN testing.

## **1\. Executive Summary**

- New `frontend/` app: **Vite 8 + React 19 + TypeScript 6 + Tailwind v4 + React Router 7**, npm.
- Three views: **Login**, **Properties** (list + create modal), **Sales** (list + create form). No Edit/Delete UI in this pass.
- Auth: **rides Piccolo's existing session_auth** — `POST /admin/public/login/` with CSRF, identity probed via `GET /admin/api/user/`. No parallel JWT.
- **Vite dev proxy** forwards `/api` and `/admin` to the backend, so the SPA uses **relative URLs**. This eliminates CORS in dev and turns LAN sharing into a one-URL problem.
- **CORS middleware** added to the backend anyway (driven by env), so direct cross-origin clients still work.
- **`justfile`** extended with `fe`, `fe-install`, `fe-lan`, `backend-lan`, and `lan-ip` recipes. `bootstrap` now installs both stacks.

## **2\. Final Frontend Structure**

```
frontend/
├── .env.example              # Optional VITE_API_BASE_URL / VITE_ADMIN_BASE_URL / BACKEND_URL overrides
├── .gitignore                # node_modules, dist, .vite (defaults from `create-vite`)
├── eslint.config.js          # `create-vite` defaults (React + Hooks)
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts            # @tailwindcss/vite plugin + /api and /admin proxy
└── src/
    ├── main.tsx              # mounts <App/>, BrowserRouter, AuthProvider
    ├── App.tsx               # nav + <Routes>
    ├── index.css             # @import "tailwindcss";
    ├── api/
    │   ├── client.ts         # fetchJson + ApiError + readCookie helper
    │   ├── auth.ts           # bootstrapCsrf, login, logout, getCurrentUser
    │   ├── properties.ts     # listProperties, createProperty, PROPERTY_TYPES
    │   └── sales.ts          # listSales, createSale, PAYMENT_METHODS
    ├── auth/
    │   ├── AuthContext.tsx   # <AuthProvider/> + useAuth()
    │   └── ProtectedRoute.tsx
    └── routes/
        ├── Login.tsx
        ├── Properties.tsx    # table + "New property" modal
        └── Sales.tsx         # table + inline "Register sale" form
```

**Why this shape:** mirrors the backend layout — `api/` is the thin transport layer, `auth/` owns session lifecycle, `routes/` are screens. Each module owns its own types; there is no shared "types" dump.

## **3\. Stack and Dependencies**

| Layer | Technology | Version |
| :---- | :---- | :---- |
| Build / dev server | Vite | 8.0 |
| UI library | React + React DOM | 19.2 |
| Language | TypeScript | 6.0 |
| Styles | Tailwind CSS | 4.3 (via `@tailwindcss/vite`) |
| Router | react-router-dom | 7.15 |
| Data layer | native `fetch` | — |
| Linter | ESLint (Vite defaults) | 10.x |
| Package manager | npm | 11.12 (Node 25) |

There is **no state management library**, **no form library**, and **no data-fetching library**. The whole SPA is plain React with controlled inputs and a small `AuthContext`. Listed-once enums (`property_type`, `payment_method`) live as `as const` literals next to their API modules — no separate constants file.

## **4\. Auth Strategy: Piccolo session_auth, end-to-end**

The decision was deliberate: rather than maintain a second auth path with JWT, the SPA reuses the auth stack that the Piccolo admin UI already drives. The flow matches the backend report §6 verbatim.

### **4.1 Login**

1. `GET /admin/` — backend sets a non-HttpOnly `csrftoken` cookie (1-year max-age, `SameSite=Lax`).
2. SPA reads the cookie with `document.cookie` (`readCookie("csrftoken")` in [src/api/client.ts](../frontend/src/api/client.ts)).
3. `POST /admin/public/login/` with JSON `{ username, password }` plus header `X-CSRFToken: <token>`. All fetches use `credentials: "include"`.
4. Backend returns `200 {"message": "logged in"}` plus a **HttpOnly** `id=...` session cookie (`SameSite=Lax`, 7-day max-age).
5. SPA calls `GET /admin/api/user/` → `{ "username": "...", "user_id": "..." }`. The numeric user id is parsed and stored in `AuthContext`.

### **4.2 Session boot / refresh**

On `<AuthProvider>` mount, the SPA probes `GET /admin/api/user/` once. If the friend already has a valid session cookie (e.g., page refresh), they stay logged in. If the server replies 401/403, the context resolves to `user: null` and `ProtectedRoute` redirects to `/login`.

### **4.3 Logout**

`POST /admin/public/logout/` is best-effort; the SPA clears local state regardless. The session cookie is wiped server-side.

### **4.4 Identity → `agent_id` on writes**

The CRM REST routes (`/api/v1/properties`, `/api/v1/sales`) are still **un-gated** per backend §10.6, but every create payload stamps `agent_id = useAuth().user.user_id`. The day Milestone 1.5 adds an auth gate to those routes, the SPA needs zero changes.

## **5\. Networking: Vite proxy, not CORS**

The default development topology is **proxy-based**, not CORS-based:

| Concern | What happens |
| :---- | :---- |
| SPA fetch URL | Always relative (`/api/v1/...`, `/admin/...`) — see `API_BASE_URL` and `ADMIN_BASE_URL` defaults in [src/api/client.ts](../frontend/src/api/client.ts). |
| Vite dev server | Proxies `/api` and `/admin` to `BACKEND_URL` (default `http://127.0.0.1:8000`) via [vite.config.ts](../frontend/vite.config.ts). |
| Browser | Sees a single origin (`http://<host>:5173`). No CORS preflight, no third-party-cookie concerns, no `Access-Control-*` headers. |

This means **friends on the LAN only ever need one URL** (the Vite one). All cookies — `csrftoken` and `id` — are set on the same origin the browser already trusts.

### **5.1 CORS middleware (still present)**

CORS was added to the backend regardless (driven by [backend/app/settings.py](../backend/app/settings.py) → `cors_origins`, comma-separated env via `CORS_ORIGINS`, default `["http://localhost:5173"]`). It does not gate anything for the SPA in dev, but it stays useful for:

- Hitting `/api/v1/*` directly from another origin (e.g., a `curl` from a friend's laptop pointed at `backend-lan`).
- Future SPAs deployed at a different origin from the API.

Note: `allow_origins=["*"]` cannot coexist with cookie credentials. The minimal "just works" config uses an explicit origin and `allow_credentials=True`.

## **6\. Field contracts**

The SPA mirrors the Pydantic schemas verbatim — no rename, no aliasing.

### **`POST /api/v1/properties`**

| Field | Type | Notes |
| :---- | :---- | :---- |
| `title` | string | required |
| `price` | number | ≥ 0; SPA sends number, server stores `Decimal` and returns string |
| `property_type` | enum | dropdown: `apartment` \| `house` \| `land` \| `office` |
| `location` | string | required |
| `agent_id` | number | injected from `AuthContext.user.user_id` |

### **`POST /api/v1/sales`**

| Field | Type | Notes |
| :---- | :---- | :---- |
| `product_or_service` | string | required |
| `amount` | number | ≥ 0 |
| `payment_method` | enum | dropdown: `cash` \| `card` \| `transfer` |
| `location` | string | required |
| `agent_id` | number | injected from `AuthContext.user.user_id` |
| `sold_at` | (omitted) | server defaults to `now()` |

Decimal fields (`price`, `amount`) are typed as `string` on the read side in TypeScript because the backend serializes `Decimal` as a string. The forms collect with `<input type="number">` and pass a JS number on POST.

## **7\. Tooling: justfile recipes**

Single source of truth for commands ([justfile](../justfile)):

| Recipe | Action |
| :---- | :---- |
| `bootstrap` | `install` + `fe-install` + `db` + `migrate`. Fresh-clone one-liner. |
| `install` | `uv sync` (backend deps). |
| `fe-install` | `npm install` (frontend deps). |
| `backend` | FastAPI on `http://127.0.0.1:8000` with autoreload. |
| `backend-lan` | FastAPI bound to `0.0.0.0`. Only needed for direct cross-device API access. |
| `fe` | Vite on `http://localhost:5173`. |
| `fe-lan` | Vite bound to `0.0.0.0`. Friends on the LAN open `http://<your-ip>:5173`. |
| `lan-ip` | Print the host's primary IPv4 (macOS-friendly: `en0` → `en1` → `ifconfig` fallback). |
| `db*`, `migrate*`, `superuser`, `test`, `lint`, `format` | Backend infra and quality gates (unchanged). |

### **Day-to-day local dev**

```bash
# Terminal A — API on localhost
just backend

# Terminal B — SPA on localhost
just fe
```

Then open `http://localhost:5173` and log in as `admin / s3cr3tpass`.

### **LAN demo / hackathon judging**

```bash
# Terminal A
just backend             # backend stays on 127.0.0.1; proxy handles reach

# Terminal B
just fe-lan              # Vite binds to 0.0.0.0

# Terminal C (one-shot)
just lan-ip              # e.g. "192.168.0.155"
```

Share `http://<that-ip>:5173` with anyone on the same Wi-Fi. The Vite dev proxy forwards `/api` and `/admin` from each visitor's browser back to the backend on the host — no per-friend config, no CORS, no env tweaks. Cookies live on the `<host-ip>:5173` origin like any normal site.

**Safety note:** `--host 0.0.0.0` on Vite (and on `backend-lan`) exposes the dev servers to everything on the local network. This is fine for trusted Wi-Fi during a hackathon; never run this on an untrusted network (coffee shop, conference, hotel).

## **8\. End-to-End Verification (what was run live)**

| Check | Result |
| :---- | :---- |
| `npm run build` (tsc + vite) | OK — 33 modules transformed, 248 kB JS / 12 kB CSS |
| CORS preflight `OPTIONS /api/v1/users` from `Origin: http://localhost:5173` | 200 + `Access-Control-Allow-Origin: http://localhost:5173` + `allow-credentials: true` |
| `GET /admin/` | 200 + `Set-Cookie: csrftoken=...` |
| `POST /admin/public/login/` with `X-CSRFToken` + admin credentials | 200 + `Set-Cookie: id=...` (HttpOnly) |
| `GET /admin/api/user/` w/ session cookie | 200 — `{"username":"admin","user_id":"1"}` |
| `POST /api/v1/properties` (real payload) | 201 — row returned with `agent_id=1` |
| `POST /api/v1/sales` (real payload) | 201 — row returned with `agent_id=1` |
| Vite proxy: `GET http://localhost:5173/api/v1/properties` | 200 + JSON, `server: uvicorn` (proxied through) |
| Vite proxy: `GET http://localhost:5173/admin/` | 200 + HTML + `Set-Cookie: csrftoken` on `:5173` origin |
| `just lan-ip` | Prints `192.168.0.155` on this dev machine |
| `just test` (backend) | 2/2 passing — CORS changes are non-breaking |

## **9\. Design Decisions and Trade-offs**

### **9.1 Vite proxy over CORS as the dev topology**

CORS was the original plan, but the moment LAN sharing entered scope it became a worse fit: friends would need either a baked-in LAN-IP API URL, or a backend allow-list that knows every visitor's origin (which is the same origin — Vite — anyway). Switching the SPA to relative URLs and proxying `/api` + `/admin` through Vite collapses both problems into one: there is exactly one URL to share, and the browser sees same-origin everything. CORS middleware stays in place for non-SPA clients but is no longer load-bearing in dev.

### **9.2 No TanStack Query, no Zustand, no Redux**

The MVP has two list views and two create flows. A query-cache library would pay for itself by the third or fourth list; not yet. The team's instinct was to keep the surface area small and add caching when the demos require it.

### **9.3 No form library**

`react-hook-form` would shave a few lines per form, but only two forms exist and both are short. Controlled inputs + native HTML validation suffice without adding a dependency.

### **9.4 Fixed-value dropdowns for `property_type` and `payment_method`**

The backend stores both as free `varchar`. Constraining them at the SPA layer trades flexibility for clean reporting later — a `WHERE payment_method = 'cash'` query will not need data-cleaning. If a new value needs to ship, it is a one-line edit to the `as const` list.

### **9.5 Decimal returned as string**

The backend's Pydantic `Decimal` schemas serialize as JSON strings (no precision loss). The SPA types reflect that (`price: string`, `amount: string`) and renders them with `tabular-nums`. No client-side currency formatting yet — the read-side strings show as-is to keep parity with what the backend stores. Add `Intl.NumberFormat` later if/when designers ask.

### **9.6 Tailwind v4 instead of v3**

`create-vite` defaulted us to a Vite 8 setup that pairs naturally with Tailwind v4. v4 ships as a Vite plugin (`@tailwindcss/vite`) with no `tailwind.config.js` and no `postcss.config.js`; styles use a single `@import "tailwindcss"` directive. Less config, same DX.

## **10\. Out of Scope (next milestones)**

- **Edit / delete UI** for properties and sales. The backend already exposes `PATCH` and `DELETE`; UI is a future pass.
- **Per-agent data filtering.** The list endpoints return everything; the SPA shows everything. The day Milestone 1.5 adds `WHERE agent_id = current_user.id`, the SPA will simply receive a filtered list.
- **Due-Diligence / NLP contract view.** Blocked on Milestone 3 backend (`/api/v1/ai/*` is an empty router today).
- **Production build / deploy.** No Dockerfile, no Nginx config, no static-asset CDN. `npm run build` produces a `dist/` but nothing serves it yet.
- **Pretty currency formatting**, sortable tables, search, pagination.
- **Frontend tests.** No Vitest setup yet; ESLint is the only quality gate. The build (`tsc -b && vite build`) catches type errors.
- **Edge / device clients.** Still empty per architecture doc — that is Milestone 2.

## **11\. Open Risks**

- **`SameSite=Lax` cookies and cross-origin SPAs:** mitigated entirely by the Vite proxy — SPA and backend appear same-origin to the browser in dev. The risk reappears the moment we serve the production build from a different origin than the API.
- **LAN exposure with `--host 0.0.0.0`:** see §7 — fine on trusted Wi-Fi, never on public networks.
- **No auth gate on `/api/v1/*`:** a malicious friend on the LAN could POST directly to `/api/v1/sales` (bypassing the SPA) and spoof `agent_id`. Acceptable for the hackathon demo; Milestone 1.5 closes this.
- **React 19 + React Router 7** are recent majors. Both are stable releases but the ecosystem (older blog posts, StackOverflow) often references v18/v6 patterns — read docs, not Google results.

## **12\. Quick References**

- **Backend report (companion):** [Implementation_Report_Backend_v1.md](Implementation_Report_Backend_v1.md)
- **Original architecture doc:** [Plan_Arquitectura_TrueValue_CRM_Edge.md](Plan_Arquitectura_TrueValue_CRM_Edge.md)
- **Plan that drove this work:** `~/.claude/plans/let-s-plan-the-actual-groovy-knuth.md`
- **All `just` recipes:** run `just` with no args at the repo root.
- **SPA dev URL:** `http://localhost:5173` (or `http://<lan-ip>:5173` via `just fe-lan`).
- **API + admin:** `http://localhost:8000/api/v1/*` and `http://localhost:8000/admin/`.
- **Default superuser** (per backend §11): `admin / s3cr3tpass`.
