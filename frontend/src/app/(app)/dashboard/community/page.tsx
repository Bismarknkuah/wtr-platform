"use client";
/**
 * Community Admin dashboard.
 *
 * The whole community on one screen: the live engine strip (meters → readings → bills →
 * payments → outstanding), this month's KPIs with trends, everything that needs a decision,
 * financial and supply charts, the customer mix, the sustainability score and a live activity
 * feed of what the team has been doing.
 *
 * Data: GET /api/dashboard/community/ and GET /api/dashboard/activity/
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote, Beaker, ClipboardList, FileText, Gauge, Headset, Settings, UserPlus, Users, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, PageHeader } from "@/components/ui";
import { BilledVsCollected, ConsumptionLine, Donut, ScoreRing } from "@/components/charts";
import { PipelineStrip, useCommunityDashboard } from "@/components/dashboard/shared";
import {
  ActivityFeed,
  AlertGrid,
  AlertTile,
  KpiCard,
  KpiGrid,
  Legend,
  ProgressBar,
  QuickActions,
  SectionTitle,
} from "@/components/dashboard/widgets";
import { ghs, num, pct, title } from "@/lib/format";

export default function CommunityDashboard() {
  const { can } = useAuth();
  const { data: d, picker, body, community } = useCommunityDashboard();
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    if (!d) return;
    api("/api/dashboard/activity/", { params: { limit: 12, ...(community ? { community } : {}) } })
      .then(setFeed)
      .catch(() => setFeed([]));
  }, [d, community]);

  const o = d?.overview;
  const a = d?.alerts;
  const trend = d?.trend || [];
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const change = (key: string) => (prev && prev[key] ? Math.round(((last[key] - prev[key]) / prev[key]) * 1000) / 10 : null);
  const attentionTotal = a
    ? a.pending_readings +
      a.overdue_bills +
      a.open_tickets +
      a.pending_approvals +
      a.maintenance_due +
      a.active_outages +
      a.quality_alerts +
      a.open_emergencies
    : 0;

  return (
    <div>
      <PageHeader
        title={d ? d.community.name : "Community dashboard"}
        subtitle={d ? `${d.community.code} · service ${d.community.status.toLowerCase()} · this month at a glance` : undefined}
        actions={
          <>
            {picker}
            {can("MANAGE_COMMUNITY_SETTINGS") && d && (
              <Link href={`/communities/${d.community.id}`}>
                <Button variant="secondary">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            )}
          </>
        }
      />
      {body}

      {d && (
        <>
          <PipelineStrip o={o} a={a} />

          <KpiGrid cols={6}>
            <KpiCard
              label="Customers"
              value={num(o.total_customers)}
              sub={`${num(o.active_connections)} active · ${num(o.disconnected)} disconnected`}
              icon={<Users className="h-4 w-4" />}
              href="/customers"
            />
            <KpiCard
              label="Active meters"
              value={num(o.active_meters)}
              sub={`${num(o.faulty_meters)} faulty or blocked`}
              tone={o.faulty_meters ? "warn" : "ink"}
              icon={<Gauge className="h-4 w-4" />}
              href="/meters"
            />
            <KpiCard
              label="Billed this month"
              value={ghs(o.bills_generated)}
              delta={change("billed")}
              icon={<FileText className="h-4 w-4" />}
              href="/bills"
            />
            <KpiCard
              label="Collected"
              value={ghs(o.collected)}
              delta={change("collected")}
              tone="ok"
              sub={o.collection_efficiency != null ? `${o.collection_efficiency}% of billed` : undefined}
              icon={<Banknote className="h-4 w-4" />}
              href="/payments"
            />
            <KpiCard
              label="Outstanding"
              value={ghs(o.outstanding)}
              tone={o.outstanding > 0 ? "warn" : "ok"}
              sub={`${num(a.overdue_bills)} overdue bills`}
              href="/debt"
            />
            <KpiCard
              label="Non-revenue water"
              value={pct(o.water_loss_percent)}
              tone={
                o.water_loss_percent == null ? "slate" : o.water_loss_percent <= 20 ? "ok" : o.water_loss_percent <= 35 ? "warn" : "bad"
              }
              sub={`${num(o.monthly_production_m3)} m³ produced · ${num(o.monthly_consumption_m3)} m³ billed`}
              invertDelta
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Billed vs collected — last 6 months" className="lg:col-span-2">
              <BilledVsCollected data={trend} />
              <div className="mt-2 flex items-center justify-between">
                <Legend
                  items={[
                    { label: "Billed", color: "#1D6FA5" },
                    { label: "Collected", color: "#0F8B6E" },
                  ]}
                />
                <Link href="/reports" className="text-xs font-semibold text-river">
                  Revenue report →
                </Link>
              </div>
            </Card>

            <Card title={`Needs attention${attentionTotal ? ` (${attentionTotal})` : ""}`}>
              <AlertGrid>
                <AlertTile
                  count={a.pending_readings}
                  label="Readings to validate"
                  href="/readings?status=PENDING"
                  hint={a.anomalous_readings ? `${a.anomalous_readings} flagged` : undefined}
                />
                <AlertTile count={a.pending_approvals} label="Approvals waiting" href="/approvals?status=PENDING" />
                <AlertTile
                  count={a.overdue_bills}
                  label="Overdue bills"
                  href="/bills?status=OVERDUE"
                  tone={a.overdue_bills ? "bad" : "ok"}
                />
                <AlertTile count={a.open_tickets} label="Open service requests" href="/tickets" />
                <AlertTile count={a.maintenance_due} label="Maintenance due" href="/maintenance" hint="next 14 days" />
                <AlertTile
                  count={a.active_outages + a.open_emergencies}
                  label="Outages & emergencies"
                  href="/outages"
                  tone={a.active_outages + a.open_emergencies ? "bad" : "ok"}
                />
                <AlertTile count={a.quality_alerts} label="Water-quality alerts" href="/water-quality" hint="last 90 days" />
                <AlertTile
                  count={a.high_risk_customers}
                  label="High-risk customers"
                  href="/customers?risk_level=HIGH"
                  hint="theft / tamper risk score"
                />
              </AlertGrid>
            </Card>

            <Card title="Consumption trend (m³)">
              <ConsumptionLine data={trend} />
            </Card>

            <Card title="Payments by channel — this month">
              {d.payment_methods.length ? (
                <>
                  <Donut
                    data={d.payment_methods.map((p: any) => ({ name: title(p.method), value: Number(p.total) }))}
                    nameKey="name"
                    valueKey="value"
                  />
                  <ul className="mt-2 divide-y divide-line/60 text-sm">
                    {d.payment_methods.map((p: any) => (
                      <li key={p.method} className="flex justify-between py-1.5">
                        <span className="text-slate">{title(p.method)}</span>
                        <span>
                          <b>{ghs(p.total)}</b> <span className="text-xs text-slate">· {p.count}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="py-10 text-center text-sm text-slate">No payments yet this month.</div>
              )}
            </Card>

            <Card title="Sustainability score">
              <ScoreRing score={d.score.score} grade={d.score.grade} />
              <ul className="mt-3 space-y-1.5">
                {Object.entries(d.score.components).map(([key, c]: any) => (
                  <li key={key}>
                    <ProgressBar value={c.value} label={title(key)} detail={`${c.value}`} />
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Customers by category" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                {d.by_category.map((c: any) => (
                  <Link
                    href={`/customers?category=${c.category}`}
                    key={c.category}
                    className="rounded-md border border-line p-3 transition hover:border-river hover:bg-river-soft"
                  >
                    <div className="text-xs font-semibold text-slate">{title(c.category)}</div>
                    <div className="text-xl font-extrabold text-ink">{num(c.count)}</div>
                    <div className={`text-xs ${Number(c.outstanding) > 0 ? "text-bad" : "text-slate"}`}>{ghs(c.outstanding)} owed</div>
                  </Link>
                ))}
              </div>
              <SectionTitle>Quick actions</SectionTitle>
              <QuickActions
                actions={[
                  { label: "Register a customer", href: "/customers", icon: <UserPlus className="h-4 w-4" />, primary: true },
                  { label: "Record a payment", href: "/payments", icon: <Banknote className="h-4 w-4" /> },
                  { label: "Billing periods", href: "/billing", icon: <FileText className="h-4 w-4" /> },
                  { label: "Approvals", href: "/approvals", icon: <ClipboardList className="h-4 w-4" /> },
                  { label: "Service requests", href: "/tickets", icon: <Headset className="h-4 w-4" /> },
                  { label: "Maintenance", href: "/maintenance", icon: <Wrench className="h-4 w-4" /> },
                  { label: "Water quality", href: "/water-quality", icon: <Beaker className="h-4 w-4" /> },
                  { label: "Staff & roles", href: "/users", icon: <Users className="h-4 w-4" /> },
                ]}
              />
            </Card>

            <Card
              title="What the team has been doing"
              action={
                <Link href="/audit" className="text-xs font-semibold text-river">
                  Audit trail →
                </Link>
              }
            >
              <ActivityFeed items={feed} compact />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
