"use client";
/**
 * Auditor dashboard (read-only).
 *
 * What an auditor wants first: is anything unusual happening? Who is doing what? Every
 * financially sensitive action (adjustments, refunds, reversals, write-offs) in one list, the
 * approvals pipeline, and a live activity feed — read-only, inside the auditor's own community.
 *
 * Data: GET /api/dashboard/auditor/ (backend role_dashboards.py::auditor_dashboard)
 */
import Link from "next/link";
import { useState } from "react";
import { Activity, ClipboardCheck, Eye, FileWarning, KeyRound, Moon, ShieldAlert, Trash2 } from "lucide-react";
import { Badge, Card, PageHeader, Table, Tabs } from "@/components/ui";
import { useRoleDashboard } from "@/components/dashboard/shared";
import {
  ActivityFeed,
  AlertGrid,
  AlertTile,
  Breakdown,
  KpiCard,
  KpiGrid,
  MiniBars,
  RankedList,
  SectionTitle,
} from "@/components/dashboard/widgets";
import { datetime, ghs, num, title } from "@/lib/format";

const KIND_TONE: Record<string, string> = {
  ADJUSTMENT: "!bg-river-soft !text-river",
  REFUND: "!bg-warn/10 !text-warn",
  REVERSAL: "!bg-bad/10 !text-bad",
  WRITE_OFF: "!bg-bad/10 !text-bad",
};

