# WTR Ghana — Community Water Management Platform

Multi-tenant SaaS for community water systems in Ghana. One platform, many communities, each fully isolated:
customers → meters → readings → consumption → tariff → bills → payments → receipts → ledger → analytics.

| Layer | Stack | Hosting |
|---|---|---|
| Backend | Django 5/6 · Django REST Framework · SimpleJWT · PostgreSQL | Railway |
| Frontend | Next.js 15 (App Router) · TypeScript · Tailwind · Recharts — public homepage at `/`, app behind `/login` | Vercel |

```
wtr-platform/
├── backend/            Django project (config/, core/, apps/, tests/)
│   └── apps/           accounts · audit · communities · customers · meters · tariffs · billing
│                       payments · infrastructure · notifications · tickets · approvals · documents · analytics
└── frontend/           Next.js app (src/app, src/components, src/lib)
    └── src/app/(app)/dashboard/{platform,community,finance,water-manager,meter-reader,technician,support,auditor,customer}/page.tsx
```

**Every dashboard and every module is its own file** so you can edit one screen without touching another.

---

## 1. Run locally

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # edit SECRET_KEY etc. Leave DATABASE_URL out to use SQLite locally,
                                # or set it to your local Postgres: postgresql://postgres:PASSWORD@localhost:5432/wtr
python manage.py migrate
python manage.py seed_platform  # creates the platform super admin + default tariffs + plans
python manage.py runserver      # http://localhost:8000  ·  API docs: http://localhost:8000/api/docs/
python manage.py test tests     # end-to-end test of the whole business engine (must pass)
python manage.py seed_demo      # optional: a fully populated demo community (see below)
```

**Demo estate** (`seed_demo`, also runnable on Railway via the service shell) creates four communities with staff, customers, meters, five months of readings, bills, payments, infrastructure, quality tests, outages, tickets and approvals — see section 8 for the profiles and logins. The login page has a **Quick access** panel with one-tap buttons for every role. Password for all demo accounts: `Demo1234!`.
Default super admin: `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` from `.env` (`admin@wtr.gh` / `ChangeMe123!`). Change it after first login.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                     # http://localhost:3000
npm run build                   # production build (what Vercel runs)
```

---

## 2. Deploy the backend to Railway

> Migrations and `seed_platform` run in Railway's **pre-deploy** step (`backend/railway.json`), never in the Procfile: Nixpacks executes Procfile `release:` lines at *build* time, before the private network to Postgres exists, and the build would fail.

1. Create a new Railway project → **Deploy from GitHub repo** → pick this repo.
   Set **Root Directory** to `backend`.
2. Add a **PostgreSQL** service to the same project. Railway injects `DATABASE_URL` into the backend automatically.
3. In the backend service → **Variables**, add:

   | Variable | Value |
   |---|---|
   | `SECRET_KEY` | long random string (`python -c "import secrets;print(secrets.token_urlsafe(64))"`) |
   | `DEBUG` | `False` |
   | `ALLOWED_HOSTS` | `your-backend.up.railway.app` (add a custom domain here too if you use one) |
   | `CORS_ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` (comma-separate several) |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` |
   | `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` / `PLATFORM_ADMIN_NAME` | first super admin |
   | `SMS_PROVIDER` | `console` (default) · `arkesel` · `hubtel` |
   | `SMS_API_KEY`, `SMS_SENDER_ID` | from your SMS gateway |
   | `PAYSTACK_SECRET_KEY` | optional — enables live online payments + webhook verification |
   | `ANTHROPIC_API_KEY` | optional — AI narration on the Water Intelligence page |

4. Deploy. `railway.json` runs `migrate` + `seed_platform` before each release and starts gunicorn; the health check is `/api/health/`.
5. Generate a public domain (Settings → Networking). Note it for the frontend.
6. Paystack webhook (if used): `https://your-backend.up.railway.app/api/webhooks/paystack/` (HMAC-verified with `PAYSTACK_SECRET_KEY`).

> Railway's filesystem is ephemeral. Documents uploaded as files are lost on redeploy — use the **external link** option (Drive/S3/Cloudinary) for anything important, or attach a Railway volume at `/app/media`.

## 3. Deploy the frontend to Vercel

1. Vercel → **Add New Project** → import the repo → **Root Directory** = `frontend` (framework auto-detected: Next.js).
2. Environment variable: `NEXT_PUBLIC_API_URL = https://your-backend.up.railway.app` (no trailing slash).
3. Deploy. Then go back to Railway and make sure `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` contain the exact Vercel URL (`https://…vercel.app`, no trailing slash) — redeploy the backend if you changed them.

