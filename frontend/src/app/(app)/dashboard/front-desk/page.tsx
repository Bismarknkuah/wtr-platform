"use client";
/**
 * Front Desk Collector dashboard — the cash window.
 *
 * Flow: type the meter number (or customer ID / phone) → the account card shows the household,
 * balance and every unpaid bill → enter the amount (defaults to the full balance) and the
 * channel → Record → the receipt appears and can be printed; the SMS goes out automatically.
 * Below: today's takings by channel, this week, the last receipts I issued.
 *
 * Data: GET /api/customers/account-lookup/?q=  ·  POST /api/payments/  ·  GET /api/dashboard/front-desk/
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle2, Printer, Receipt, Search, Smartphone, UserRound, Wallet, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, Table, useToast } from "@/components/ui";
import { KpiCard, KpiGrid, MiniArea, SectionTitle } from "@/components/dashboard/widgets";
import { date, datetime, ghs, num, title } from "@/lib/format";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_MONEY", label: "Mobile money (customer paid to office number)" },
  { value: "BANK", label: "Bank deposit / transfer slip" },
  { value: "MANUAL", label: "Other (cheque, voucher)" },
];

export default function FrontDeskDashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [acct, setAcct] = useState<any>(null);
  const [multiple, setMultiple] = useState<any[] | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [ref, setRef] = useState("");
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api("/api/dashboard/front-desk/")
      .then(setD)
      .catch((e) => push(e.message, "bad"));
  }, [push]);
  useEffect(() => {
    load();
    inputRef.current?.focus();
  }, [load]);

  /** Meter number / customer ID / phone → account. */
  const lookup = async (term?: string) => {
    const t = (term ?? q).trim();
    if (!t) return;
    setSearching(true);
    setLookupError("");
    setMultiple(null);
    setReceipt(null);
    try {
      const r = await api("/api/customers/account-lookup/", { params: { q: t } });
      if (r.multiple) {
        setAcct(null);
        setMultiple(r.multiple);
      } else {
        setAcct(r);
        setAmount(r.outstanding > 0 ? String(r.outstanding.toFixed(2)) : "");
        setPayer(r.customer.contact_person || "");
      }
    } catch (e: any) {
      setAcct(null);
      setLookupError(
        e.status === 404
          ? `No account matches "${t}". Check the meter number on the meter face or the customer ID on the bill.`
          : e.message,
      );
    } finally {
      setSearching(false);
    }
  };

  const clear = () => {
    setAcct(null);
    setMultiple(null);
    setReceipt(null);
    setQ("");
    setAmount("");
    setRef("");
    setLookupError("");
    inputRef.current?.focus();
  };

  const record = async (e: any) => {
    e.preventDefault();
    if (!acct) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return push("Enter the amount received", "bad");
    if (
      amt > acct.outstanding + 0.005 &&
      !window.confirm(
        `${ghs(amt)} is more than the ${ghs(acct.outstanding)} owed. The extra ${ghs(amt - acct.outstanding)} becomes credit on the account. Continue?`,
      )
    )
      return;
    setBusy(true);
    try {
      const p = await api("/api/payments/", {
        body: {
          customer: acct.customer.id,
          amount: amt.toFixed(2),
          method,
          provider_reference: ref,
          payer_name: payer,
          payer_phone: acct.customer.phone,
          notes: "Front desk",
        },
      });
      setReceipt({ ...p, household: acct.customer.household, customer_code: acct.customer.customer_id, before: acct.outstanding });
      push(`Payment recorded — receipt ${p.receipt_number || p.reference}`);
      load();
      // refresh the account so the balance shows the new position
      const r = await api("/api/customers/account-lookup/", { params: { q: acct.customer.customer_id } });
      setAcct(r);
      setAmount("");
      setRef("");
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };

  const printReceipt = () => {
    if (!receipt) return;
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt ${receipt.receipt_number || receipt.reference}</title>
      <style>body{font-family:ui-monospace,Menlo,monospace;font-size:13px;margin:0;padding:16px;width:300px;color:#000}h1{font-size:16px;margin:0}h2{font-size:12px;font-weight:normal;margin:0 0 10px;color:#444}
      table{width:100%;border-collapse:collapse}td{padding:3px 0}td:last-child{text-align:right}.tot td{border-top:1px dashed #000;font-weight:bold;padding-top:6px}.c{text-align:center}.f{margin-top:12px;font-size:11px;color:#444}</style></head><body>
      <div class="c"><h1>${user?.community_name || "WTR Ghana"}</h1><h2>OFFICIAL WATER PAYMENT RECEIPT</h2></div>
      <table>
      <tr><td>Receipt</td><td>${receipt.receipt_number || "—"}</td></tr>
      <tr><td>Payment ref</td><td>${receipt.reference}</td></tr>
      <tr><td>Date</td><td>${datetime(receipt.paid_at)}</td></tr>
      <tr><td>Customer</td><td>${receipt.household}</td></tr>
      <tr><td>Customer ID</td><td>${receipt.customer_code}</td></tr>
      <tr><td>Method</td><td>${title(receipt.method)}</td></tr>
      ${receipt.provider_reference ? `<tr><td>Ref</td><td>${receipt.provider_reference}</td></tr>` : ""}
      <tr><td>Balance before</td><td>${ghs(receipt.before)}</td></tr>
      <tr class="tot"><td>AMOUNT PAID</td><td>${ghs(receipt.amount)}</td></tr>
      <tr><td>Balance after</td><td>${ghs(Math.max(0, receipt.before - Number(receipt.amount)))}</td></tr>
      </table>
      <div class="f c">Received by ${user?.full_name}. Thank you for paying promptly.<br/>Keep this receipt. Queries: quote the receipt number.</div>
      <script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const k = d?.kpis;

  return (
    <div>
      <PageHeader title="Front desk" subtitle={`${user?.community_name} · take payments at the counter and issue receipts`} />

      {/* ---------------------------------------------------------------- Lookup */}
      <Card className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[260px] flex-1">
            <div className="mb-1 text-xs font-semibold text-slate">Meter number, customer ID or phone</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-light" />
              <Input
                ref={inputRef}
                className="!h-12 !pl-10 !text-lg font-bold uppercase tracking-wide"
                placeholder="e.g. ABO-1004 · CUS-GRE-000003 · 0244…"
                value={q}
                onChange={(e: any) => setQ(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
              />
            </div>
          </div>
          <Button type="submit" size="lg" loading={searching} disabled={!q.trim()}>
            Find account
          </Button>
          {(acct || multiple) && (
            <Button type="button" size="lg" variant="secondary" onClick={clear}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </form>
        {lookupError && <div className="mt-2 rounded bg-bad/10 px-3 py-2 text-sm text-bad">{lookupError}</div>}
        {multiple && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold text-slate">Several accounts match — pick one</div>
            <ul className="divide-y divide-line/60 rounded-md border border-line">
              {multiple.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => lookup(c.customer_id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-wash"
                  >
                    <span>
                      <b className="text-ink">{c.household}</b>{" "}
                      <span className="text-xs text-slate">
                        {c.customer_id} · {c.phone}
                        {c.meter ? ` · meter ${c.meter}` : ""}
                      </span>
                    </span>
                    <span className={`font-bold tabular-nums ${c.outstanding > 0 ? "text-bad" : "text-ok"}`}>{ghs(c.outstanding)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* ---------------------------------------------------------------- Account + payment */}
      {acct && (
        <div className="mb-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-lg font-extrabold text-ink">
                  <UserRound className="h-5 w-5 text-river" />
                  {acct.customer.household}
                  <Badge value={acct.customer.account_status} />
                </div>
                <div className="text-sm text-slate">
                  {acct.customer.customer_id} · {acct.customer.contact_person} · {acct.customer.phone}
                  {acct.customer.town ? ` · ${acct.customer.town}` : ""}
                </div>
                <div className="text-xs text-slate">
                  {acct.customer.address || "no address"} · {title(acct.customer.category)}
                  {acct.meter
                    ? ` · meter ${acct.meter.serial_number} (${acct.meter.meter_id}) reading ${acct.meter.current_reading}`
                    : " · no active meter"}
                </div>
              </div>
              <div className={`rounded-lg px-5 py-3 text-right ${acct.outstanding > 0 ? "bg-bad/10" : "bg-ok/10"}`}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate">
                  {acct.outstanding > 0 ? "Amount owed" : acct.credit > 0 ? "Credit on account" : "Balance"}
                </div>
                <div className={`text-3xl font-extrabold tabular-nums ${acct.outstanding > 0 ? "text-bad" : "text-ok"}`}>
                  {ghs(acct.outstanding > 0 ? acct.outstanding : acct.credit)}
                </div>
                {acct.overdue > 0 && <div className="text-xs text-bad">{ghs(acct.overdue)} overdue</div>}
              </div>
            </div>
            {acct.disconnection_warning && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-warn/10 px-3 py-2 text-sm text-warn">
                <AlertTriangle className="h-4 w-4" />
                This account is at the disconnection stage. Advise the customer to clear the balance today.
              </div>
            )}
            <SectionTitle>Unpaid bills</SectionTitle>
            <Table
              rows={acct.unpaid_bills}
              columns={[
                { key: "invoice_number", label: "Invoice", render: (r) => <b>{r.invoice_number}</b> },
                { key: "period_name", label: "Period" },
                {
                  key: "due_date",
                  label: "Due",
                  render: (r) => (
                    <span className={r.days_overdue > 0 ? "text-bad" : ""}>
                      {date(r.due_date)}
                      {r.days_overdue > 0 ? ` · ${r.days_overdue}d late` : ""}
                    </span>
                  ),
                },
                { key: "total_amount", label: "Total", render: (r) => ghs(r.total_amount) },
                { key: "amount_paid", label: "Paid", render: (r) => ghs(r.amount_paid) },
                { key: "outstanding_amount", label: "Owing", render: (r) => <b className="text-bad">{ghs(r.outstanding_amount)}</b> },
                { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
              ]}
              empty={<div className="py-4 text-center text-sm text-ok">Nothing owed — the account is fully paid.</div>}
            />
            {acct.recent_payments.length > 0 && (
              <>
                <SectionTitle>Last payments</SectionTitle>
                <ul className="divide-y divide-line/60 text-sm">
                  {acct.recent_payments.map((p: any) => (
                    <li key={p.id} className="flex justify-between py-1">
                      <span className="text-slate">
                        {datetime(p.paid_at)} · {title(p.method)} · {p.reference}
                      </span>
                      <b>{ghs(p.amount)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card title={receipt ? "Receipt issued" : "Take payment"}>
            {receipt ? (
              <div className="text-center">
                <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-ok" />
                <div className="text-2xl font-extrabold text-ink">{ghs(receipt.amount)}</div>
                <div className="text-sm text-slate">
                  received from {receipt.household} by {title(receipt.method)}
                </div>
                <div className="mt-3 rounded-md bg-wash p-3 text-left text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate">Receipt no.</span>
                    <b>{receipt.receipt_number || "—"}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate">Payment ref.</span>
                    <b>{receipt.reference}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate">Balance now</span>
                    <b className={acct.outstanding > 0 ? "text-bad" : "text-ok"}>{ghs(acct.outstanding)}</b>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate">An SMS receipt has been sent to {acct.customer.phone}.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button onClick={printReceipt}>
                    <Printer className="h-4 w-4" />
                    Print receipt
                  </Button>
                  <Button variant="secondary" onClick={clear}>
                    Next customer
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={record} className="space-y-3">
                <Field label="Amount received (GHS) *">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    inputMode="decimal"
                    className="!h-14 !text-3xl font-extrabold tabular-nums"
                    value={amount}
                    onChange={(e: any) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </Field>
                {acct.outstanding > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-md bg-river-soft px-2.5 py-1 text-xs font-bold text-river"
                      onClick={() => setAmount(acct.outstanding.toFixed(2))}
                    >
                      Full balance {ghs(acct.outstanding)}
                    </button>
                    {acct.overdue > 0 && acct.overdue < acct.outstanding && (
                      <button
                        type="button"
                        className="rounded-md bg-wash px-2.5 py-1 text-xs font-bold text-ink"
                        onClick={() => setAmount(acct.overdue.toFixed(2))}
                      >
                        Overdue only {ghs(acct.overdue)}
                      </button>
                    )}
                    {acct.unpaid_bills.slice(-1).map((b: any) => (
                      <button
                        key={b.id}
                        type="button"
                        className="rounded-md bg-wash px-2.5 py-1 text-xs font-bold text-ink"
                        onClick={() => setAmount(b.outstanding_amount.toFixed(2))}
                      >
                        Latest bill {ghs(b.outstanding_amount)}
                      </button>
                    ))}
                  </div>
                )}
                <Field label="How did they pay?">
                  <Select value={method} onChange={(e: any) => setMethod(e.target.value)}>
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                {method !== "CASH" && (
                  <Field label="Transaction / slip reference">
                    <Input value={ref} onChange={(e: any) => setRef(e.target.value)} placeholder="MoMo transaction ID or bank slip no." />
                  </Field>
                )}
                <Field label="Paid by">
                  <Input value={payer} onChange={(e: any) => setPayer(e.target.value)} placeholder="Name of the person at the counter" />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!amount}>
                  <Banknote className="h-4 w-4" />
                  Record {amount ? ghs(Number(amount)) : "payment"} & issue receipt
                </Button>
                <p className="text-[11px] text-slate">
                  Payments are allocated to the oldest bill first. Anything above the balance becomes credit. Mistakes are fixed by the
                  admin through a reversal — nothing is ever edited.
                </p>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------------------- My day */}
      {!d ? (
        <Spinner />
      ) : (
        <>
          <KpiGrid cols={6}>
            <KpiCard
              label="Taken today"
              value={ghs(k.today_total)}
              tone="ok"
              sub={`${num(k.today_count)} receipts`}
              icon={<Wallet className="h-4 w-4" />}
            />
            <KpiCard
              label="Cash in drawer"
              value={ghs(k.today_cash)}
              sub="hand over at close of day"
              icon={<Banknote className="h-4 w-4" />}
            />
            <KpiCard label="MoMo today" value={ghs(k.today_momo)} icon={<Smartphone className="h-4 w-4" />} />
            <KpiCard label="This week" value={ghs(k.week_total)} sub={`${num(k.week_count)} receipts`} />
            <KpiCard
              label="Whole office today"
              value={ghs(k.community_today_total)}
              sub={`${num(k.community_today_count)} payments, all channels`}
              icon={<Receipt className="h-4 w-4" />}
            />
            <KpiCard
              label="Customers owing"
              value={num(k.customers_owing)}
              tone={k.customers_owing ? "warn" : "ok"}
              sub={ghs(k.outstanding_total)}
            />
          </KpiGrid>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="My receipts today by channel">
              {d.by_method_today.length ? (
                <ul className="divide-y divide-line/60 text-sm">
                  {d.by_method_today.map((m: any) => (
                    <li key={m.method} className="flex justify-between py-1.5">
                      <span className="text-slate">{title(m.method)}</span>
                      <span>
                        <b>{ghs(m.total)}</b> <span className="text-xs text-slate">· {m.count}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-6 text-center text-sm text-slate">No payments recorded yet today.</div>
              )}
              <SectionTitle>My collections — last 14 days</SectionTitle>
              <MiniArea data={d.daily} dataKey="total" height={90} formatter={(v) => ghs(v)} />
            </Card>
            <Card title="My last receipts" className="lg:col-span-2">
              <Table
                rows={d.recent}
                columns={[
                  { key: "receipt_number", label: "Receipt", render: (r) => <b>{r.receipt_number || r.reference}</b> },
                  { key: "paid_at", label: "Time", render: (r) => datetime(r.paid_at) },
                  {
                    key: "customer_name",
                    label: "Customer",
                    render: (r) => (
                      <span>
                        {r.customer_name}
                        <div className="text-xs text-slate">{r.customer_code}</div>
                      </span>
                    ),
                  },
                  { key: "method", label: "Channel", render: (r) => title(r.method) },
                  { key: "amount", label: "Amount", render: (r) => <b>{ghs(r.amount)}</b> },
                  {
                    key: "__a",
                    label: "",
                    className: "text-right",
                    render: (r) => (
                      <button className="text-xs font-semibold text-river" onClick={() => lookup(r.customer_code)}>
                        Open account
                      </button>
                    ),
                  },
                ]}
                empty={<div className="py-6 text-center text-sm text-slate">You haven't issued a receipt yet.</div>}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
