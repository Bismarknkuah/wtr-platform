"use client";
/** Public homepage / landing. */
import Link from "next/link";
import {
  ArrowRight,
  Droplets,
  Gauge,
  Receipt,
  ShieldCheck,
  Smartphone,
  Wrench,
  Beaker,
  Siren,
  BarChart3,
  Building2,
  Users,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const PIPE = ["Meter", "Reading", "Consumption", "Tariff", "Bill", "Payment", "Receipt", "Ledger", "Analytics"];
const FEATURES = [
  {
    icon: Gauge,
    title: "Meters & readings",
    text: "Full meter lifecycle with replacement audit trail. Readings from the office, a phone in the field (GPS + photo, offline-first), or IoT. Eight automatic anomaly checks.",
  },
  {
    icon: Receipt,
    title: "Tariffs, billing & payments",
    text: "Tiered, slab or flat tariffs plus levies. Monthly to quarterly periods, immutable invoices, MoMo / bank / cash / agent / USSD / online payments, instant receipts, append-only ledger.",
  },
  {
    icon: ShieldCheck,
    title: "Approvals & audit",
    text: "Adjustments, refunds, write-offs and disconnections need a second signature. Approving executes the change. Every action is logged with who, what, when and why.",
  },
  {
    icon: Wrench,
    title: "Infrastructure & maintenance",
    text: "Boreholes, pumps, tanks, pipelines as a network tree. Maintenance schedules, failure history, outages that notify customers, emergencies.",
  },
  {
    icon: Beaker,
    title: "Water quality",
    text: "pH, turbidity, chlorine, TDS, temperature and microbiology graded automatically against WHO / Ghana Standards Authority limits.",
  },
  {
    icon: Smartphone,
    title: "Customer portal",
    text: "Households see bills and usage, pay online, raise a leak or no-water request, and get SMS, WhatsApp, email or portal notifications.",
  },
  {
    icon: BarChart3,
    title: "Dashboards & benchmarking",
    text: "A dashboard for every role. Communities benchmarked on collection efficiency, non-revenue water, outages and a sustainability score.",
  },
  {
    icon: Sparkles,
    title: "Water intelligence",
    text: "Ask plain-English questions — highest losses, abnormal households, pumps likely to fail, why revenue fell, next month's demand.",
  },
];
const ROLES = [
  "Platform Super Admin",
  "Platform Operations Admin",
  "Auditor",
  "Community Admin",
  "Finance Officer",
  "Water Manager",
  "Meter Reader",
  "Technician",
  "Customer Support",
  "Front Desk Collector",
  "Custom roles you define",
  "Household / Customer",
];

export default function Home() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-river">
              <Droplets className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-extrabold">WTR Ghana</span>
            <span className="hidden text-xs text-slate sm:inline">· Community Water Management</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <a href="#features" className="hidden text-slate hover:text-ink md:inline">
              Features
            </a>
            <a href="#how" className="hidden text-slate hover:text-ink md:inline">
              How it works
            </a>
            <a href="#roles" className="hidden text-slate hover:text-ink md:inline">
              Roles
            </a>
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 rounded-md bg-river px-3.5 py-2 text-white hover:bg-river-light"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-1 rounded-md bg-ink px-3.5 py-2 text-white hover:bg-ink-2">
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
          <svg className="h-full w-full" viewBox="0 0 800 400" preserveAspectRatio="none">
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0" stopColor="#1D6FA5" />
                <stop offset="1" stopColor="#0F8B6E" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <path
                key={i}
                d={`M0 ${230 + i * 30} C 200 ${180 + i * 30}, 400 ${300 + i * 30}, 800 ${220 + i * 30} L800 400 L0 400Z`}
                fill="url(#g)"
                opacity={0.18 - i * 0.03}
              />
            ))}
          </svg>
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.2fr_1fr] lg:py-28">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
              Built for Ghana's community water systems
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Every drop metered.
              <br />
              Every cedi accounted for.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              One multi-tenant platform where each community — piped scheme, borehole, small town — runs its customers, meters, billing,
              payments, infrastructure and water quality, fully isolated from every other.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-md bg-river px-5 py-3 text-base font-bold hover:bg-river-light"
              >
                Try the live demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-md border border-white/25 px-5 py-3 text-base font-bold hover:bg-white/10"
              >
                See how it works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              {["Multi-tenant & isolated", "MoMo, bank, cash, USSD", "Offline-first meter reading", "SMS / WhatsApp receipts"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-ok" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="self-center rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur">
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/50">The core engine</div>
            <ol className="mt-3 space-y-1.5">
              {PIPE.map((p, i) => (
                <li key={p} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-river text-xs font-extrabold">{i + 1}</span>
                  <span className="font-semibold">{p}</span>
                  {i < PIPE.length - 1 && <span className="ml-auto text-white/30">↓</span>}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-white/50">
              Consumption = current reading − previous reading. Tariff turns m³ into cedis. Payments settle the oldest bill first. The
              ledger never forgets.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4">
          {[
            ["39", "modules from the spec"],
            ["11", "roles with granular permissions"],
            ["8", "automatic anomaly checks"],
            ["7", "payment channels"],
          ].map(([n, l]) => (
            <div key={l}>
              <div className="text-3xl font-extrabold text-river">{n}</div>
              <div className="text-sm text-slate">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-extrabold tracking-tight">Everything a water utility needs, in one place</h2>
        <p className="mt-2 max-w-2xl text-slate">From the first meter installation to the monthly sustainability score.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg bg-white p-5 shadow-card">
              <f.icon className="h-6 w-6 text-river" />
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="bg-white">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">How a month works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              [
                Gauge,
                "1 · Read",
                "Meter readers walk their route with a phone. Readings save on the device and sync when there's signal. Reverse readings, spikes and zero-consumption streaks are flagged for the water manager.",
              ],
              [
                Receipt,
                "2 · Bill",
                "The finance officer opens the billing period and generates bills. Each customer's consumption goes through their tariff plan plus service and infrastructure levies. Customers get an SMS.",
              ],
              [
                Users,
                "3 · Collect",
                "Households pay by MoMo, at an agent, in cash or in the portal. Receipts go out instantly. Overdue accounts move through reminders to a disconnection request that needs approval.",
              ],
            ].map(([Icon, t, d]: any) => (
              <div key={t} className="rounded-lg border border-line p-5">
                <Icon className="h-6 w-6 text-ok" />
                <h3 className="mt-3 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-sm text-slate">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">A dashboard for every role</h2>
            <p className="mt-2 text-slate">
              Platform staff see every community and choose one to work in. Community staff are locked to their own. Households see only
              their account. Permissions come from one matrix on the server — the sidebar, every page and every API call read from it.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-ink-2"
            >
              Open the demo as any role
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ROLES.map((r) => (
              <div key={r} className="rounded-md bg-white px-3 py-2.5 text-sm font-semibold shadow-card">
                {r}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2">
              <h2 className="text-2xl font-extrabold">Built to be trusted</h2>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                {[
                  "Strict tenant isolation enforced in the data layer — verified by automated tests.",
                  "Bills and payments are never edited: adjustments, reversals and refunds leave a trail.",
                  "Approval is execution — no approved request is left un-applied, and nobody approves their own.",
                  "Every create, update, delete, login, approval and payment lands in the audit log with before/after values.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-white/15 p-5">
              <div className="flex items-center gap-2 font-bold">
                <Building2 className="h-5 w-5 text-river-light" />
                Deploy
              </div>
              <p className="mt-2 text-sm text-white/70">
                Django REST API on Railway with PostgreSQL. Next.js frontend on Vercel. Optional Paystack, Arkesel/Hubtel SMS and Claude
                narration.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
                <Siren className="h-4 w-4" />
                IoT, OCR and GIS hooks ready for phase 2.
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-slate">
          <span className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-river" />
            WTR Ghana · Community Water Management Platform
          </span>
          <span>
            <Link href="/login" className="font-semibold text-river">
              Sign in
            </Link>{" "}
            · API docs at <code>/api/docs/</code>
          </span>
        </div>
      </footer>
    </div>
  );
}
