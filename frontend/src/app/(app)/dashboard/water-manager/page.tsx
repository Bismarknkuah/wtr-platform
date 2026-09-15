"use client";
/**
 * Community Water Manager / Platform Operations Admin dashboard.
 *
 * The supply side of the business: how much water went in, how much was billed, where it is
 * being lost, whether the meters are being read, which readings need a decision, and the state
 * of the physical network (assets, maintenance, outages, quality).
 *
 * Data: GET /api/dashboard/operations/ (backend role_dashboards.py::operations_dashboard)
 */
import Link from "next/link";
import { useState } from "react";
import { Activity, AlertTriangle, Beaker, Droplets, Gauge, MapPin, Route, Siren, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, PageHeader, Table, useToast } from "@/components/ui";
import { ConsumptionLine, ScoreRing } from "@/components/charts";
import { AnomalyTrend, ConsumptionByCategory, CoverageTrend } from "@/components/dashboard/analytics";
import { useRoleDashboard } from "@/components/dashboard/shared";
import {
  AlertGrid,
  AlertTile,
  Breakdown,
  DueList,
  KpiCard,
  KpiGrid,
  Legend,
  ProgressBar,
  QuickActions,
  RankedList,
  SectionTitle,
  Timeline,
} from "@/components/dashboard/widgets";
import { date, m3, num, pct, title } from "@/lib/format";

const FLAG_HELP: Record<string, string> = {
  REVERSE_READING: "Reading lower than the previous one — meter reset, tampering or a typo.",
  DUPLICATE_READING: "Same value submitted twice for the same date.",
  IMPOSSIBLE_READING: "Consumption exceeds what the pipe could physically deliver.",
  CONSUMPTION_SPIKE: "Far above this customer's average — possible leak.",
  UNUSUALLY_LOW: "Far below average — possible bypass, faulty meter or vacant premises.",
  REPEATED_ZERO_CONSUMPTION: "Zero for several periods in a row.",
  METER_NOT_ACTIVE: "Reading taken on a meter that is not in Active status.",
  GPS_MISMATCH: "Reader was too far from the registered property.",
};