---

## 4. First-run walkthrough

1. Sign in as the platform super admin → **Communities → Register community** → **Approve**.
2. **Users & roles** → create a `COMMUNITY_ADMIN` for that community.
3. Sign in as the community admin:
   - **Tariffs** → create a tiered plan (and service charges / levies).
   - **Customers** → register households (optionally with a property), **Meters** → add and assign meters.
   - **Meter readings** → record readings (or meter readers use their dashboard; offline queue syncs automatically).
   - **Billing periods** → create a period → **Generate bills**. Customers get SMS/portal notifications.
   - **Payments** → record MoMo/cash/bank payments → receipts and ledger entries are automatic.
   - **Debt management** → run dunning; disconnections go through **Approvals**.
   - **Customers → Create portal login** gives a household access to the customer portal.

## 5. Roles

**Platform staff** — `PLATFORM_SUPER_ADMIN`, `PLATFORM_OPERATIONS_ADMIN` — run the platform: register and approve communities,
manage subscription plans, create each community's first admin account, and watch aggregate health indicators (counts, percentages, sustainability
scores). They have **no access to any community's data**: no customers, meters, tariffs, readings, bills, payments, tickets, infrastructure or audit trail.

**Community staff** — `COMMUNITY_ADMIN`, `COMMUNITY_FINANCE_OFFICER`, `COMMUNITY_WATER_MANAGER`, `METER_READER`, `TECHNICIAN`, `CUSTOMER_SUPPORT`,
`FRONT_DESK_COLLECTOR` (the cash window: types a meter number, sees what is owed, takes the payment, prints the receipt), `AUDITOR`,
plus any `CUSTOM` roles the admin defines — are locked to their own community and manage everything in it, including their own tariffs and billing policy. The community admin
hires the rest of the staff.

**`CUSTOMER`** sees only their own account.

**Platform roles have separate dashboards** — Super Admin (`/dashboard/platform`: registry, approvals, subscription plans, community admins, platform health),
Operations Admin (`/dashboard/platform-ops`: register & approve communities, first admins).

**A community is the district-level water utility and can serve many towns.** The community admin lists its towns under
My community → Towns; customers, properties and service requests are tagged with a town so officers see where things happen.

**Public problem reporting (QR / link).** Under Service & governance → *Public reporting QR*, the water manager (or admin / support)
gets a public link and QR code (downloadable PNG, printable A4 poster). Anyone who scans it can report a leak, dry taps, dirty water,
low pressure, a meter fault or an illegal connection in under a minute with no account; the report lands in Service requests marked
*Public link / QR*, tagged with the town, and staff are notified. The link can be regenerated at any time. Rate-limited.

**System settings (Community Admin → System settings)** let each community decide which feature modules every role may use
(a roles × modules matrix with tick-all / untick-all for the grid, per role and per module), **define custom roles** (any name, any set of
features — e.g. "Zone supervisor", "Board member") that are then assigned to staff under Users & roles, and switch portal features on or off
(customer portal, online payments, self-service requests, usage charts). The server recomputes every user's effective
permissions from this matrix on each request, so a disabled module disappears from the sidebar *and* is rejected by the API.

The permission matrix lives in `backend/core/roles.py` (see `docs/PERMISSIONS.md`) and is returned by `/api/auth/me/`; the sidebar and every page read from it.

## 6. Design guarantees

- **Community isolation** is enforced in the query layer (`core/tenancy.py`) — a community's records are visible only to that community's own staff. Other communities get nothing, and platform staff get nothing either (verified in the test suite).
- **Each community prices its own water**: tariff plans and service charges are community-owned; there are no platform-wide tariffs and the billing engine never falls back to another community's plan.
- **Open bills always equal the ledger balance**: when a new bill carries a previous balance forward, the older unpaid bills are marked *Carried forward* so a payment settles one document and the aging report never double-counts.
- **Financial records are immutable**: bills and payments are never edited; changes are adjustments, reversals or refunds, each producing an append-only ledger entry and an audit-log row.
- **Approval = execution**: approving a request runs the underlying action atomically (bill adjustment, refund, write-off, disconnection, tariff change, meter replacement…). Nobody can approve their own request.
- **IDs** follow the spec: `WTR-GH-GRE-001`, `CUS-GRE-000125`, `MTR-000001`, `INV-WTR-2026-000458`, `PAY-WTR-20260913-000928`, `RCT-WTR-…`, `WTR-000001` (tickets).
- **Anomaly detection** runs on every reading: reverse, duplicate, impossible, spike, unusually low, repeated zero, inactive meter, GPS mismatch. Flagged readings wait for validation before billing.

