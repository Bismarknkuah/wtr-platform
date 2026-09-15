"use client";
/**
 * Platform Operations Admin dashboard.
 *
 * Responsibilities: register and approve communities, create each community's first admin,
 * keep the registry tidy (suspend / reactivate). No access to any community's operations.
 */
import Link from "next/link";
import { Building2, CheckCircle2, ClipboardCheck, MapPin, UserPlus } from "lucide-react";
import { Badge, Button, Card, PageHeader, Spinner, Table } from "@/components/ui";
import { AlertGrid, AlertTile, Breakdown, KpiCard, KpiGrid, MiniBars, QuickActions, SectionTitle } from "@/components/dashboard/widgets";
import { date, num } from "@/lib/format";
import { PendingRegistrations, usePlatformData } from "@/components/dashboard/platform-shared";

export default function PlatformOpsDashboard() {
  const { d, err, reload } = usePlatformData();
  if (err) return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>;
  if (!d) return <Spinner />;
  const t = d.totals;
  return (
    <div>
      <PageHeader
        title="Onboarding & registry"
        subtitle="Register communities, approve them, hand each one to its admin. From then on the community runs itself."
        actions={
          <Link href="/communities">
            <Button>
              <Building2 className="h-4 w-4" />
              Register a community
            </Button>
          </Link>
        }
      />
      <KpiGrid cols={5}>
        <KpiCard
          label="Awaiting approval"
          value={num(t.pending_communities)}
          tone={t.pending_communities ? "river" : "ok"}
          icon={<ClipboardCheck className="h-4 w-4" />}
          href="/communities?service_status=PENDING"
        />
        <KpiCard
          label="Live without an admin"
          value={num(d.without_admin.length)}
          tone={d.without_admin.length ? "bad" : "ok"}
          sub="create their first login"
          icon={<UserPlus className="h-4 w-4" />}
          href="/users"
        />
        <KpiCard
          label="Live communities"
          value={num(t.active_communities)}
          sub={`${num(t.towns)} towns · ${num(t.households_served)} households`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          href="/communities"
        />
        <KpiCard
          label="Suspended"
          value={num(t.suspended_communities)}
          tone={t.suspended_communities ? "warn" : "ok"}
          href="/communities?service_status=SUSPENDED"
        />
        <KpiCard label="Regions covered" value={num(d.by_region.length)} icon={<MapPin className="h-4 w-4" />} />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Registrations awaiting approval (${d.pending.length})`} className="lg:col-span-2">
          <PendingRegistrations d={d} reload={reload} canApprove />
          <p className="mt-3 text-xs text-slate">
            Approval checklist: district and region correct · contact reachable · towns listed · water-system type right. After approving,
            create the community admin under Users &amp; roles and send them their login.
          </p>
        </Card>
        <Card title="Next steps">
          <AlertGrid>
            <AlertTile
              count={d.without_admin.length}
              label="Approved, no admin yet"
              href="/users"
              tone={d.without_admin.length ? "bad" : "ok"}
            />
            <AlertTile
              count={t.pending_communities}
              label="To review"
              href="/communities?service_status=PENDING"
              tone={t.pending_communities ? "river" : "ok"}
            />
          </AlertGrid>
          {d.without_admin.length > 0 && (
            <ul className="mt-3 divide-y divide-line/60 text-sm">
              {d.without_admin.map((c: any) => (
                <li key={c.id} className="flex items-center justify-between py-1.5">
                  <span>
                    <b className="text-ink">{c.name}</b> <span className="text-xs text-slate">approved {date(c.approved_at)}</span>
                  </span>
                  <Link href="/users" className="text-xs font-semibold text-river">
                    Create admin →
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <SectionTitle>Approved per month</SectionTitle>
          <MiniBars data={d.monthly_onboarding} dataKey="approved" xKey="month" height={80} />
        </Card>
        <Card title="Registry by region">
          <ul className="divide-y divide-line/60 text-sm">
            {d.by_region.map((r: any) => (
              <li key={r.region} className="flex items-center justify-between py-1.5">
                <span className="font-semibold text-ink">{r.region}</span>
                <span className="text-xs text-slate">
                  {num(r.communities)} communities · {num(r.customers)} households
                </span>
              </li>
            ))}
          </ul>
          <SectionTitle>By water system</SectionTitle>
          <Breakdown items={d.by_system} labelKey="water_system_type" />
        </Card>
        <Card title="Recently approved / changed" className="lg:col-span-2">
          <Table
            rows={d.recent}
            columns={[
              {
                key: "name",
                label: "Community",
                render: (r) => (
                  <Link href={`/communities/${r.id}`} className="font-semibold text-river">
                    {r.name}
                  </Link>
                ),
              },
              { key: "region", label: "Region" },
              { key: "approved_at", label: "Approved", render: (r) => (r.approved_at ? date(r.approved_at) : "—") },
              { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
            ]}
            empty={<div className="py-6 text-center text-sm text-slate">Nothing yet.</div>}
          />
        </Card>
        <Card title="Quick actions" className="lg:col-span-3">
          <QuickActions
            actions={[
              {
                label: "Register a community",
                href: "/communities",
                icon: <Building2 className="h-4 w-4" />,
                description: "District utility + contact + towns",
                primary: true,
              },
              {
                label: "Create a community admin",
                href: "/users",
                icon: <UserPlus className="h-4 w-4" />,
                description: "First login for a new community",
              },
              {
                label: "Community registry",
                href: "/communities",
                icon: <ClipboardCheck className="h-4 w-4" />,
                description: "Approve, suspend, reactivate",
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
