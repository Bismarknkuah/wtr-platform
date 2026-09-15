"use client";
/**
 * Customer Support dashboard.
 *
 * A help-desk console: find any household in two keystrokes, see the request queue with SLA
 * breaches first, assign work, watch satisfaction and notification delivery, and broadcast
 * during outages.
 *
 * Data: GET /api/dashboard/support/ (backend role_dashboards.py::support_dashboard) plus live
 *       customer search against /api/customers/?search=
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Headset, MessageSquare, Search, Smile, Star, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Input, PageHeader, Spinner, Table, Tabs, useToast } from "@/components/ui";
import { useRoleDashboard } from "@/components/dashboard/shared";
import {
  AlertGrid,
  AlertTile,
  Breakdown,
  KpiCard,
  KpiGrid,
  MiniBars,
  QuickActions,
  RankedList,
  SectionTitle,
} from "@/components/dashboard/widgets";
import { datetime, ghs, num, title } from "@/lib/format";

function ageLabel(hours: number | null) {
  if (hours == null) return "";
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

/** Live customer lookup with debounce. */
function CustomerLookup({ community }: { community: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api("/api/customers/", { params: { search: q, page_size: 8, ...(community ? { community } : {}) } })
        .then((d) => setHits(d.results))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, community]);
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-light" />
        <Input
          className="!h-11 !pl-10 !text-base"
          placeholder="Name, customer ID, phone, meter or address…"
          value={q}
          onChange={(e: any) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {searching && <div className="mt-2 text-xs text-slate">Searching…</div>}
      {hits.length > 0 && (
        <ul className="mt-2 divide-y divide-line/60 rounded-md border border-line">
          {hits.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-wash">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{c.household_name}</div>
                  <div className="truncate text-xs text-slate">
                    {c.customer_id} · {c.contact_person} · {c.phone}
                    {c.meter ? ` · ${c.meter.meter_id}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <Badge value={c.account_status} />
                  <span className={`font-bold tabular-nums ${Number(c.outstanding_balance) > 0 ? "text-bad" : "text-ok"}`}>
                    {ghs(c.outstanding_balance)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !searching && !hits.length && <div className="mt-2 text-xs text-slate">No customer matches “{q}”.</div>}
    </div>
  );
}

export default function SupportDashboard() {
  const { can } = useAuth();
  const { push } = useToast();
  const { data: d, picker, body, community, reload } = useRoleDashboard("/api/dashboard/support/");
  const [tab, setTab] = useState<"queue" | "sla" | "resolved">("queue");
  const [busy, setBusy] = useState<number | null>(null);

  const claim = useCallback(
    async (t: any, userId: number | undefined) => {
      setBusy(t.id);
      try {
        await api(`/api/tickets/${t.id}/assign/`, { body: { assigned_to: userId, priority: t.priority } });
        push(`${t.ticket_number} assigned`);
        reload();
      } catch (e: any) {
        push(e.message, "bad");
      } finally {
        setBusy(null);
      }
    },
    [push, reload],
  );

  const k = d?.kpis;
  const ticketColumns = [
    {
      key: "ticket_number",
      label: "Ticket",
      render: (r: any) => (
        <Link href={`/tickets/${r.id}`} className="font-semibold text-river">
          {r.ticket_number}
        </Link>
      ),
    },
    {
      key: "title",
      label: "Issue",
      render: (r: any) => (
        <div>
          <div className="font-semibold text-ink">{r.title}</div>
          <div className="text-xs text-slate">{title(r.category)}</div>
        </div>
      ),
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (r: any) =>
        r.customer ? (
          <Link href={`/customers/${r.customer}`} className="text-river">
            {r.customer_name}
            <div className="text-xs text-slate">{r.customer_phone}</div>
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "assigned_to_name", label: "Assigned", render: (r: any) => r.assigned_to_name || <span className="text-warn">unassigned</span> },
    { key: "priority", label: "Priority", render: (r: any) => <Badge value={r.priority} /> },
    { key: "age_hours", label: "Open for", render: (r: any) => ageLabel(r.age_hours) },
    { key: "status", label: "Status", render: (r: any) => <Badge value={r.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Support desk"
        subtitle="Find a household fast, resolve requests, keep customers informed."
        actions={
          <>
            {picker}
            <Link href="/tickets">
              <Button>
                <Headset className="h-4 w-4" />
                New service request
              </Button>
            </Link>
          </>
        }
      />
      {body}

      {d && (
        <>
          <Card className="mb-5">
            <CustomerLookup community={community} />
          </Card>

          <KpiGrid cols={6}>
            <KpiCard
              label="Open requests"
              value={num(k.open)}
              tone={k.open ? "warn" : "ok"}
              sub={`${num(k.new_today)} new today`}
              icon={<Headset className="h-4 w-4" />}
              href="/tickets?status=OPEN"
            />
            <KpiCard
              label="Unassigned"
              value={num(k.unassigned)}
              tone={k.unassigned ? "bad" : "ok"}
              sub="nobody owns these yet"
              icon={<UserPlus className="h-4 w-4" />}
            />
            <KpiCard
              label="SLA breached"
              value={num(k.sla_breached)}
              tone={k.sla_breached ? "bad" : "ok"}
              sub="urgent > 4 h · high > 24 h · other > 72 h"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <KpiCard
              label="Resolved (30 days)"
              value={num(k.resolved_30d)}
              tone="ok"
              sub={k.avg_resolution_hours != null ? `avg ${k.avg_resolution_hours} h` : "—"}
            />
            <KpiCard
              label="Satisfaction"
              value={k.csat != null ? `${k.csat.toFixed(1)} / 5` : "—"}
              tone={k.csat == null ? "slate" : k.csat >= 4 ? "ok" : k.csat >= 3 ? "warn" : "bad"}
              sub={`${num(k.csat_responses)} ratings`}
              icon={<Star className="h-4 w-4" />}
            />
            <KpiCard
              label="Messages sent (7 days)"
              value={num(k.notifications_7d)}
              tone={k.notifications_failed_7d ? "warn" : "ink"}
              sub={`${num(k.notifications_failed_7d)} failed`}
              icon={<MessageSquare className="h-4 w-4" />}
              href="/notifications"
            />
          </KpiGrid>

          {d.outages.length > 0 && (
            <div className="mb-5 rounded-lg border-l-4 border-warn bg-warn/5 p-4">
              <div className="mb-1 font-bold text-ink">Active outage — customers may call about this</div>
              {d.outages.map((o: any) => (
                <div key={o.id} className="text-sm text-slate">
                  <b className="text-ink">{o.affected_area || "Whole community"}</b>: {o.cause}. Since {datetime(o.started_at)}
                  {o.expected_restoration ? `, expected back ${datetime(o.expected_restoration)}` : ""}. {num(o.customers_notified)}{" "}
                  customers notified.
                </div>
              ))}
              {can("SEND_NOTIFICATIONS") && (
                <Link href="/notifications" className="mt-2 inline-block text-xs font-semibold text-river">
                  Send an update →
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <Tabs
                tabs={[
                  { key: "queue", label: `Queue (${d.queue.length})` },
                  { key: "sla", label: `SLA breached (${d.sla_breached.length})` },
                  { key: "resolved", label: "Recently resolved" },
                ]}
                value={tab}
                onChange={(v) => setTab(v as any)}
              />
              {tab === "queue" && (
                <Table
                  rows={d.queue}
                  columns={ticketColumns}
                  empty={<div className="py-8 text-center text-sm text-slate">The queue is empty. 🎉</div>}
                />
              )}
              {tab === "sla" && (
                <Table
                  rows={d.sla_breached}
                  columns={ticketColumns}
                  empty={<div className="py-8 text-center text-sm text-slate">No breaches — every open request is inside its target.</div>}
                />
              )}
              {tab === "resolved" && (
                <Table
                  rows={d.recent_resolved}
                  columns={[
                    ...ticketColumns.filter((c) => !["age_hours", "priority"].includes(c.key)),
                    { key: "resolved_at", label: "Resolved", render: (r: any) => datetime(r.resolved_at) },
                    {
                      key: "satisfaction_rating",
                      label: "Rating",
                      render: (r: any) =>
                        r.satisfaction_rating ? (
                          <span className="text-warn">{"★".repeat(r.satisfaction_rating)}</span>
                        ) : (
                          <span className="text-slate-light">—</span>
                        ),
                    },
                  ]}
                  empty={<div className="py-8 text-center text-sm text-slate">Nothing resolved yet.</div>}
                />
              )}
            </Card>

            <Card title="Needs attention">
              <AlertGrid>
                <AlertTile
                  count={k.unassigned}
                  label="Unassigned requests"
                  href="/tickets?status=OPEN"
                  tone={k.unassigned ? "bad" : "ok"}
                  hint="Assign to a technician or yourself"
                />
                <AlertTile count={k.sla_breached} label="Past SLA" href="/tickets" tone={k.sla_breached ? "bad" : "ok"} />
                <AlertTile count={k.urgent} label="Urgent" href="/tickets?priority=URGENT" tone={k.urgent ? "bad" : "ok"} />
                <AlertTile
                  count={k.notifications_failed_7d}
                  label="Failed messages"
                  href="/notifications?status=FAILED"
                  tone={k.notifications_failed_7d ? "warn" : "ok"}
                  hint="Check numbers / gateway"
                />
              </AlertGrid>
              <SectionTitle>New requests — last 14 days</SectionTitle>
              <MiniBars data={d.daily_tickets} dataKey="count" height={80} />
            </Card>

            <Card title="Open requests by category">
              <Breakdown items={d.by_category} labelKey="category" />
              <SectionTitle>By priority</SectionTitle>
              <Breakdown items={d.by_priority} labelKey="priority" />
            </Card>

            <Card title="Who is carrying the load">
              <RankedList
                items={d.workload}
                valueKey="count"
                labelKey="assigned_to__full_name"
                subKey={(r) => title(r.assigned_to__role)}
                empty="No open tickets are assigned."
              />
              <SectionTitle>All requests by status</SectionTitle>
              <Breakdown items={d.by_status} labelKey="status" />
            </Card>

            <Card title="Message delivery — last 7 days">
              {d.delivery.length ? (
                <ul className="divide-y divide-line/60 text-sm">
                  {d.delivery.map((x: any, i: number) => (
                    <li key={i} className="flex items-center justify-between py-1.5">
                      <span>
                        {title(x.channel)} <Badge value={x.status} className="ml-1" />
                      </span>
                      <b className="tabular-nums">{num(x.count)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-6 text-center text-sm text-slate">Nothing sent in the last week.</div>
              )}
              <SectionTitle>Newest customers</SectionTitle>
              <ul className="divide-y divide-line/60 text-sm">
                {d.recent_customers.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between py-1.5">
                    <Link href={`/customers/${c.id}`} className="text-river">
                      {c.household} <span className="text-xs text-slate">{c.customer_id}</span>
                    </Link>
                    <Badge value={c.status} />
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Quick actions" className="lg:col-span-3">
              <QuickActions
                actions={[
                  {
                    label: "New service request",
                    href: "/tickets",
                    icon: <Headset className="h-4 w-4" />,
                    description: "Leak, no water, meter fault, dispute",
                    primary: true,
                  },
                  {
                    label: "Register a customer",
                    href: "/customers",
                    icon: <UserPlus className="h-4 w-4" />,
                    description: "Household, business, institution",
                  },
                  {
                    label: "Message a customer",
                    href: "/notifications",
                    icon: <MessageSquare className="h-4 w-4" />,
                    description: "SMS / WhatsApp / portal",
                  },
                  {
                    label: "Broadcast",
                    href: "/notifications",
                    icon: <Users className="h-4 w-4" />,
                    description: "Outage or maintenance notice",
                  },
                  {
                    label: "Customer register",
                    href: "/customers",
                    icon: <Users className="h-4 w-4" />,
                    description: "Search, filter, export",
                  },
                  {
                    label: "Satisfaction",
                    href: "/tickets?status=RESOLVED",
                    icon: <Smile className="h-4 w-4" />,
                    description: "Ratings on resolved requests",
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
