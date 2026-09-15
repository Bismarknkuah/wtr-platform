"use client";
/**
 * Community Finance Officer / Platform Finance Admin dashboard.
 *
 * Answers, in order: How is this month going? What is owed and how old is it? What needs my
 * signature? Who collected what through which channel? Which periods are open?
 *
 * Data: GET /api/dashboard/finance/ (see backend apps/analytics/role_dashboards.py::finance_dashboard)
 */
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  PiggyBank,
  Receipt,
  Undo2,
  Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, PageHeader, Table, Tabs, useToast } from "@/components/ui";
import { BilledVsCollected, Donut } from "@/components/charts";
import { useRoleDashboard } from "@/components/dashboard/shared";
import { EfficiencyTrend, StackedByMonth, WeekdayPattern } from "@/components/dashboard/analytics";
import {
  AlertGrid,
  AlertTile,
  Breakdown,
  KpiCard,
  KpiGrid,
  Legend,
  MiniArea,
  ProgressBar,
  QuickActions,
  RankedList,
  SectionTitle,
} from "@/components/dashboard/widgets";
import { date, datetime, ghs, num, pct, title } from "@/lib/format";

const LADDER_STAGES: { key: string; label: string }[] = [
  { key: "REMINDER", label: "Reminder" },
  { key: "SECOND_REMINDER", label: "2nd reminder" },
  { key: "FINAL_NOTICE", label: "Final notice" },
  { key: "DISCONNECTION_WARNING", label: "Disc. warning" },
  { key: "DISCONNECTION", label: "Disconnection" },
];

const AGING_LABELS: Record<string, string> = {
  current: "Not yet due",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  over_90: "Over 90 days",
};