export default function AuditorDashboard() {
  const { data: d, picker, body } = useRoleDashboard("/api/dashboard/auditor/");
  const [tab, setTab] = useState<"sensitive" | "feed">("sensitive");
  const k = d?.kpis;

  return (
    <div>
      <PageHeader
        title="Audit & compliance"
        subtitle={d ? `${d.scope} · every change is logged with who, what, when and why. Read-only.` : "Read-only view."}
        actions={picker}
      />
      {body}

      {d && (
        <>
          <KpiGrid cols={6}>
            <KpiCard
              label="Events (30 days)"
              value={num(k.events_30d)}
              sub={`${num(k.events_today)} today · ${num(k.actors_30d)} people active`}
              icon={<Activity className="h-4 w-4" />}
              href="/audit"
            />
            <KpiCard
              label="Sign-ins (30 days)"
              value={num(k.logins_30d)}
              icon={<KeyRound className="h-4 w-4" />}
              href="/audit?action=LOGIN"
            />
            <KpiCard
              label="Deletions (30 days)"
              value={num(k.deletes_30d)}
              tone={k.deletes_30d ? "warn" : "ok"}
              sub="hard deletes are rare by design"
              icon={<Trash2 className="h-4 w-4" />}
              href="/audit?action=DELETE"
            />
            <KpiCard
              label="After-hours activity"
              value={num(k.after_hours_30d)}
              tone={k.after_hours_30d ? "warn" : "ok"}
              sub="between 21:00 and 06:00"
              icon={<Moon className="h-4 w-4" />}
            />
            <KpiCard
              label="Approvals pending"
              value={num(k.approvals_pending)}
              tone={k.approvals_pending ? "warn" : "ok"}
              sub={`${num(k.approvals_executed_30d)} executed · ${num(k.approvals_rejected_30d)} rejected (30 d)`}
              icon={<ClipboardCheck className="h-4 w-4" />}
              href="/approvals"
            />
            <KpiCard
              label="Self-reviewed approvals"
              value={num(k.self_reviewed)}
              tone={k.self_reviewed ? "bad" : "ok"}
              sub="should always be zero"
              icon={<ShieldAlert className="h-4 w-4" />}
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Financial corrections — last 30 days" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Bill adjustments", ghs(k.adjustments_30d), "net amount"],
                  ["Refunds", ghs(k.refunds_30d), "paid back"],
                  ["Payment reversals", num(k.reversals_30d), "payments undone"],
                  ["Debt written off", ghs(k.write_offs_30d), "approved write-offs"],
                ].map(([label, value, sub]) => (
                  <div key={label as string} className="rounded-md bg-wash p-3">
                    <div className="text-xs text-slate">{label}</div>
                    <div className="text-xl font-extrabold text-ink">{value}</div>
                    <div className="text-[11px] text-slate-light">{sub}</div>
                  </div>
                ))}
              </div>
              <SectionTitle>Daily event volume — last 30 days</SectionTitle>
              <MiniBars data={d.daily} dataKey="count" height={100} color="#10243A" />
            </Card>

            <Card title="Watch-list">
              <AlertGrid>
                <AlertTile
                  count={k.approvals_failed}
                  label="Approvals that failed to execute"
                  href="/approvals?status=FAILED"
                  tone={k.approvals_failed ? "bad" : "ok"}
                  hint="Approved, but the action errored"
                />
                <AlertTile
                  count={k.self_reviewed}
                  label="Self-approved requests"
                  href="/approvals"
                  tone={k.self_reviewed ? "bad" : "ok"}
                  hint="Segregation-of-duties breach"
                />
                <AlertTile count={k.deletes_30d} label="Records deleted" href="/audit?action=DELETE" tone={k.deletes_30d ? "warn" : "ok"} />
                <AlertTile
                  count={k.reversals_30d}
                  label="Payment reversals"
                  href="/payments?status=REVERSED"
                  tone={k.reversals_30d ? "warn" : "ok"}
                />
              </AlertGrid>
            </Card>

            <Card title="Activity by action">
              <Breakdown items={d.by_action} labelKey="action" />
            </Card>

            <Card title="Most active people">
              <RankedList
                items={d.by_actor}
                valueKey="count"
                labelKey="actor__full_name"
                subKey={(r) => title(r.actor__role)}
                tone="ink"
                empty="No user activity in the period."
              />
            </Card>

            <Card title="Most touched records">
              <RankedList items={d.by_model} valueKey="count" labelKey="model_name" tone="slate" />
              <SectionTitle>Approvals by type</SectionTitle>
              <Breakdown items={d.approvals_by_type} labelKey="request_type" />
            </Card>

            <Card className="lg:col-span-3">
              <Tabs
                tabs={[
                  { key: "sensitive", label: `Sensitive financial actions (${d.sensitive.length})` },
                  { key: "feed", label: "Live activity" },
                ]}
                value={tab}
                onChange={(v) => setTab(v as any)}
              />
              {tab === "sensitive" && (
                <Table
                  rows={d.sensitive.map((s: any, i: number) => ({ id: i, ...s }))}
                  columns={[
                    { key: "when", label: "When", render: (r) => <span className="text-xs">{datetime(r.when)}</span> },
                    { key: "kind", label: "Action", render: (r) => <Badge value={r.kind} className={KIND_TONE[r.kind]} /> },
                    { key: "label", label: "Record", render: (r) => <b>{r.label}</b> },
                    { key: "amount", label: "Amount", render: (r) => <span className="font-bold tabular-nums">{ghs(r.amount)}</span> },
                    { key: "who", label: "By", render: (r) => r.who || <span className="text-slate">system / approval</span> },
                    { key: "reason", label: "Reason", render: (r) => <span className="text-xs">{r.reason}</span> },
                    { key: "community", label: "Community" },
                  ]}
                  empty={
                    <div className="py-8 text-center text-sm text-slate">No adjustments, refunds, reversals or write-offs recorded.</div>
                  }
                />
              )}
              {tab === "feed" && (
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <ActivityFeed items={d.recent} />
                  <div className="lg:w-56">
                    <SectionTitle>Approvals by status</SectionTitle>
                    <Breakdown items={d.approvals_by_status} labelKey="status" />
                    <Link href="/audit" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-river">
                      <Eye className="h-3.5 w-3.5" /> Full audit trail
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            <div className="rounded-lg border border-dashed border-line p-4 text-xs text-slate lg:col-span-3">
              <FileWarning className="mr-1 inline h-4 w-4 text-slate-light" />
              Auditor accounts are read-only: this dashboard, the audit trail, approvals, bills, payments and the ledger are all visible,
              but no action buttons are offered anywhere in the app.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