## 7. Phase-2 hooks (designed for, not yet wired)

- OCR of meter photos (`ocr_detected_value` + photo URL already captured) and direct camera upload.
- IoT/MQTT ingestion (`is_smart`, `iot_device_id`, `source=IOT` are in place — add an MQTT consumer that posts to `/api/readings/bulk_sync/`).
- Native mobile app — the meter-reader dashboard already works as an offline-first web app; a React Native app would use the same `bulk_sync` endpoint.
- GIS map (PostGIS + Leaflet) on top of the coordinates already stored for customers, meters, assets.
- Live SMS/WhatsApp needs gateway credentials (`SMS_PROVIDER=arkesel|hubtel`); the console provider logs messages until then.

## 8. Demo estate

`python manage.py seed_demo` builds four communities so every dashboard, including the platform benchmark, has real data:

| Community | Profile | Logins (`Demo1234!`) |
|-----------|---------|----------------------|
| Abokobi (Demo) | 24 households, well run | `admin.abokobi@wtr.gh`, `finance.abokobi@…`, `water.abokobi@…`, `reader.abokobi@…`, `tech.abokobi@…`, `support.abokobi@…`, `auditor.abokobi@…`, `desk.abokobi@…`, `zone.abokobi@…` (custom "Zone supervisor" role), household `mensah@demo.gh` |
| Nsawam Adoagyiri (Demo) | 16 households, high water loss, poor collections, active outage + emergency | `admin.nsawam@wtr.gh`, `finance.nsawam@…`, `water.nsawam@…`, `reader.nsawam@…`, `tech.nsawam@…` |
| Kpone (Demo) | 10 households, first months of billing | `admin.kpone@wtr.gh` … |
| Aburi (Demo) | registration pending approval | — |

Platform-level demo logins: `ops.platform@wtr.gh` (plus the super admin from `seed_platform`). The auditor is a community role: `auditor.abokobi@wtr.gh`.
Use `--reset` to rebuild. A `dumpdata` snapshot of the same estate is in `backend/fixtures/demo_data.json`
(`python manage.py loaddata fixtures/demo_data.json` on a fresh database is the fastest way to demo on Railway).

## 9. Role dashboard endpoints

| Endpoint | Role | Notes |
|----------|------|-------|
| `GET /api/dashboard/platform/` | platform roles | counts, averages, grade mix, benchmark (indicators only — no community data) |
| `GET /api/dashboard/community/` | community staff | overview, alerts, trend, score |
| `GET /api/dashboard/finance/` | finance officer / community admin | KPIs with deltas, daily collections, aging, dunning ladder, approvals |
| `GET /api/dashboard/operations/` | water manager / community admin | production vs consumption, NRW trend, routes, flagged readings, quality, outages |
| `GET /api/dashboard/meter-reader/` | meter reader | own routes with per-household context |
| `GET /api/dashboard/technician/` | technician | own tickets, unassigned field jobs, maintenance calendar |
| `GET /api/dashboard/support/` | customer support | queue, SLA breaches, CSAT, delivery health |
| `GET /api/dashboard/auditor/` | community auditor / community admin | activity volumes, approvals, sensitive financial actions |
| `GET /api/dashboard/front-desk/` | front desk collector | my takings today/week by channel, my receipts |
| `GET /api/customers/account-lookup/?q=` | community staff with payments/bills permission | meter number / customer ID / phone → balance, unpaid bills, last payments |
| `GET /api/dashboard/activity/` | staff (`?mine=1`, `?limit=`) | humanised audit feed (platform staff see platform-level events only) |

## 10. Documentation

- `docs/MODULES.md` — the 39 modules mapped to apps, endpoints and pages
- `docs/DASHBOARDS.md` — what each role dashboard shows and why
- `docs/PERMISSIONS.md` — the full role × permission matrix (generated from `core/roles.py`)
- `docs/DATA_MODEL.md` — every model and field (generated)
- `docs/openapi.yaml` / `openapi.json` — OpenAPI 3 schema (also served live at `/api/schema/` and `/api/docs/`)
- `docs/WTR-Ghana.postman_collection.json` — Postman collection; run **Auth → Login** first and the JWT is stored automatically
