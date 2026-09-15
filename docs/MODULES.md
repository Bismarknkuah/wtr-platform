# Module map

How the 39 modules in the specification map onto the code. Each row names the Django app that owns the
logic, the main API endpoints, and the Next.js page(s) where the work happens.

| # | Module | Backend (app / service) | API | Frontend page |
|---|--------|-------------------------|-----|---------------|
| 1 | Platform super-admin dashboard | `analytics.services.platform_dashboard` | `GET /api/dashboard/platform/` | `/dashboard/platform` |
| 2 | Community registration & approval | `communities` (`approve`, `suspend` actions) | `/api/communities/` | `/communities`, `/communities/[id]` |
| 3 | Subscription plans | `communities.SubscriptionPlan` | `/api/plans/` | `/plans` |
| 4 | Community benchmark | `analytics.services.benchmark` | `GET /api/analytics/benchmark/` | `/benchmark` |
| 5 | User & role management | `accounts` + `core/roles.py` matrix | `/api/users/`, `/api/auth/*` | `/users` |
| 6 | Community admin dashboard | `analytics.services.community_dashboard` | `GET /api/dashboard/community/` | `/dashboard/community` |
| 7 | Community settings | `communities.CommunitySettings` | `PATCH /api/communities/{id}/settings/` | `/communities/[id]`, `/settings` |
| 8 | Properties | `customers.Property` | `/api/properties/` | `/properties` |
| 9 | Customer registration | `customers.Customer` (+ risk scoring) | `/api/customers/` | `/customers`, `/customers/[id]` |
| 10 | Customer categories & tariff assignment | `customers` + `tariffs` | `/api/customers/{id}/`, approval `TARIFF_CHANGE` | `/customers/[id]` |
| 11 | Meter register & lifecycle | `meters.Meter` | `/api/meters/` | `/meters` |
| 12 | Meter replacement with audit trail | `meters.services.replace_meter` | `POST /api/meters/{id}/replace/` | `/meters` |
| 13 | Reading routes | `meters.ReadingRoute` | `/api/routes/` | `/routes` |
| 14 | Meter reading (office / mobile / IoT) | `meters.services.record_reading` | `POST /api/readings/`, `POST /api/readings/bulk_sync/`, `GET /api/meters/lookup/?number=` (key in the meter number) | `/readings`, `/dashboard/meter-reader` |
| 15 | Offline-first field capture | localStorage queue → `bulk_sync` (idempotent by `client_reading_id`) | `POST /api/readings/bulk_sync/` | `/dashboard/meter-reader` |
| 16 | Anomaly detection (8 checks) | `meters.services.detect_anomalies` | flags on every reading | `/readings?is_anomalous=true` |
| 17 | Reading validation | `meters.services.validate_reading` | `POST /api/readings/{id}/validate|reject/` | `/readings`, `/dashboard/water-manager` |
| 18 | Tariff plans (tiered / slab / flat) + levies | `tariffs` | `/api/tariffs/`, `/api/service-charges/` | `/tariffs` |
| 19 | Billing periods | `billing.BillingPeriod` | `/api/billing-periods/` | `/billing` |
| 20 | Bill generation engine | `billing.services.generate_bills_for_period` | `POST /api/billing-periods/{id}/generate/` | `/billing` |
| 21 | Bills & invoices | `billing.Bill` (immutable; adjustments are separate rows) | `/api/bills/` | `/bills`, `/bills/[id]` |
| 22 | Payments (MoMo, bank, cash, agent, USSD, online) | `payments.services.record_payment` (+ Paystack webhook) | `/api/payments/`, `/api/payments/webhook/paystack/` | `/payments`, `/portal/pay` |
| 23 | Receipts | `payments.Receipt` (auto on settle) | `/api/receipts/` | `/payments` |
| 24 | Customer ledger | `payments.LedgerEntry` (append-only) | `/api/ledger/` | `/customers/[id]` |
| 25 | Reversals & refunds | `payments.services.reverse_payment`, `refund_payment` | `POST /api/payments/{id}/reverse/`; refund via approval | `/payments`, `/approvals` |
| 26 | Debt management & dunning | `billing.services.run_dunning`, `refresh_overdue` | `POST /api/bills/refresh_overdue/`, `/api/debt/run_dunning/` | `/debt` |
| 27 | Approvals (adjust / refund / write-off / disconnect / tariff) | `approvals.services.decide` → executes | `/api/approvals/`, `.../approve/`, `.../reject/` | `/approvals` |
| 28 | Infrastructure register (asset tree) | `infrastructure.Asset` | `/api/assets/` | `/infrastructure` |
| 29 | Maintenance scheduling & history | `infrastructure.MaintenanceRecord` | `/api/maintenance/` | `/maintenance` |
| 30 | Water production & non-revenue water | `analytics.WaterProduction`, `water_loss_percent` | `/api/water-production/` | `/production` |
| 31 | Outages & customer notification | `infrastructure.Outage` | `/api/outages/`, `.../restore/` | `/outages` |
| 32 | Water quality (WHO / GSA grading) | `infrastructure.WaterQualityTest.evaluate` | `/api/water-quality/` | `/water-quality` |
| 33 | Emergencies | `infrastructure.Emergency` | `/api/emergencies/` | `/emergencies` |
| 34 | Service requests / tickets | `tickets.ServiceRequest` | `/api/tickets/`, `.../assign/`, `.../transition/` | `/tickets`, `/tickets/[id]` |
| 34b | Public problem reporting (QR / link) | `communities.views.PublicReportView` (no auth, throttled) | `GET/POST /api/public/report/<token>/`, `GET/POST /api/public-report-link/` | `/report/[token]` (public), `/public-reporting` (staff) |
| 7b | Towns served by a community | `communities.Town` | `/api/towns/` | `/communities/[id]` → Towns |
| 5b | System settings: feature access per role, custom roles, portal switches | `communities.CommunityRole`, `CommunitySettings.module_access`, `core/modules.py` | `/api/communities/{id}/features/`, `/api/community-roles/` | `/system-settings` |
| 35 | Notifications (SMS / WhatsApp / email / portal) | `notifications.services.notify` | `/api/notifications/`, `.../send/`, `.../broadcast/` | `/notifications` |
| 36 | Documents | `documents.Document` (file or external URL) | `/api/documents/` | `/documents` |
| 37 | Audit trail | `audit.services.log_action` | `/api/audit/` | `/audit`, `/dashboard/auditor` |
| 38 | Sustainability score & reports | `analytics.services.sustainability_score`, `revenue_report` | `/api/analytics/score/`, `/api/analytics/revenue/` | `/reports` |
| 39 | Water intelligence (natural-language questions) | `analytics.services.intelligence` (rules; optional Claude narration) | `POST /api/analytics/intelligence/` | `/intelligence` |