export default function FinanceDashboard() {
  const { can } = useAuth();
  const { push } = useToast();
  const { data: d, picker, body, community, reload } = useRoleDashboard("/api/dashboard/finance/");
  const [tab, setTab] = useState<"payments" | "approvals" | "periods">("payments");
  const [busy, setBusy] = useState<string | null>(null);

  /** Approve / reject straight from the dashboard — the request executes on approval. */
  const decide = async (id: number, action: "approve" | "reject") => {
    const note = window.prompt(action === "approve" ? "Approval note (optional):" : "Reason for rejection:") ?? "";
    if (action === "reject" && !note) return;
    setBusy(`${action}-${id}`);
    try {
      const r = await api(`/api/approvals/${id}/${action}/`, { body: { note } });
      push(
        r.status === "EXECUTED"
          ? "Approved and executed"
          : r.status === "FAILED"
            ? `Approved but execution failed: ${r.execution_result?.error}`
            : "Rejected",
        r.status === "FAILED" ? "bad" : "ok",
      );
      reload();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(null);
    }
  };

  /** Mark bills past their due date as OVERDUE (also applies the late penalty configured for the community). */
  const refreshOverdue = async () => {
    setBusy("overdue");
    try {
      const r = await api("/api/bills/refresh_overdue/", { body: community ? { community } : {} });
      push(`${r.updated} bills marked overdue`);
      reload();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(null);
    }
  };

  const k = d?.kpis;
  const monthProgress = d ? Math.round((d.period.days_elapsed / d.period.days_in_month) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Finance dashboard"
        subtitle={d ? `${d.period.month} · day ${d.period.days_elapsed} of ${d.period.days_in_month}` : "Revenue, collections and debt."}
        actions={
          <>
            {picker}
            {can("RECORD_PAYMENT") && (
              <Link href="/payments">
                <Button>
                  <Banknote className="h-4 w-4" />
                  Record a payment
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
              label="Billed this month"
              value={ghs(k.billed)}
              delta={k.billed_change}
              icon={<FileText className="h-4 w-4" />}
              href="/bills"
            />
            <KpiCard
              label="Collected this month"
              value={ghs(k.collected)}
              delta={k.collected_change}
              tone="ok"
              icon={<Wallet className="h-4 w-4" />}
              href="/payments"
            />
            <KpiCard
              label="Collection efficiency"
              value={pct(k.collection_efficiency)}
              tone={
                k.collection_efficiency == null
                  ? "slate"
                  : k.collection_efficiency >= 80
                    ? "ok"
                    : k.collection_efficiency >= 60
                      ? "warn"
                      : "bad"
              }
              sub={k.collection_efficiency == null ? "no bills issued yet this month" : "collected ÷ billed"}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Collected today"
              value={ghs(k.today_collected)}
              tone="river"
              icon={<Banknote className="h-4 w-4" />}
              sub={`${d.daily_collections[d.daily_collections.length - 1]?.count ?? 0} payments`}
            />
            <KpiCard
              label="Total outstanding"
              value={ghs(k.outstanding)}
              tone={k.outstanding > 0 ? "warn" : "ok"}
              sub={`${num(k.debtors)} customers owe`}
              icon={<PiggyBank className="h-4 w-4" />}
              href="/debt"
            />
            <KpiCard
              label="Overdue"
              value={ghs(k.overdue_amount)}
              tone={k.overdue_bills ? "bad" : "ok"}
              sub={`${num(k.overdue_bills)} bills past due`}
              icon={<AlertTriangle className="h-4 w-4" />}
              href="/bills?status=OVERDUE"
            />
          </KpiGrid>

          {/* --------------------------------------------------- Month progress strip */}
          <Card className="mb-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <ProgressBar
                value={d.period.days_elapsed}
                max={d.period.days_in_month}
                label={`${d.period.month} progress`}
                detail={`${monthProgress}% of the month · ${d.period.days_in_month - d.period.days_elapsed} days left`}
                tone="river"
              />
              <div className="flex flex-wrap gap-4 text-xs text-slate">
                <span>
                  Adjustments <b className="text-ink">{ghs(k.adjustments_month)}</b>
                </span>
                <span>
                  Refunds <b className="text-ink">{ghs(k.refunds_month)}</b>
                </span>
                <span>
                  Reversals <b className="text-ink">{num(k.reversals_month)}</b>
                </span>
                <span>
                  Write-offs <b className="text-ink">{ghs(k.write_offs_month)}</b>
                </span>
                <span>
                  Customer credit held <b className="text-ink">{ghs(k.customer_credit)}</b>
                </span>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* ------------------------------------------------- Billed vs collected */}
            <Card title="Billed vs collected — last 6 months" className="lg:col-span-2">
              <BilledVsCollected data={d.trend} />
              <div className="mt-2 flex items-center justify-between">
                <Legend
                  items={[
                    { label: "Billed", color: "#1D6FA5" },
                    { label: "Collected", color: "#0F8B6E" },
                  ]}
                />
                <Link href="/reports" className="text-xs font-semibold text-river">
                  Full revenue report →
                </Link>
              </div>
            </Card>

            {/* ------------------------------------------------------ Attention */}
            <Card title="Needs your attention">
              <AlertGrid>
                <AlertTile
                  count={k.pending_approvals}
                  label="Approvals waiting"
                  href="/approvals?status=PENDING"
                  hint="Adjustments, refunds, write-offs, disconnections"
                />
                <AlertTile
                  count={k.overdue_bills}
                  label="Overdue bills"
                  href="/bills?status=OVERDUE"
                  tone={k.overdue_bills ? "bad" : "ok"}
                  hint={ghs(k.overdue_amount)}
                />
                <AlertTile
                  count={d.ladder.DISCONNECTION_WARNING + d.ladder.DISCONNECTION}
                  label="At disconnection stage"
                  href="/debt"
                  tone="bad"
                  hint="Warning issued or approval requested"
                />
                <AlertTile
                  count={d.periods.filter((p: any) => p.status === "OPEN").length}
                  label="Open billing periods"
                  href="/billing"
                  tone="river"
                  hint="Ready to generate"
                />
              </AlertGrid>
              {can("MANAGE_DEBT") && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={refreshOverdue} loading={busy === "overdue"}>
                    Refresh overdue status
                  </Button>
                  <Link href="/debt">
                    <Button size="sm" variant="secondary">
                      Run dunning
                    </Button>
                  </Link>
                </div>
              )}
            </Card>

            {/* --------------------------------------------------- Daily collections */}
            <Card title="Daily collections — last 30 days">
              <MiniArea data={d.daily_collections} dataKey="total" height={120} formatter={(v) => ghs(v)} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">{ghs(d.daily_collections.reduce((a: number, b: any) => a + b.total, 0))}</div>
                  <div className="text-slate">30-day total</div>
                </div>
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">{num(d.daily_collections.reduce((a: number, b: any) => a + b.count, 0))}</div>
                  <div className="text-slate">payments</div>
                </div>
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">{ghs(Math.max(...d.daily_collections.map((x: any) => x.total)))}</div>
                  <div className="text-slate">best day</div>
                </div>
              </div>
            </Card>

            {/* -------------------------------------------------------- Aging */}
            <Card
              title="Debt aging"
              action={
                <Link href="/debt" className="text-xs font-semibold text-river">
                  Debt management →
                </Link>
              }
            >
              <div className="mb-3 text-2xl font-extrabold text-ink">{ghs(d.aging.total)}</div>
              <ul className="space-y-2">
                {Object.entries(d.aging.buckets).map(([key, amount]: any) => {
                  const share = d.aging.total ? Math.round((amount / d.aging.total) * 100) : 0;
                  const tone = key === "current" ? "ok" : key === "over_90" || key === "61_90" ? "bad" : "warn";
                  return (
                    <li key={key}>
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">{AGING_LABELS[key]}</span>
                        <span className="text-slate">
                          {ghs(amount)} · {d.aging.counts[key]} bills
                        </span>
                      </div>
                      <ProgressBar value={share} tone={tone as any} />
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* ------------------------------------------------------ Ladder */}
            <Card title="Dunning ladder">
              <p className="mb-3 text-xs text-slate">
                Where each debtor currently sits. Disconnection is only ever executed after approval.
              </p>
              <ol className="space-y-2">
                {LADDER_STAGES.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-3">
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${i >= 3 ? "bg-bad/10 text-bad" : i >= 1 ? "bg-warn/10 text-warn" : "bg-river-soft text-river"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-ink">{s.label}</span>
                    <span className="text-lg font-extrabold tabular-nums text-ink">{num(d.ladder[s.key])}</span>
                  </li>
                ))}
              </ol>
              <SectionTitle>Bill status this month</SectionTitle>
              <Breakdown items={d.bill_status_mix} labelKey="status" amountKey="amount" formatAmount={(v) => ghs(v)} />
            </Card>

            {/* ------------------------------------------------------ Channels */}
            <Card title="Payment channels this month">
              {d.by_method.length ? (
                <>
                  <Donut
                    data={d.by_method.map((p: any) => ({ name: title(p.method), value: Number(p.total) }))}
                    nameKey="name"
                    valueKey="value"
                  />
                  <ul className="mt-2 divide-y divide-line/60 text-sm">
                    {d.by_method.map((p: any) => (
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
                <div className="py-10 text-center text-sm text-slate">No payments recorded this month.</div>
              )}
            </Card>

            {/* ---------------------------------------------------- Top debtors */}
            <Card
              title="Largest debtors"
              action={
                <Link href="/customers?risk_level=HIGH" className="text-xs font-semibold text-river">
                  High-risk customers →
                </Link>
              }
            >
              <RankedList
                items={d.top_debtors}
                valueKey="outstanding"
                labelKey="household"
                subKey={(r) => `${r.customer_id} · ${title(r.category)}`}
                format={(v) => ghs(v)}
                href={(r) => `/customers/${r.id}`}
                tone="bad"
                empty="Nobody owes anything. 🎉"
              />
            </Card>

            {/* -------------------------------------------------- Billed by category */}
            <Card title="Billed by customer type">
              <RankedList
                items={d.by_category}
                valueKey="billed"
                labelKey={(r) => title(r.customer__category)}
                subKey={(r) => `${r.bills} bills`}
                format={(v) => ghs(v)}
                empty="Nothing billed this month yet."
              />
              <SectionTitle>Collected by staff member</SectionTitle>
              <RankedList
                items={d.collectors}
                valueKey="total"
                labelKey="recorded_by__full_name"
                subKey={(r) => `${r.count} payments`}
                format={(v) => ghs(v)}
                tone="ok"
                empty="No staff-recorded payments this month."
              />
            </Card>

            {/* ------------------------------------------------------ Tables */}
            <Card className="lg:col-span-3">
              <Tabs
                tabs={[
                  { key: "payments", label: "Recent payments" },
                  { key: "approvals", label: `Approvals waiting (${d.pending_approvals.length})` },
                  { key: "periods", label: "Billing periods" },
                ]}
                value={tab}
                onChange={(v) => setTab(v as any)}
              />
              {tab === "payments" && (
                <Table
                  rows={d.recent_payments}
                  columns={[
                    { key: "reference", label: "Reference", render: (r) => <b>{r.reference}</b> },
                    { key: "paid_at", label: "Paid", render: (r) => datetime(r.paid_at) },
                    {
                      key: "customer_name",
                      label: "Customer",
                      render: (r) => (
                        <Link href={`/customers/${r.customer}`} className="text-river">
                          {r.customer_name}
                          <div className="text-xs text-slate">{r.customer_code}</div>
                        </Link>
                      ),
                    },
                    { key: "amount", label: "Amount", render: (r) => <b>{ghs(r.amount)}</b> },
                    { key: "method", label: "Channel", render: (r) => `${title(r.method)}${r.provider ? ` · ${r.provider}` : ""}` },
                    { key: "recorded_by", label: "By" },
                  ]}
                  empty={<div className="py-6 text-center text-sm text-slate">No payments yet.</div>}
                />
              )}
              {tab === "approvals" && (
                <Table
                  rows={d.pending_approvals}
                  columns={[
                    { key: "request_type", label: "Request", render: (r) => <Badge value={r.request_type} /> },
                    { key: "target_label", label: "Concerns" },
                    {
                      key: "payload",
                      label: "Details",
                      render: (r) => (
                        <code className="text-xs">
                          {Object.entries(r.payload || {})
                            .map(([k2, v]) => `${k2}=${v}`)
                            .join(" ")}
                        </code>
                      ),
                    },
                    { key: "reason", label: "Reason", render: (r) => <span className="text-xs">{r.reason}</span> },
                    {
                      key: "requested_by_name",
                      label: "Requested by",
                      render: (r) => (
                        <span>
                          {r.requested_by_name}
                          <div className="text-xs text-slate">{datetime(r.created_at)}</div>
                        </span>
                      ),
                    },
                    {
                      key: "__a",
                      label: "",
                      className: "text-right",
                      render: (r) =>
                        can("APPROVE_REQUESTS") ? (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ok" loading={busy === `approve-${r.id}`} onClick={() => decide(r.id, "approve")}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="!text-bad"
                              loading={busy === `reject-${r.id}`}
                              onClick={() => decide(r.id, "reject")}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : null,
                    },
                  ]}
                  empty={<div className="py-6 text-center text-sm text-slate">Nothing waiting for a decision.</div>}
                />
              )}
              {tab === "periods" && (
                <Table
                  rows={d.periods}
                  columns={[
                    { key: "name", label: "Period", render: (r) => <b>{r.name}</b> },
                    { key: "frequency", label: "Frequency", render: (r) => <Badge value={r.frequency} /> },
                    { key: "start_date", label: "Covers", render: (r) => `${date(r.start_date)} – ${date(r.end_date)}` },
                    { key: "due_date", label: "Due", render: (r) => date(r.due_date) },
                    { key: "bills_count", label: "Bills", render: (r) => num(r.bills_count) },
                    { key: "total_billed", label: "Total billed", render: (r) => ghs(r.total_billed) },
                    { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
                    {
                      key: "__a",
                      label: "",
                      className: "text-right",
                      render: (r) =>
                        r.status === "OPEN" && can("CREATE_BILL") ? (
                          <Link href="/billing" className="inline-flex items-center gap-1 text-xs font-semibold text-river">
                            Generate bills <ArrowRight className="h-3 w-3" />
                          </Link>
                        ) : null,
                    },
                  ]}
                  empty={<div className="py-6 text-center text-sm text-slate">No billing periods yet. Create one to start billing.</div>}
                />
              )}
            </Card>

            {/* ---------------------------------------------------- Analytics */}
            <Card title="Analytics — collection efficiency by month" className="lg:col-span-2">
              <EfficiencyTrend trend={d.trend} />
              <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-4">
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">{ghs(d.analytics.avg_bill)}</div>
                  <div className="text-slate">average bill this month</div>
                </div>
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">
                    {d.analytics.avg_days_to_pay != null ? `${d.analytics.avg_days_to_pay} days` : "—"}
                  </div>
                  <div className="text-slate">average time to pay in full</div>
                </div>
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">{pct(d.trend[d.trend.length - 1]?.efficiency)}</div>
                  <div className="text-slate">this month so far</div>
                </div>
                <div className="rounded-md bg-wash p-2">
                  <div className="font-extrabold text-ink">{pct(d.trend[d.trend.length - 2]?.efficiency)}</div>
                  <div className="text-slate">last month</div>
                </div>
              </div>
            </Card>
            <Card title="Collections by day of week — last 90 days">
              <WeekdayPattern data={d.analytics.weekday_pattern} />
              <p className="mt-2 text-xs text-slate">Plan agent visits and office hours around the days money actually comes in.</p>
            </Card>
            <Card title="Revenue by customer type — 6 months" className="lg:col-span-2">
              <StackedByMonth data={d.analytics.category_trend} keys={d.analytics.categories} />
            </Card>
            <Card title="Collections by channel — 6 months">
              <StackedByMonth data={d.analytics.method_trend} keys={d.analytics.methods} />
              <Link href="/reports" className="mt-2 inline-block text-xs font-semibold text-river">
                Full reports & CSV export →
              </Link>
              {can("VIEW_ANALYTICS") && (
                <Link href="/intelligence" className="ml-3 inline-block text-xs font-semibold text-river">
                  Ask water intelligence →
                </Link>
              )}
            </Card>

            {/* ------------------------------------------------- Quick actions */}
            <Card title="Quick actions" className="lg:col-span-3">
              <QuickActions
                actions={[
                  {
                    label: "Record a payment",
                    href: "/payments",
                    icon: <Banknote className="h-4 w-4" />,
                    description: "MoMo, bank, cash, agent, USSD",
                    primary: true,
                  },
                  {
                    label: "Billing periods",
                    href: "/billing",
                    icon: <CalendarClock className="h-4 w-4" />,
                    description: "Create and generate bills",
                  },
                  { label: "Bills", href: "/bills", icon: <FileText className="h-4 w-4" />, description: "Search, adjust, cancel" },
                  {
                    label: "Receipts & ledger",
                    href: "/payments",
                    icon: <Receipt className="h-4 w-4" />,
                    description: "Every transaction, append-only",
                  },
                  {
                    label: "Debt management",
                    href: "/debt",
                    icon: <Landmark className="h-4 w-4" />,
                    description: "Aging, dunning, write-offs",
                  },
                  {
                    label: "Approvals",
                    href: "/approvals",
                    icon: <ClipboardList className="h-4 w-4" />,
                    description: "Adjustments, refunds, disconnections",
                  },
                  {
                    label: "Reversals & refunds",
                    href: "/payments?status=REVERSED",
                    icon: <Undo2 className="h-4 w-4" />,
                    description: "Audit-trailed corrections",
                  },
                  {
                    label: "Financial reports",
                    href: "/reports",
                    icon: <FileText className="h-4 w-4" />,
                    description: "Revenue by period, CSV export",
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
