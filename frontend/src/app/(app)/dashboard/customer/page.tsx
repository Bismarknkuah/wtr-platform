"use client";
/**
 * Customer / household portal home.
 *
 * Designed for someone who checks it once a month on a phone: the amount due and a pay button
 * first; then usage, last payment, next billing date, meter details; recent bills; open service
 * requests; and the community's own notices. Everything else lives one tap away.
 *
 * Data: GET /api/dashboard/customer/, /api/tickets/, /api/notifications/mine/
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CreditCard, Droplets, FileText, Gauge, Headset, MessageSquare, UserCog } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, KV, PageHeader, Spinner, Table } from "@/components/ui";
import { ConsumptionLine } from "@/components/charts";
import { HeroBanner, KpiCard, KpiGrid, QuickActions, SectionTitle } from "@/components/dashboard/widgets";
import { date, datetime, ghs, m3, num, title } from "@/lib/format";

export default function CustomerHome() {
  const { user } = useAuth();
  const flags = user?.community_flags || {};
  const canPayOnline = flags.online_payments_enabled !== false;
  const canRequest = flags.customer_requests_enabled !== false;
  const showUsage = flags.show_usage_to_customers !== false;
  const [d, setD] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [notes, setNotes] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/dashboard/customer/")
      .then(setD)
      .catch((e) => setErr(e.message));
    api("/api/tickets/", { params: { page_size: 5, ordering: "-created_at" } })
      .then((r) => setTickets(r.results))
      .catch(() => setTickets([]));
    api("/api/notifications/mine/")
      .then(setNotes)
      .catch(() => setNotes({ results: [], unread: 0 }));
  }, []);

  if (err) return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>;
  if (!d) return <Spinner />;

  const s = d.summary;
  const c = d.customer;
  const owes = s.outstanding > 0;
  const credit = s.outstanding < 0;
  const overdue = owes && s.due_date && new Date(s.due_date) < new Date();
  const usage = d.consumption || [];
  const avg = usage.length ? usage.reduce((a: number, b: any) => a + Number(b.consumption), 0) / usage.length : 0;
  const lastUsage = usage.length ? Number(usage[usage.length - 1].consumption) : 0;

  return (
    <div>
      <PageHeader
        title={`Hello, ${(c.contact_person || user?.full_name || "").split(" ")[0]}`}
        subtitle={`${c.household_name} · ${c.customer_id} · ${c.community_name}`}
      />

      <HeroBanner
        eyebrow={owes ? (overdue ? "Overdue — please pay to avoid disconnection" : "Amount due") : "Account status"}
        headline={owes ? ghs(s.outstanding) : credit ? `${ghs(-s.outstanding)} credit` : "All paid up"}
        tone={overdue ? "bad" : owes ? "ink" : "ok"}
        detail={
          s.current_bill ? (
            <>
              Latest bill {ghs(s.current_bill)} · <Badge value={s.current_bill_status} className="!bg-white/20 !text-white" /> · due{" "}
              {date(s.due_date)}
            </>
          ) : (
            "No bill has been issued yet. You'll get an SMS when the first one is ready."
          )
        }
        actions={
          <>
            {owes && canPayOnline && (
              <Link href="/portal/pay">
                <Button size="lg" variant={overdue ? "primary" : "secondary"} className={overdue ? "" : "!bg-white !text-ink"}>
                  <CreditCard className="h-4 w-4" />
                  Pay {ghs(s.outstanding)}
                </Button>
              </Link>
            )}
            <Link href="/portal/bills">
              <Button size="lg" variant="ghost" className="!text-white hover:!bg-white/10">
                <FileText className="h-4 w-4" />
                View bills
              </Button>
            </Link>
          </>
        }
        aside={
          c.meter ? (
            <div className="rounded-md bg-white/10 p-3 text-sm">
              <div className="text-[11px] uppercase tracking-wide text-white/60">Your meter</div>
              <div className="font-extrabold">{c.meter.meter_id}</div>
              <div className="text-white/80">
                Reading {c.meter.current_reading} m³ · <Badge value={c.meter.status} className="!bg-white/20 !text-white" />
              </div>
            </div>
          ) : undefined
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Last consumption"
          value={m3(s.current_consumption_m3)}
          sub={avg ? `your average is ${avg.toFixed(1)} m³` : undefined}
          tone={avg && lastUsage > avg * 1.5 ? "warn" : "ink"}
          icon={<Droplets className="h-4 w-4" />}
        />
        <KpiCard
          label="Last payment"
          value={s.last_payment ? ghs(s.last_payment) : "—"}
          sub={s.last_payment_date ? date(s.last_payment_date) : "no payments yet"}
          tone="ok"
          icon={<CreditCard className="h-4 w-4" />}
          href="/portal/payments"
        />
        <KpiCard
          label="Next billing"
          value={s.next_billing_date ? date(s.next_billing_date) : "—"}
          sub={s.due_date ? `current bill due ${date(s.due_date)}` : undefined}
          icon={<FileText className="h-4 w-4" />}
        />
        <KpiCard
          label="Open requests"
          value={num(tickets.filter((t) => !["CLOSED", "CANCELLED"].includes(t.status)).length)}
          sub={notes ? `${notes.unread} unread notifications` : undefined}
          icon={<Headset className="h-4 w-4" />}
          href="/portal/requests"
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="My water use (m³ per reading)" className="lg:col-span-2">
          {!showUsage ? (
            <div className="py-10 text-center text-sm text-slate">
              Usage history is not shown in this community&apos;s portal. Ask the office for your consumption.
            </div>
          ) : usage.length ? (
            <>
              <ConsumptionLine data={usage} xKey="date" />
              {avg > 0 && lastUsage > avg * 1.5 && (
                <div className="mt-2 rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">
                  Your last reading was well above your usual usage. Check taps, toilets and pipes for leaks — or raise a request and a
                  technician will come.
                </div>
              )}
            </>
          ) : (
            <div className="py-10 text-center text-sm text-slate">Your usage history will appear after the first meter reading.</div>
          )}
        </Card>

        <Card title="Quick actions">
          <div className="grid gap-2">
            <QuickActions
              actions={[
                ...(canPayOnline
                  ? [
                      {
                        label: "Pay a bill",
                        href: "/portal/pay",
                        icon: <CreditCard className="h-4 w-4" />,
                        description: "MoMo, card, or see cash options",
                        primary: owes,
                      },
                    ]
                  : []),
                {
                  label: "Bills & statement",
                  href: "/portal/bills",
                  icon: <FileText className="h-4 w-4" />,
                  description: "Every bill and the full ledger",
                },
                ...(canRequest
                  ? [
                      {
                        label: "Report a leak or issue",
                        href: "/portal/requests",
                        icon: <Headset className="h-4 w-4" />,
                        description: "No water, meter fault, dispute",
                      },
                    ]
                  : []),
                {
                  label: "Notifications",
                  href: "/portal/notifications",
                  icon: <Bell className="h-4 w-4" />,
                  description: notes ? `${notes.unread} unread` : undefined,
                },
                {
                  label: "Update my details",
                  href: "/settings",
                  icon: <UserCog className="h-4 w-4" />,
                  description: "Name, phone, password",
                },
              ]}
            />
          </div>
          <SectionTitle>Account</SectionTitle>
          <KV
            items={[
              ["Category", title(c.category)],
              ["Status", <Badge value={c.account_status} />],
              ["Address", c.address || "—"],
              ["Phone", c.phone],
              ["Meter", c.meter?.meter_id || "not installed"],
            ]}
          />
        </Card>

        <Card
          title="Recent bills"
          className="lg:col-span-2"
          action={
            <Link href="/portal/bills" className="text-xs font-semibold text-river">
              All bills →
            </Link>
          }
        >
          <Table
            rows={d.bills}
            columns={[
              {
                key: "invoice_number",
                label: "Invoice",
                render: (r) => (
                  <Link href={`/portal/bills/${r.id}`} className="font-semibold text-river">
                    {r.invoice_number}
                  </Link>
                ),
              },
              { key: "period_name", label: "Period" },
              { key: "consumption", label: "Usage", render: (r) => m3(r.consumption) },
              { key: "total_amount", label: "Total", render: (r) => ghs(r.total_amount) },
              {
                key: "outstanding_amount",
                label: "Owing",
                render: (r) => (
                  <span className={Number(r.outstanding_amount) > 0 ? "font-bold text-bad" : ""}>{ghs(r.outstanding_amount)}</span>
                ),
              },
              { key: "due_date", label: "Due", render: (r) => date(r.due_date) },
              { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
            ]}
            empty={<div className="py-6 text-center text-sm text-slate">No bills yet.</div>}
          />
        </Card>

        <Card
          title="My requests"
          action={
            <Link href="/portal/requests" className="text-xs font-semibold text-river">
              New request →
            </Link>
          }
        >
          <ul className="divide-y divide-line/60 text-sm">
            {tickets.map((t) => (
              <li key={t.id} className="py-2">
                <Link href={`/tickets/${t.id}`} className="flex items-center justify-between gap-2 hover:text-river">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t.title}</span>
                    <span className="block text-xs text-slate">
                      {t.ticket_number} · {datetime(t.created_at)}
                    </span>
                  </span>
                  <Badge value={t.status} />
                </Link>
              </li>
            ))}
            {!tickets.length && <li className="py-6 text-center text-xs text-slate">You haven't raised any requests.</li>}
          </ul>
        </Card>

        <Card
          title="Notices from your community"
          className="lg:col-span-3"
          action={
            <Link href="/portal/notifications" className="text-xs font-semibold text-river">
              All notifications →
            </Link>
          }
        >
          {notes?.results?.length ? (
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {notes.results.slice(0, 6).map((n: any) => (
                <li key={n.id} className={`rounded-md border p-3 text-sm ${n.is_read ? "border-line" : "border-river bg-river-soft/40"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{n.title}</span>
                    <Badge value={n.event} />
                  </div>
                  <p className="mt-1 text-xs text-slate">{n.message}</p>
                  <div className="mt-1 text-[11px] text-slate-light">{datetime(n.created_at)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-6 text-center text-sm text-slate">
              <MessageSquare className="mx-auto mb-1 h-5 w-5 text-slate-light" />
              No notices yet. Bills, receipts, reminders and outage updates will appear here.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