## Role dashboards

Every role has its own page file and its own backend service, so each can evolve independently:

| Role | Page | Backend service | Endpoint |
|------|------|-----------------|----------|
| Platform Super / Finance / Operations Admin | `dashboard/platform/page.tsx` | `platform_dashboard` (indicators only) | `/api/dashboard/platform/` |
| Community Admin | `dashboard/community/page.tsx` | `community_dashboard` | `/api/dashboard/community/` |
| Finance Officer | `dashboard/finance/page.tsx` | `role_dashboards.finance_dashboard` | `/api/dashboard/finance/` |
| Water Manager | `dashboard/water-manager/page.tsx` | `role_dashboards.operations_dashboard` | `/api/dashboard/operations/` |
| Meter Reader | `dashboard/meter-reader/page.tsx` | `role_dashboards.meter_reader_dashboard` | `/api/dashboard/meter-reader/` |
| Technician | `dashboard/technician/page.tsx` | `role_dashboards.technician_dashboard` | `/api/dashboard/technician/` |
| Customer Support | `dashboard/support/page.tsx` | `role_dashboards.support_dashboard` | `/api/dashboard/support/` |
| Community Auditor | `dashboard/auditor/page.tsx` | `role_dashboards.auditor_dashboard` | `/api/dashboard/auditor/` |
| Customer | `dashboard/customer/page.tsx` | `customer_portal` | `/api/dashboard/customer/` |

`/dashboard` itself is a router that reads the signed-in user's role and redirects to the right page.

## Cross-cutting

- **Tenancy** — `core/tenancy.py::TenantQuerysetMixin` filters every list/detail by the user's community. Platform roles get an empty queryset from every tenant-scoped endpoint: they manage the registry, plans and community-admin accounts, and see only aggregate indicators. Verified in `tests/test_end_to_end.py`.
- **Permissions** — `core/roles.py` (matrix), `core/permissions.py::HasPermission` (enforcement). See `PERMISSIONS.md`.
- **IDs** — `core/ids.py` generates human-readable identifiers (`WTR-GH-GRE-001`, `CUS-GRE-000009`, `MTR-000009`, `INV-WTR-2026-000166`, `PAY-WTR-20260914-000122`).
- **Audit** — `audit.services.log_action` is called by every service and by the generic viewset mixin; it never raises.