/** Production vs billed consumption, last 30 days. */
function SupplyChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data.map((x) => ({ ...x, day: x.date.slice(5) }))} barGap={1}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#4A5B6B" }} axisLine={false} tickLine={false} interval={4} />
        <YAxis tick={{ fontSize: 10, fill: "#4A5B6B" }} axisLine={false} tickLine={false} width={36} />
        <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)} m³`} />
        <Bar dataKey="produced" name="Produced" fill="#1D6FA5" radius={[3, 3, 0, 0]} />
        <Bar dataKey="consumed" name="Billed consumption" fill="#0F8B6E" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Non-revenue water by month with the community target line. */
function NrwChart({ data, target }: { data: any[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data.map((x) => ({ ...x, target }))}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#4A5B6B" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#4A5B6B" }} axisLine={false} tickLine={false} width={30} unit="%" />
        <Tooltip formatter={(v: any, n: any) => (n === "Target" ? `${v}%` : v == null ? "no data" : `${v}%`)} />
        <RLegend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="loss_percent" name="Water loss" stroke="#B3261E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        <Line type="monotone" dataKey="target" name="Target" stroke="#7A8A99" strokeDasharray="4 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function WaterManagerDashboard() {
  const { can } = useAuth();
  const { push } = useToast();
  const { data: d, picker, body, reload } = useRoleDashboard("/api/dashboard/operations/");
  const [busy, setBusy] = useState<number | null>(null);

  /** Validate or reject a flagged reading without leaving the dashboard. */
  const decide = async (id: number, approve: boolean) => {
    const note = approve ? "" : window.prompt("Reason for rejecting this reading:");
    if (!approve && note === null) return;
    setBusy(id);
    try {
      await api(`/api/readings/${id}/${approve ? "validate" : "reject"}/`, { body: { note } });
      push(approve ? "Reading validated — it can now be billed" : "Reading rejected — the reader will be asked to re-read");
      reload();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(null);
    }
  };

  const k = d?.kpis;
  const lossTone = k
    ? k.water_loss_percent == null
      ? "slate"
      : k.water_loss_percent <= k.loss_target_percent
        ? "ok"
        : k.water_loss_percent <= k.loss_target_percent * 2
          ? "warn"
          : "bad"
    : "slate";

  return (
    <div>
      <PageHeader
        title="Water operations"
        subtitle="Supply, meters, readings and the network — this month."
        actions={
          <>
            {picker}
            {can("MANAGE_INFRASTRUCTURE") && (
              <Link href="/production">
                <Button>
                  <Droplets className="h-4 w-4" />
                  Log production
                </Button>
              </Link>
            )}
          </>
        }
      />
      {body}

      {d && (
        <>
          {/* ---------------------------------------------------------------- KPIs */}
          <KpiGrid cols={6}>
            <KpiCard
              label="Water produced"
              value={m3(k.produced_m3)}
              sub="pumped into the network"
              icon={<Droplets className="h-4 w-4" />}
              href="/production"
            />
            <KpiCard
              label="Water billed"
              value={m3(k.consumed_m3)}
              sub="validated consumption"
              icon={<Gauge className="h-4 w-4" />}
              href="/readings"
            />
            <KpiCard
              label="Non-revenue water"
              value={pct(k.water_loss_percent)}
              tone={lossTone as any}
              sub={`target ≤ ${k.loss_target_percent}%`}
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="Reading coverage"
              value={`${k.reading_coverage.percent}%`}
              tone={k.reading_coverage.percent >= 90 ? "ok" : k.reading_coverage.percent >= 50 ? "warn" : "bad"}
              sub={`${num(k.reading_coverage.read)} of ${num(k.reading_coverage.total)} active meters read`}
              icon={<Route className="h-4 w-4" />}
              href="/routes"
            />
            <KpiCard
              label="Flagged readings"
              value={num(k.flagged_readings)}
              tone={k.flagged_readings ? "warn" : "ok"}
              sub={`${num(k.pending_readings)} pending in total`}
              icon={<AlertTriangle className="h-4 w-4" />}
              href="/readings?is_anomalous=true&status=PENDING"
            />
            <KpiCard
              label="Faulty / blocked meters"
              value={num(k.faulty_meters)}
              tone={k.faulty_meters ? "bad" : "ok"}
              sub={`${num(k.active_meters)} active · ${num(k.available_meters)} in stock`}
              icon={<Gauge className="h-4 w-4" />}
              href="/meters?status=FAULTY"
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* ---------------------------------------------------- Supply chart */}
            <Card title="Production vs billed consumption — last 30 days" className="lg:col-span-2">
              <SupplyChart data={d.daily} />
              <div className="mt-2 flex items-center justify-between">
                <Legend
                  items={[
                    { label: "Produced", color: "#1D6FA5" },
                    { label: "Billed consumption", color: "#0F8B6E" },
                  ]}
                />
                <span className="text-xs text-slate">
                  Readings land on the day they were taken, so consumption bunches around route days.
                </span>
              </div>
            </Card>

            {/* ------------------------------------------------------ Attention */}
            <Card title="Needs attention">
              <AlertGrid>
                <AlertTile
                  count={k.flagged_readings}
                  label="Flagged readings"
                  href="/readings?is_anomalous=true&status=PENDING"
                  hint="Validate or reject before billing"
                />
                <AlertTile
                  count={k.maintenance_overdue}
                  label="Maintenance overdue"
                  href="/maintenance"
                  tone={k.maintenance_overdue ? "bad" : "ok"}
                  hint={`${k.maintenance_due_30} more due within 30 days`}
                />
                <AlertTile
                  count={k.active_outages}
                  label="Active outages"
                  href="/outages"
                  tone={k.active_outages ? "bad" : "ok"}
                  hint={`${k.outage_hours_90d} h downtime in 90 days`}
                />
                <AlertTile
                  count={k.quality_alerts_90d}
                  label="Water-quality alerts"
                  href="/water-quality"
                  tone={k.quality_alerts_90d ? "warn" : "ok"}
                  hint="Last 90 days"
                />
                <AlertTile
                  count={k.assets_degraded}
                  label="Degraded / failed assets"
                  href="/infrastructure?status=DEGRADED"
                  tone={k.assets_degraded ? "warn" : "ok"}
                  hint={`${k.assets_total} assets in the network`}
                />
                <AlertTile
                  count={k.open_emergencies}
                  label="Open emergencies"
                  href="/emergencies"
                  tone={k.open_emergencies ? "bad" : "ok"}
                />
              </AlertGrid>
            </Card>

            {/* ------------------------------------------------- Flagged readings */}
            <Card
              title="Flagged readings waiting for a decision"
              className="lg:col-span-2"
              action={
                <Link href="/readings?is_anomalous=true&status=PENDING" className="text-xs font-semibold text-river">
                  All flagged →
                </Link>
              }
            >
              <Table
                rows={d.flagged_readings}
                columns={[
                  {
                    key: "meter_code",
                    label: "Meter",
                    render: (r) => (
                      <div>
                        <b>{r.meter_code}</b>
                        <div className="text-xs text-slate">{r.customer_name}</div>
                      </div>
                    ),
                  },
                  { key: "reading_date", label: "Date", render: (r) => date(r.reading_date) },
                  { key: "reading_value", label: "Prev → Current", render: (r) => `${r.previous_reading} → ${r.reading_value}` },
                  {
                    key: "consumption",
                    label: "m³",
                    render: (r) => <b className={Number(r.consumption) < 0 ? "text-bad" : ""}>{m3(r.consumption)}</b>,
                  },
                  {
                    key: "anomaly_flags",
                    label: "Why",
                    render: (r) => (
                      <div className="flex flex-wrap gap-1">
                        {r.anomaly_flags.map((f: string) => (
                          <span key={f} title={FLAG_HELP[f]}>
                            <Badge value={f} className="!bg-warn/10 !text-warn" />
                          </span>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "read_by_name",
                    label: "Reader",
                    render: (r) => (
                      <span className="text-xs">
                        {r.read_by_name}
                        {r.gps_distance_m != null ? ` · ${r.gps_distance_m} m from property` : ""}
                      </span>
                    ),
                  },
                  {
                    key: "__a",
                    label: "",
                    className: "text-right",
                    render: (r) =>
                      can("VALIDATE_READING") ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ok" loading={busy === r.id} onClick={() => decide(r.id, true)}>
                            Validate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="!text-bad"
                            loading={busy === r.id}
                            onClick={() => decide(r.id, false)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : null,
                  },
                ]}
                empty={
                  <div className="py-6 text-center text-sm text-slate">
                    No anomalies waiting. Every reading this month has been validated.
                  </div>
                }
              />
              {d.anomaly_flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate">
                  {d.anomaly_flags.map((f: any) => (
                    <span key={f.flag} className="rounded bg-wash px-2 py-1" title={FLAG_HELP[f.flag]}>
                      {title(f.flag)} <b className="text-ink">{f.count}</b>
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* ------------------------------------------------------- Routes */}
            <Card
              title="Reading routes this month"
              action={
                <Link href="/routes" className="text-xs font-semibold text-river">
                  Manage →
                </Link>
              }
            >
              {d.routes.length ? (
                <ul className="space-y-3">
                  {d.routes.map((r: any) => (
                    <li key={r.id}>
                      <ProgressBar value={r.read} max={r.households} label={r.name} detail={`${r.read}/${r.households} · ${r.progress}%`} />
                      <div className="mt-0.5 text-[11px] text-slate">
                        {r.reader_name || <span className="text-warn">no reader assigned</span>}
                        {r.schedule_note ? ` · ${r.schedule_note}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-6 text-center text-sm text-slate">
                  No routes yet.{" "}
                  <Link href="/routes" className="text-river">
                    Create one
                  </Link>{" "}
                  so readers know where to go.
                </div>
              )}
              <SectionTitle>Meters by status</SectionTitle>
              <Breakdown items={d.meters_by_status} labelKey="status" />
            </Card>

            {/* --------------------------------------------------------- NRW */}
            <Card title="Non-revenue water by month">
              <NrwChart data={d.nrw_trend} target={k.loss_target_percent} />
              <p className="mt-2 text-xs text-slate">
                Produced minus validated consumption, as a share of production. Leaks, illegal connections, under-registering meters and
                unbilled public use all end up here.
              </p>
            </Card>

            {/* --------------------------------------------------- Maintenance */}
            <Card
              title="Maintenance due"
              action={
                <Link href="/maintenance" className="text-xs font-semibold text-river">
                  Log a job →
                </Link>
              }
            >
              <DueList
                items={d.maintenance_due.map((a: any) => ({
                  id: a.id,
                  name: a.name,
                  sub: `${a.asset_id} · ${title(a.asset_type)}${a.parent_name ? ` · under ${a.parent_name}` : ""}`,
                  due_in_days: a.maintenance_due_in_days,
                  status: a.status,
                }))}
                href={() => "/maintenance"}
                empty="Nothing due in the next 30 days."
              />
              <SectionTitle>Assets by status</SectionTitle>
              <Breakdown items={d.assets_by_status} labelKey="status" />
            </Card>

            {/* ----------------------------------------------------- Quality */}
            <Card
              title="Water quality"
              action={
                <Link href="/water-quality" className="text-xs font-semibold text-river">
                  Record a test →
                </Link>
              }
            >
              {d.quality_history.length > 0 && (
                <div className="mb-3 flex gap-1">
                  {d.quality_history.map((h: any) => (
                    <div key={h.month} className="flex-1 text-center">
                      <div
                        className={`mx-auto h-8 w-full rounded ${h.tests === h.compliant ? "bg-ok/20" : "bg-warn/30"}`}
                        title={`${h.compliant}/${h.tests} compliant`}
                      />
                      <div className="mt-1 text-[10px] text-slate">{h.month}</div>
                    </div>
                  ))}
                </div>
              )}
              <Table
                rows={d.quality.slice(0, 5)}
                columns={[
                  { key: "tested_on", label: "Date", render: (r) => date(r.tested_on) },
                  { key: "testing_location", label: "Point" },
                  { key: "ph", label: "pH", render: (r) => r.ph ?? "—" },
                  { key: "turbidity_ntu", label: "NTU", render: (r) => r.turbidity_ntu ?? "—" },
                  { key: "chlorine_mg_l", label: "Cl", render: (r) => r.chlorine_mg_l ?? "—" },
                  { key: "ecoli_cfu", label: "E. coli", render: (r) => r.ecoli_cfu ?? "—" },
                  { key: "compliance_status", label: "", render: (r) => <Badge value={r.compliance_status} /> },
                ]}
                empty={<div className="py-6 text-center text-sm text-slate">No tests recorded.</div>}
              />
              {d.quality.some((q: any) => q.issues?.length) && (
                <ul className="mt-2 space-y-1 text-xs text-bad">
                  {d.quality
                    .filter((q: any) => q.issues?.length)
                    .slice(0, 3)
                    .map((q: any) => (
                      <li key={q.id}>
                        {date(q.tested_on)}: {q.issues.join("; ")}
                      </li>
                    ))}
                </ul>
              )}
            </Card>

            {/* ---------------------------------------------------- Outages */}
            <Card
              title="Outages"
              action={
                <Link href="/outages" className="text-xs font-semibold text-river">
                  Declare / restore →
                </Link>
              }
            >
              <Timeline
                items={d.outages.map((o: any) => ({
                  id: o.id,
                  when: o.started_at,
                  title: o.affected_area || "Whole community",
                  status: o.status,
                  tone: o.status === "ACTIVE" ? "bad" : "ok",
                  detail: `${o.cause}${o.asset_name ? ` · ${o.asset_name}` : ""} · ${o.duration_hours} h · ${num(o.customers_notified)} customers notified`,
                  href: "/outages",
                }))}
                empty="No outages recorded. Supply has been continuous."
              />
            </Card>

            {/* ----------------------------------------------- Top consumers */}
            <Card title="Largest consumers this month">
              <RankedList
                items={d.top_consumers}
                valueKey="m3"
                labelKey="household"
                subKey={(r) => `${r.customer_id} · ${title(r.category)}`}
                format={(v) => m3(v)}
                href={(r) => `/customers/${r.id}`}
              />
            </Card>

            {/* ------------------------------------------------- Sustainability */}
            <Card title="Sustainability score">
              <ScoreRing score={d.score.score} grade={d.score.grade} />
              <ul className="mt-3 space-y-1.5">
                {Object.entries(d.score.components).map(([key, c]: any) => (
                  <li key={key}>
                    <ProgressBar value={c.value} label={title(key)} detail={`${c.value} · weight ${Math.round(c.weight * 100)}%`} />
                  </li>
                ))}
              </ul>
            </Card>

            {/* ---------------------------------------------------- Analytics */}
            <Card title="Analytics — who uses the water this month" className="lg:col-span-2">
              <ConsumptionByCategory rows={d.analytics.consumption_by_category} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">
                    {d.analytics.avg_m3_per_connection != null ? m3(d.analytics.avg_m3_per_connection) : "—"}
                  </div>
                  <div className="text-slate">average per metered connection, month to date</div>
                </div>
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">
                    {d.analytics.litres_per_person_per_day != null ? `${num(d.analytics.litres_per_person_per_day)} L` : "—"}
                  </div>
                  <div className="text-slate">per person per day (WHO basic access ≈ 50 L)</div>
                </div>
              </div>
            </Card>
            <Card title="Reading coverage — 6 months">
              <CoverageTrend data={d.analytics.coverage_trend} />
              <p className="mt-2 text-xs text-slate">Share of active meters with at least one reading in the month.</p>
            </Card>
            <Card title="Consumption billed — 6 months">
              <ConsumptionLine data={d.analytics.consumption_trend} />
            </Card>
            <Card title="Reading quality — flagged & rejected">
              <AnomalyTrend data={d.analytics.anomaly_trend} />
            </Card>
            <Card title="Go deeper">
              <QuickActions
                cols={1}
                actions={[
                  {
                    label: "Water intelligence",
                    href: "/intelligence",
                    icon: <Activity className="h-4 w-4" />,
                    description: "Ask: where are we losing water? which households look abnormal?",
                    primary: true,
                  },
                  {
                    label: "Reports",
                    href: "/reports",
                    icon: <Droplets className="h-4 w-4" />,
                    description: "Production, consumption and quality by period",
                  },
                  {
                    label: "Sustainability score",
                    href: "/reports",
                    icon: <Gauge className="h-4 w-4" />,
                    description: "Seven components, explained",
                  },
                ]}
              />
            </Card>

            {/* ------------------------------------------------- Quick actions */}
            <Card title="Quick actions" className="lg:col-span-3">
              <QuickActions
                actions={[
                  {
                    label: "Validate readings",
                    href: "/readings?status=PENDING",
                    icon: <Gauge className="h-4 w-4" />,
                    description: `${num(k.pending_readings)} pending`,
                    primary: k.pending_readings > 0,
                  },
                  {
                    label: "Log water production",
                    href: "/production",
                    icon: <Droplets className="h-4 w-4" />,
                    description: "Daily volume pumped",
                  },
                  { label: "Meters", href: "/meters", icon: <Gauge className="h-4 w-4" />, description: "Install, replace, retire" },
                  {
                    label: "Reading routes",
                    href: "/routes",
                    icon: <Route className="h-4 w-4" />,
                    description: "Assign readers to households",
                  },
                  {
                    label: "Assets & network",
                    href: "/infrastructure",
                    icon: <MapPin className="h-4 w-4" />,
                    description: "Boreholes, pumps, tanks, pipelines",
                  },
                  {
                    label: "Log maintenance",
                    href: "/maintenance",
                    icon: <Wrench className="h-4 w-4" />,
                    description: "Preventive, corrective, inspection",
                  },
                  {
                    label: "Water-quality test",
                    href: "/water-quality",
                    icon: <Beaker className="h-4 w-4" />,
                    description: "WHO / GSA auto-grading",
                  },
                  {
                    label: "Declare emergency",
                    href: "/emergencies",
                    icon: <Siren className="h-4 w-4" />,
                    description: "Alerts all community staff",
                  },
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
