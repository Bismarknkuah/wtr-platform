"use client";
/**
 * Dashboard widget library.
 *
 * Every role dashboard is its own page file (app/(app)/dashboard/<role>/page.tsx) and composes
 * these building blocks. Keeping the widgets here means a visual change (say, how a KPI delta
 * is coloured) lands on all nine dashboards at once, while each page stays free to decide
 * *what* it shows and in which order.
 *
 * Widgets in this file:
 *   KpiCard          – headline number with optional delta vs. previous period and a link
 *   KpiGrid          – responsive grid wrapper for KpiCards
 *   SectionTitle     – small uppercase heading used inside cards
 *   ProgressBar      – labelled progress bar (coverage, route progress, SLA)
 *   RankedList       – top-N list with a value and a proportional bar
 *   Breakdown        – status/category breakdown with counts and coloured badges
 *   ActivityFeed     – humanised audit-log feed
 *   QuickActions     – grid of primary actions for the role
 *   AlertTile        – attention item (count + label + link) with severity tone
 *   AlertGrid        – wrapper for AlertTiles
 *   MiniBars         – compact bar sparkline (daily counts)
 *   MiniArea         – compact area sparkline (daily amounts)
 *   Timeline         – vertical timeline for dated events (outages, maintenance)
 *   DueList          – dated to-do list with overdue highlighting
 *   Delta            – "+12.4%" / "−3.1%" inline indicator
 *   HeroBanner       – dark banner with headline number (customer portal, reader progress)
 *   Legend           – colour legend for charts
 *   ErrorBanner      – inline error message
 */
import Link from "next/link";
import { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Badge } from "@/components/ui";
import { datetime, num, title } from "@/lib/format";

export type Tone = "ink" | "ok" | "warn" | "bad" | "river" | "slate";

const TONE_TEXT: Record<Tone, string> = {
  ink: "text-ink",
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
  river: "text-river",
  slate: "text-slate",
};

const TONE_BG: Record<Tone, string> = {
  ink: "bg-ink",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  river: "bg-river",
  slate: "bg-slate-light",
};

const TONE_SOFT: Record<Tone, string> = {
  ink: "bg-wash text-ink",
  ok: "bg-ok/10 text-ok",
  warn: "bg-warn/10 text-warn",
  bad: "bg-bad/10 text-bad",
  river: "bg-river-soft text-river",
  slate: "bg-wash text-slate",
};

/* ------------------------------------------------------------------------------------------ */
/* Delta                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * Inline percentage change indicator. `invert` flips the colouring for metrics where a
 * decrease is good (outstanding debt, water loss, open tickets).
 */
export function Delta({
  value,
  invert = false,
  suffix = "vs last month",
}: {
  value: number | null | undefined;
  invert?: boolean;
  suffix?: string;
}) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] text-slate-light">no comparison yet</span>;
  }
  const positive = value > 0;
  const good = invert ? !positive : positive;
  const Icon = value === 0 ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${value === 0 ? "text-slate" : good ? "text-ok" : "text-bad"}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(1)}%<span className="ml-1 font-normal text-slate-light">{suffix}</span>
    </span>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* KPI cards                                                                                  */
/* ------------------------------------------------------------------------------------------ */

