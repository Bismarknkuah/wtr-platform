"use client";
/**
 * Platform Super Admin dashboard.
 *
 * Responsibilities: the community registry, approvals, subscription plans and the community
 * admin accounts. Nothing inside a community — that is the community's own officers' work.
 *
 * Data: GET /api/dashboard/platform/ and GET /api/dashboard/activity/ (platform-level events only)
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, ClipboardCheck, Layers, MapPin, ShieldAlert, UserPlus, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Badge, Button, Card, PageHeader, Spinner, Table, useToast } from "@/components/ui";
import {
  ActivityFeed,
  AlertGrid,
  AlertTile,
  Breakdown,
  KpiCard,
  KpiGrid,
  QuickActions,
  SectionTitle,
} from "@/components/dashboard/widgets";
import { date, ghs, num } from "@/lib/format";
import { PendingRegistrations, usePlatformData } from "@/components/dashboard/platform-shared";

export default function PlatformSuperAdminDashboard() {
  const { d, feed, err, reload } = usePlatformData();
  if (err) return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>;
  if (!d) return <Spinner />;
  const t = d.totals;

  return (
    <div>
      <PageHeader
        title="Platform administration"
        subtitle="Registry, approvals, subscription plans and community admins. Each community runs its own water system."
        actions={
          <Link href="/communities">
            <Button>
              <Building2 className="h-4 w-4" />
              Register a community
            </Button>
          </Link>
        }
      />

      <KpiGrid cols={6}>
        <KpiCard
          label="Communities"
          value={num(t.communities)}
          sub={`${num(t.active_communities)} live · ${num(t.suspended_communities)} suspended`}
          icon={<Building2 className="h-4 w-4" />}
          href="/communities"
        />
        <KpiCard
          label="Awaiting approval"
          value={num(t.pending_communities)}
          tone={t.pending_communities ? "river" : "ok"}
          sub="registrations to review"
          icon={<ClipboardCheck className="h-4 w-4" />}
          href="/communities?service_status=PENDING"
        />
        <KpiCard
          label="Live without an admin"
          value={num(d.without_admin.length)}
          tone={d.without_admin.length ? "bad" : "ok"}
          sub="create their first admin"
          icon={<UserPlus className="h-4 w-4" />}
          href="/users"
        />
        <KpiCard
          label="Towns served"
          value={num(t.towns)}
          sub={`${num(t.households_served)} households`}
          icon={<MapPin className="h-4 w-4" />}
        />
        <KpiCard
          label="On a subscription plan"
          value={num(t.active_communities - d.subscriptions.unassigned)}
          sub={`${num(d.subscriptions.unassigned)} live communities without a plan`}
          tone={d.subscriptions.unassigned ? "warn" : "ok"}
          icon={<Layers className="h-4 w-4" />}
          href="/plans"
        />
        <KpiCard
          label="Communities at risk"
          value={num(t.communities_at_risk)}
          tone={t.communities_at_risk ? "bad" : "ok"}
          sub="sustainability score < 50"
          icon={<ShieldAlert className="h-4 w-4" />}
          href="/benchmark"
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={`Registrations awaiting approval (${d.pending.length})`} className="lg:col-span-2">
          <PendingRegistrations d={d} reload={reload} canApprove />
        </Card>

        <Card title="Needs attention">
          <AlertGrid>
            <AlertTile
              count={d.without_admin.length}
              label="Live communities without an admin"
              href="/users"
              tone={d.without_admin.length ? "bad" : "ok"}
              hint="They cannot start until someone can log in"
            />
            <AlertTile
              count={d.subscriptions.unassigned}
              label="Live communities with no plan"
              href="/communities"
              tone={d.subscriptions.unassigned ? "warn" : "ok"}
            />
            <AlertTile
              count={d.subscriptions.over_limit.length}
              label="Over their plan's customer limit"
              href="/plans"
              tone={d.subscriptions.over_limit.length ? "warn" : "ok"}
            />
            <AlertTile
              count={t.suspended_communities}
              label="Suspended"
              href="/communities?service_status=SUSPENDED"
              tone={t.suspended_communities ? "warn" : "ok"}
            />
          </AlertGrid>
          {d.without_admin.length > 0 && (
            <>
              <SectionTitle>Create an admin for</SectionTitle>
              <ul className="divide-y divide-line/60 text-sm">
                {d.without_admin.map((c: any) => (
                  <li key={c.id} className="flex items-center justify-between py-1.5">
                    <span className="font-semibold text-ink">{c.name}</span>
                    <Link href="/users" className="text-xs font-semibold text-river">
                      Add admin →
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card
          title="Subscription plans"
          action={
            <Link href="/plans" className="text-xs font-semibold text-river">
              Manage plans →
            </Link>
          }
        >
          <Table
            rows={d.plans}
            columns={[
              { key: "name", label: "Plan", render: (r) => <b>{r.name}</b> },
              { key: "monthly_price", label: "Price / month", render: (r) => ghs(r.monthly_price) },
              { key: "communities", label: "Communities", render: (r) => `${r.active_communities} live` },
              { key: "max_customers", label: "Limits", render: (r) => `${num(r.max_customers)} customers · ${num(r.max_staff)} staff` },
            ]}
            empty={<div className="py-6 text-center text-sm text-slate">No plans yet.</div>}
          />
          <div className="mt-2 text-xs text-slate">
            Monthly recurring: <b className="text-ink">{ghs(d.subscriptions.monthly_recurring_revenue)}</b>
          </div>
        </Card>

        <Card title="Recently approved / changed">
          <ul className="divide-y divide-line/60 text-sm">
            {d.recent.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between py-1.5">
                <Link href={`/communities/${c.id}`} className="font-semibold text-river">
                  {c.name} <span className="text-xs font-normal text-slate">{c.region}</span>
                </Link>
                <span className="flex items-center gap-2 text-xs text-slate">
                  {c.approved_at ? date(c.approved_at) : ""}
                  <Badge value={c.status} />
                </span>
              </li>
            ))}
          </ul>
          <SectionTitle>Platform staff</SectionTitle>
          <Breakdown items={d.platform_staff.map((x: any) => ({ role: x.role, count: x.n }))} labelKey="role" countKey="count" />
        </Card>

        <Card title="Platform activity">
          <ActivityFeed items={feed} empty="No platform-level activity yet." />
        </Card>

        <Card title="Quick actions" className="lg:col-span-3">
          <QuickActions
            actions={[
              {
                label: "Register a community",
                href: "/communities",
                icon: <Building2 className="h-4 w-4" />,
                description: "District-level water system with its towns",
                primary: true,
              },
              {
                label: "Create a community admin",
                href: "/users",
                icon: <UserPlus className="h-4 w-4" />,
                description: "The first login for a newly approved community",
              },
              {
                label: "Subscription plans",
                href: "/plans",
                icon: <Layers className="h-4 w-4" />,
                description: "Pricing tiers and limits",
              },
              {
                label: "Community health",
                href: "/benchmark",
                icon: <ShieldAlert className="h-4 w-4" />,
                description: "Indicators only — no community data",
              },
              {
                label: "Platform staff",
                href: "/users",
                icon: <Users className="h-4 w-4" />,
                description: "Finance and operations admins",
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
