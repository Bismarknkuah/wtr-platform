"use client";
/**
 * Technician dashboard.
 *
 * A work list for someone with tools in a van: my tickets by priority, unassigned field jobs I
 * can pick up, the maintenance calendar (overdue first), live outages, faulty meters and open
 * emergencies — plus a log of what I've done and what it cost this month.
 *
 * Data: GET /api/dashboard/technician/ (backend role_dashboards.py::technician_dashboard)
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, Gauge, Hammer, Siren, Timer, Wrench, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, PageHeader, Spinner, Table, Tabs, useToast } from "@/components/ui";
import { AlertGrid, AlertTile, Breakdown, DueList, KpiCard, KpiGrid, QuickActions, Timeline } from "@/components/dashboard/widgets";
import { date, datetime, ghs, num, title } from "@/lib/format";

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function ageLabel(hours: number | null) {
  if (hours == null) return "";
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export default function TechnicianDashboard() {
  const { user, can } = useAuth();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"mine" | "unassigned" | "done">("mine");

  const load = useCallback(() => {
    api("/api/dashboard/technician/")
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  /** Take an unassigned field ticket. */
  const claim = async (t: any) => {
    setBusy(`claim-${t.id}`);
    try {
      await api(`/api/tickets/${t.id}/assign/`, { body: { assigned_to: user?.id, priority: t.priority } });
      push(`${t.ticket_number} is now yours`);
      load();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(null);
    }
  };

  /** Move one of my tickets forward. */
  const transition = async (t: any, status: string) => {
    const resolution = status === "RESOLVED" ? window.prompt("What was done?") : "";
    if (status === "RESOLVED" && resolution === null) return;
    setBusy(`${status}-${t.id}`);
    try {
      await api(`/api/tickets/${t.id}/transition/`, { body: { status, resolution } });
      push(`${t.ticket_number} marked ${title(status)}`);
      load();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>;
  if (!d) return <Spinner />;

  const k = d.kpis;
  const mine = [...d.my_tickets].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const ticketColumns = (mode: "mine" | "unassigned") => [
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
      label: "Job",
      render: (r: any) => (
        <div>
          <div className="font-semibold text-ink">{r.title}</div>
          <div className="text-xs text-slate">
            {title(r.category)}
            {r.location ? ` · ${r.location}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "customer_name",
      label: "Customer",
      render: (r: any) =>
        r.customer_name ? (
          <div>
            {r.customer_name}
            <div className="text-xs text-slate">{r.customer_phone}</div>
          </div>
        ) : (
          "—"
        ),
    },
    { key: "priority", label: "Priority", render: (r: any) => <Badge value={r.priority} /> },
    {
      key: "age_hours",
      label: "Age",
      render: (r: any) => (
        <span className={r.priority === "URGENT" && r.age_hours > 4 ? "font-bold text-bad" : ""}>{ageLabel(r.age_hours)}</span>
      ),
    },
    { key: "status", label: "Status", render: (r: any) => <Badge value={r.status} /> },
    {
      key: "__a",
      label: "",
      className: "text-right",
      render: (r: any) => (
        <div className="flex justify-end gap-1">
          {mode === "unassigned" ? (
            <Button size="sm" loading={busy === `claim-${r.id}`} onClick={() => claim(r)}>
              Take this job
            </Button>
          ) : (
            <>
              {["OPEN", "ASSIGNED"].includes(r.status) && (
                <Button size="sm" variant="secondary" loading={busy === `IN_PROGRESS-${r.id}`} onClick={() => transition(r, "IN_PROGRESS")}>
                  Start
                </Button>
              )}
              {r.status === "IN_PROGRESS" && (
                <Button size="sm" variant="ok" loading={busy === `RESOLVED-${r.id}`} onClick={() => transition(r, "RESOLVED")}>
                  Resolve
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Field work"
        subtitle={`${d.technician.community} · what needs your hands today`}
        actions={
          <Link href="/maintenance">
            <Button>
              <Wrench className="h-4 w-4" />
              Log maintenance
            </Button>
          </Link>
        }
      />

      <KpiGrid cols={6}>
        <KpiCard
          label="My open jobs"
          value={num(k.my_open_tickets)}
          tone={k.my_open_tickets ? "warn" : "ok"}
          sub={`${num(k.my_urgent)} urgent or high`}
          icon={<ClipboardList className="h-4 w-4" />}
          href={`/tickets?assigned_to=${user?.id}`}
        />
        <KpiCard
          label="Unassigned field jobs"
          value={num(k.unassigned_field_tickets)}
          tone={k.unassigned_field_tickets ? "river" : "ok"}
          sub="you can take these"
          icon={<Hammer className="h-4 w-4" />}
        />
        <KpiCard
          label="Maintenance overdue"
          value={num(k.maintenance_overdue)}
          tone={k.maintenance_overdue ? "bad" : "ok"}
          sub={`${num(k.maintenance_due_14d)} due within 14 days`}
          icon={<Timer className="h-4 w-4" />}
          href="/maintenance"
        />
        <KpiCard
          label="Resolved (30 days)"
          value={num(k.resolved_30d)}
          tone="ok"
          sub={k.avg_resolution_hours != null ? `avg ${k.avg_resolution_hours} h to resolve` : "no resolutions yet"}
        />
        <KpiCard
          label="Jobs this month"
          value={num(k.jobs_this_month)}
          sub={`${ghs(k.cost_this_month)} in parts & labour`}
          icon={<Wrench className="h-4 w-4" />}
        />
        <KpiCard
          label="Active outages"
          value={num(k.active_outages)}
          tone={k.active_outages ? "bad" : "ok"}
          sub={`${num(k.open_emergencies)} emergencies · ${num(k.faulty_meters)} faulty meters`}
          icon={<Zap className="h-4 w-4" />}
          href="/outages"
        />
      </KpiGrid>

      {(k.open_emergencies > 0 || k.active_outages > 0) && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {d.emergencies.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg border-l-4 border-bad bg-bad/5 p-3">
              <Siren className="h-5 w-5 shrink-0 text-bad" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink">{e.title}</div>
                <div className="text-xs text-slate">
                  {title(e.emergency_type)} · <Badge value={e.severity} /> · declared {datetime(e.declared_at)}
                </div>
              </div>
              <Link href="/emergencies" className="text-xs font-semibold text-river">
                Respond →
              </Link>
            </div>
          ))}
          {d.outages
            .filter((o: any) => o.status === "ACTIVE")
            .map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 rounded-lg border-l-4 border-warn bg-warn/5 p-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-ink">Outage · {o.affected_area || "whole community"}</div>
                  <div className="text-xs text-slate">
                    {o.cause}
                    {o.asset_name ? ` · ${o.asset_name}` : ""} · {o.duration_hours} h so far
                  </div>
                </div>
                <Link href="/outages" className="text-xs font-semibold text-river">
                  Restore →
                </Link>
              </div>
            ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* -------------------------------------------------------- Tickets */}
        <Card className="lg:col-span-2">
          <Tabs
            tabs={[
              { key: "mine", label: `Assigned to me (${mine.length})` },
              { key: "unassigned", label: `Unassigned field jobs (${d.unassigned.length})` },
              { key: "done", label: "Recent work" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as any)}
          />
          {tab === "mine" && (
            <Table
              rows={mine}
              columns={ticketColumns("mine")}
              empty={
                <div className="py-8 text-center text-sm text-slate">Nothing assigned to you right now. Check the unassigned tab.</div>
              }
            />
          )}
          {tab === "unassigned" && (
            <Table
              rows={d.unassigned}
              columns={ticketColumns("unassigned")}
              empty={<div className="py-8 text-center text-sm text-slate">No unassigned field jobs.</div>}
            />
          )}
          {tab === "done" && (
            <Table
              rows={d.my_recent_maintenance}
              columns={[
                { key: "performed_on", label: "Date", render: (r) => date(r.performed_on) },
                {
                  key: "asset_name",
                  label: "Asset",
                  render: (r) => (
                    <div>
                      <b>{r.asset_name}</b>
                      <div className="text-xs text-slate">{r.asset_code}</div>
                    </div>
                  ),
                },
                { key: "maintenance_type", label: "Type", render: (r) => <Badge value={r.maintenance_type} /> },
                { key: "description", label: "Work", render: (r) => <span className="text-xs">{r.description}</span> },
                { key: "cost", label: "Cost", render: (r) => ghs(r.cost) },
                { key: "downtime_hours", label: "Downtime", render: (r) => `${r.downtime_hours} h` },
                {
                  key: "was_failure",
                  label: "",
                  render: (r) => (r.was_failure ? <Badge value="FAILURE" className="!bg-bad/10 !text-bad" /> : null),
                },
              ]}
              empty={<div className="py-8 text-center text-sm text-slate">No maintenance logged by you yet.</div>}
            />
          )}
        </Card>

        {/* ------------------------------------------------- Maintenance */}
        <Card
          title="Maintenance calendar"
          action={
            <Link href="/infrastructure" className="text-xs font-semibold text-river">
              All assets →
            </Link>
          }
        >
          <DueList
            items={[...d.maintenance_overdue, ...d.maintenance_due].map((a: any) => ({
              id: a.id,
              name: a.name,
              sub: `${a.asset_id} · ${title(a.asset_type)}${a.last_maintenance ? ` · last ${date(a.last_maintenance)}` : ""}`,
              due_in_days: a.maintenance_due_in_days,
              status: a.status,
            }))}
            href={() => "/maintenance"}
            empty="Nothing overdue and nothing due in the next two weeks."
          />
          <div className="mt-3">
            <Breakdown items={d.assets_by_status} labelKey="status" />
          </div>
        </Card>

        {/* -------------------------------------------------------- Meters */}
        <Card
          title="Faulty & blocked meters"
          action={
            <Link href="/meters?status=FAULTY" className="text-xs font-semibold text-river">
              Meters →
            </Link>
          }
        >
          <Table
            rows={d.faulty_meters}
            columns={[
              {
                key: "meter_id",
                label: "Meter",
                render: (r) => (
                  <div>
                    <b>{r.meter_id}</b>
                    <div className="text-xs text-slate">SN {r.serial_number}</div>
                  </div>
                ),
              },
              { key: "customer_name", label: "Customer", render: (r) => r.customer_name || "—" },
              { key: "installation_location", label: "Where" },
              { key: "condition", label: "", render: (r) => <Badge value={r.condition} /> },
            ]}
            empty={<div className="py-6 text-center text-sm text-slate">No faulty meters.</div>}
          />
        </Card>

        {/* ------------------------------------------------------- Outages */}
        <Card title="Outage history">
          <Timeline
            items={d.outages.map((o: any) => ({
              id: o.id,
              when: o.started_at,
              title: o.affected_area || "Whole community",
              status: o.status,
              tone: o.status === "ACTIVE" ? "bad" : "ok",
              detail: `${o.cause}${o.asset_name ? ` · ${o.asset_name}` : ""} · ${o.duration_hours} h`,
              href: "/outages",
            }))}
            empty="No outages recorded."
          />
        </Card>

        {/* ------------------------------------------------ Quick actions */}
        <Card title="Quick actions">
          <div className="grid gap-2">
            <QuickActions
              actions={[
                {
                  label: "Log maintenance",
                  href: "/maintenance",
                  icon: <Wrench className="h-4 w-4" />,
                  description: "Preventive, corrective, inspection",
                  primary: true,
                },
                {
                  label: "Replace a meter",
                  href: "/meters",
                  icon: <Gauge className="h-4 w-4" />,
                  description: "Final & initial readings kept",
                },
                {
                  label: "Declare an outage",
                  href: "/outages",
                  icon: <Zap className="h-4 w-4" />,
                  description: "Notifies affected customers",
                },
                {
                  label: "All service requests",
                  href: "/tickets",
                  icon: <ClipboardList className="h-4 w-4" />,
                  description: "Community-wide queue",
                },
              ]}
            />
          </div>
          <div className="mt-3 text-xs text-slate">
            My tickets by status: {d.tickets_by_status.map((s: any) => `${title(s.status)} ${s.count}`).join(" · ") || "none yet"}
          </div>
        </Card>
      </div>
    </div>
  );
}