export function KpiCard({
  label,
  value,
  sub,
  delta,
  invertDelta,
  tone = "ink",
  href,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: number | null;
  invertDelta?: boolean;
  tone?: Tone;
  href?: string;
  icon?: ReactNode;
}) {
  const body = (
    <div className={`group flex h-full flex-col rounded-lg bg-white p-4 shadow-card transition ${href ? "hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-slate">{label}</div>
        {icon && <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${TONE_SOFT[tone]}`}>{icon}</div>}
      </div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums leading-tight ${TONE_TEXT[tone]}`}>{value}</div>
      <div className="mt-auto pt-1">
        {delta !== undefined && <Delta value={delta} invert={invertDelta} />}
        {sub && <div className="text-xs text-slate-light">{sub}</div>}
      </div>
      {href && (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-river opacity-0 transition group-hover:opacity-100">
          Open <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 }) {
  const map = {
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-3 xl:grid-cols-5",
    6: "md:grid-cols-3 xl:grid-cols-6",
  };
  return <div className={`mb-5 grid grid-cols-2 gap-3 ${map[cols]}`}>{children}</div>;
}

/* ------------------------------------------------------------------------------------------ */
/* Small typographic helpers                                                                  */
/* ------------------------------------------------------------------------------------------ */

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-light">{children}</div>
      {action}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{message}</div>;
}

export function MoreLink({ href, children = "See all" }: { href: string; children?: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-river hover:underline">
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Progress                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export function ProgressBar({
  value,
  max = 100,
  label,
  detail,
  tone,
  trackClass = "bg-wash",
}: {
  value: number;
  max?: number;
  label?: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
  /** Override the track colour, e.g. `bg-white/20` on a dark banner. */
  trackClass?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const auto: Tone = tone || (pct >= 90 ? "ok" : pct >= 50 ? "river" : "warn");
  return (
    <div>
      {(label || detail) && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold text-ink">{label}</span>
          <span className="text-slate">{detail ?? `${pct}%`}</span>
        </div>
      )}
      <div className={`h-2 w-full overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full transition-all ${TONE_BG[auto]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Ranked list / breakdown                                                                    */
/* ------------------------------------------------------------------------------------------ */

export function RankedList({
  items,
  valueKey,
  labelKey,
  subKey,
  format = (v) => num(v),
  href,
  tone = "river",
  empty = "Nothing to show.",
}: {
  items: any[];
  valueKey: string;
  labelKey: string | ((row: any) => ReactNode);
  subKey?: string | ((row: any) => ReactNode);
  format?: (v: any) => ReactNode;
  href?: (row: any) => string | undefined;
  tone?: Tone;
  empty?: ReactNode;
}) {
  if (!items.length) return <div className="py-6 text-center text-sm text-slate">{empty}</div>;
  const max = Math.max(...items.map((i) => Number(i[valueKey]) || 0), 0.0001);
  return (
    <ul className="space-y-2.5">
      {items.map((row, i) => {
        const label = typeof labelKey === "function" ? labelKey(row) : row[labelKey];
        const sub = subKey ? (typeof subKey === "function" ? subKey(row) : row[subKey]) : null;
        const link = href?.(row);
        const inner = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 shrink-0 text-right text-[11px] font-bold text-slate-light">{i + 1}</span>
                <span className="truncate font-semibold text-ink">{label}</span>
                {sub && <span className="hidden truncate text-xs text-slate sm:inline">{sub}</span>}
              </span>
              <span className="shrink-0 font-bold tabular-nums">{format(row[valueKey])}</span>
            </div>
            <div className="ml-6 mt-1 h-1.5 overflow-hidden rounded-full bg-wash">
              <div
                className={`h-full rounded-full ${TONE_BG[tone]}`}
                style={{ width: `${Math.max(2, (Number(row[valueKey]) / max) * 100)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={row.id ?? i}>
            {link ? (
              <Link href={link} className="-m-1 block rounded-md p-1 hover:bg-wash">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Breakdown({
  items,
  labelKey,
  countKey = "count",
  amountKey,
  formatAmount,
  total,
}: {
  items: any[];
  labelKey: string;
  countKey?: string;
  amountKey?: string;
  formatAmount?: (v: any) => ReactNode;
  total?: number;
}) {
  if (!items.length) return <div className="py-6 text-center text-sm text-slate">No data yet.</div>;
  const sum = total ?? items.reduce((a, b) => a + (Number(b[countKey]) || 0), 0);
  return (
    <ul className="divide-y divide-line/60">
      {items.map((it, i) => {
        const count = Number(it[countKey]) || 0;
        const share = sum ? Math.round((count / sum) * 100) : 0;
        return (
          <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Badge value={it[labelKey]} />
              <span className="text-xs text-slate">{share}%</span>
            </span>
            <span className="flex items-center gap-3">
              {amountKey && <span className="text-xs text-slate">{formatAmount ? formatAmount(it[amountKey]) : it[amountKey]}</span>}
              <span className="w-10 text-right font-bold tabular-nums">{num(count)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Alerts                                                                                     */
/* ------------------------------------------------------------------------------------------ */

export function AlertTile({ count, label, href, tone, hint }: { count: number; label: string; href: string; tone?: Tone; hint?: string }) {
  const auto: Tone = tone || (count > 0 ? "warn" : "ok");
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md border px-3 py-2.5 transition hover:shadow-card ${count > 0 ? "border-line bg-white" : "border-transparent bg-wash/60"}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-base font-extrabold ${TONE_SOFT[auto]}`}>
        {num(count)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-tight text-slate">{hint}</span>}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-light" />
    </Link>
  );
}

export function AlertGrid({ children, cols = 1 }: { children: ReactNode; cols?: 1 | 2 }) {
  return <div className={`grid gap-2 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>;
}

/* ------------------------------------------------------------------------------------------ */
/* Quick actions                                                                              */
/* ------------------------------------------------------------------------------------------ */

export type QuickAction = { label: string; href: string; icon?: ReactNode; description?: string; primary?: boolean };

export function QuickActions({ actions, cols = 2 }: { actions: QuickAction[]; cols?: 1 | 2 }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>
      {actions.map((a) => (
        <Link
          key={a.href + a.label}
          href={a.href}
          className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
            a.primary
              ? "border-river bg-river text-white hover:bg-river-light"
              : "border-line bg-white text-ink hover:border-river hover:bg-river-soft"
          }`}
        >
          {a.icon && <span className={`shrink-0 ${a.primary ? "text-white" : "text-river"}`}>{a.icon}</span>}
          <span className="min-w-0">
            <span className="block truncate font-semibold">{a.label}</span>
            {a.description && (
              <span className={`block truncate text-[11px] ${a.primary ? "text-white/75" : "text-slate"}`}>{a.description}</span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Activity feed                                                                              */
/* ------------------------------------------------------------------------------------------ */

const ACTION_TONE: Record<string, Tone> = {
  CREATE: "river",
  UPDATE: "slate",
  DELETE: "bad",
  LOGIN: "slate",
  APPROVE: "ok",
  EXECUTE: "ok",
  REJECT: "bad",
  PAYMENT: "ok",
  REVERSE: "warn",
  REFUND: "warn",
  GENERATE_BILLS: "river",
  VALIDATE: "ok",
  REPLACE: "warn",
};

export function ActivityFeed({
  items,
  empty = "No activity recorded yet.",
  compact = false,
}: {
  items: any[];
  empty?: string;
  compact?: boolean;
}) {
  if (!items.length) return <div className="py-6 text-center text-sm text-slate">{empty}</div>;
  return (
    <ul className="relative space-y-3 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-line">
      {items.map((e) => (
        <li key={e.id} className="relative flex gap-3 pl-6">
          <span
            className={`absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-white ${TONE_BG[ACTION_TONE[e.action] || "slate"]}`}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink">
              <span className="font-semibold">{e.actor}</span> <span className="text-slate">{e.text.replace(`${e.actor} `, "")}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-light">
              <span>{datetime(e.created_at)}</span>
              {e.community && !compact && <span>· {e.community}</span>}
              {e.changed_fields?.length > 0 && (
                <span>· changed {e.changed_fields.map((f: string) => f.replace(/_/g, " ")).join(", ")}</span>
              )}
              {e.reason && <span className="italic">· {e.reason}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Sparklines                                                                                 */
/* ------------------------------------------------------------------------------------------ */

function SparkTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-white px-2 py-1 text-xs shadow-card">
      <div className="font-semibold text-ink">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="text-slate">
          {p.name || p.dataKey}: <span className="font-bold text-ink">{formatter ? formatter(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function MiniBars({
  data,
  dataKey = "count",
  xKey = "date",
  height = 90,
  color = "#1D6FA5",
  formatter,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  height?: number;
  color?: string;
  formatter?: (v: any) => ReactNode;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey={xKey} hide />
        <Tooltip content={<SparkTooltip formatter={formatter} />} cursor={{ fill: "#EAF2F8" }} />
        <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniArea({
  data,
  dataKey = "total",
  xKey = "date",
  height = 90,
  color = "#0F8B6E",
  formatter,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  height?: number;
  color?: string;
  formatter?: (v: any) => ReactNode;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey={xKey} hide />
        <Tooltip content={<SparkTooltip formatter={formatter} />} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${color.replace("#", "")})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Timeline & due list                                                                        */
/* ------------------------------------------------------------------------------------------ */

export type TimelineItem = {
  id: string | number;
  when: string;
  title: ReactNode;
  detail?: ReactNode;
  status?: string;
  tone?: Tone;
  href?: string;
};

export function Timeline({ items, empty = "Nothing recorded." }: { items: TimelineItem[]; empty?: string }) {
  if (!items.length) return <div className="py-6 text-center text-sm text-slate">{empty}</div>;
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-line">
      {items.map((it) => {
        const inner = (
          <>
            <div className="text-[11px] text-slate-light">{datetime(it.when)}</div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              {it.title}
              {it.status && <Badge value={it.status} />}
            </div>
            {it.detail && <div className="text-xs text-slate">{it.detail}</div>}
          </>
        );
        return (
          <li key={it.id} className="relative pl-5">
            <span
              className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-white ${TONE_BG[it.tone || "river"]}`}
            />
            {it.href ? (
              <Link href={it.href} className="block rounded-md hover:bg-wash">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function DueList({
  items,
  empty = "Nothing due.",
  href,
}: {
  items: { id: any; name: ReactNode; sub?: ReactNode; due_in_days: number | null; status?: string }[];
  empty?: string;
  href?: (row: any) => string;
}) {
  if (!items.length) return <div className="py-6 text-center text-sm text-slate">{empty}</div>;
  return (
    <ul className="divide-y divide-line/60">
      {items.map((it) => {
        const d = it.due_in_days;
        const tone: Tone = d === null ? "slate" : d < 0 ? "bad" : d <= 7 ? "warn" : "ok";
        const text = d === null ? "unscheduled" : d < 0 ? `${-d}d overdue` : d === 0 ? "due today" : `in ${d}d`;
        const row = (
          <div className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{it.name}</div>
              {it.sub && <div className="truncate text-xs text-slate">{it.sub}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {it.status && <Badge value={it.status} />}
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${TONE_SOFT[tone]}`}>{text}</span>
            </div>
          </div>
        );
        return <li key={it.id}>{href ? <Link href={href(it)}>{row}</Link> : row}</li>;
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Hero banner & legend                                                                       */
/* ------------------------------------------------------------------------------------------ */

export function HeroBanner({
  eyebrow,
  headline,
  detail,
  tone = "ink",
  actions,
  aside,
}: {
  eyebrow: ReactNode;
  headline: ReactNode;
  detail?: ReactNode;
  tone?: "ink" | "ok" | "river" | "warn" | "bad";
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  const bg = { ink: "bg-ink", ok: "bg-ok", river: "bg-river", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div className={`mb-5 flex flex-col gap-4 rounded-lg p-5 text-white shadow-card md:flex-row md:items-center md:justify-between ${bg}`}>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">{eyebrow}</div>
        <div className="mt-1 text-3xl font-extrabold tabular-nums sm:text-4xl">{headline}</div>
        {detail && <div className="mt-2 text-sm text-white/80">{detail}</div>}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Convenience: `{label: "Residential"}` from a raw status/category value. */
export const pretty = (v: any) => title(String(v ?? ""));
