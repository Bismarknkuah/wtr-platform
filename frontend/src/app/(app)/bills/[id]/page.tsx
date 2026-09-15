"use client";
/** Bill detail — printable invoice, line items, adjustments, payments, actions. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, KV, Modal, PageHeader, Spinner, Table, Textarea, useToast } from "@/components/ui";
import { date, datetime, ghs, m3, title } from "@/lib/format";

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const { push } = useToast();
  const [b, setB] = useState<any>(null);
  const [adj, setAdj] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [modal, setModal] = useState<"adjust" | "cancel" | "request" | null>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api(`/api/bills/${id}/`)
      .then(setB)
      .catch((e) => push(e.message, "bad"));
    api(`/api/bills/${id}/adjustments/`)
      .then((d) => setAdj(d.results || d))
      .catch(() => {});
    api("/api/payments/", { params: { bill: id } })
      .then((d) => setPays(d.results))
      .catch(() => {});
  }, [id]); // eslint-disable-line
  useEffect(() => {
    load();
  }, [load]);
  if (!b) return <Spinner />;
  const go = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      push(ok);
      setModal(null);
      load();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const isCustomer = user?.role === "CUSTOMER";
  const lines = (
    [
      ["Water charge", b.water_charge],
      ["Service charge", b.service_charge],
      ["Maintenance levy", b.maintenance_levy],
      ["Infrastructure levy", b.infrastructure_levy],
      ["Other charges", b.other_charges],
      ["Penalty", b.penalty],
      ["Discount", -Number(b.discount)],
      ["Adjustments", b.adjustment],
    ] as [string, any][]
  ).filter(([, v]) => Number(v) !== 0);
  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title={b.invoice_number}
          subtitle={
            <span>
              {b.customer_name} · {b.customer_code} · <Badge value={b.status} />
            </span>
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              {isCustomer && Number(b.outstanding_amount) > 0 && (
                <Link href="/portal/pay">
                  <Button>Pay now</Button>
                </Link>
              )}
              {!isCustomer && b.status !== "CANCELLED" && (
                <>
                  {can("ADJUST_BILL") && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setForm({ amount: "", reason: "" });
                        setModal("adjust");
                      }}
                    >
                      Adjust
                    </Button>
                  )}
                  {!can("ADJUST_BILL") && can("REQUEST_APPROVAL") && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setForm({ amount: "", reason: "" });
                        setModal("request");
                      }}
                    >
                      Request adjustment
                    </Button>
                  )}
                  {can("ADJUST_BILL") && Number(b.outstanding_amount) > 0 && (
                    <Button
                      variant="ghost"
                      className="!text-bad"
                      onClick={() => {
                        setForm({ reason: "" });
                        setModal("cancel");
                      }}
                    >
                      Cancel bill
                    </Button>
                  )}
                  {can("RECORD_PAYMENT") && Number(b.outstanding_amount) > 0 && (
                    <Link href={`/customers/${b.customer}`}>
                      <Button>Record payment</Button>
                    </Link>
                  )}
                </>
              )}
            </>
          }
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-start justify-between border-b border-line pb-4">
            <div>
              <div className="text-lg font-extrabold">{b.community_name}</div>
              <div className="text-xs text-slate">Water bill · {b.period_name || "Ad-hoc"}</div>
            </div>
            <div className="text-right">
              <div className="font-extrabold">{b.invoice_number}</div>
              <div className="text-xs text-slate">
                Issued {date(b.issued_at)} · Due {date(b.due_date)}
              </div>
            </div>
          </div>
          <div className="mb-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold text-slate">Billed to</div>
              <div className="font-semibold">{b.customer_name}</div>
              <div>{b.customer_code}</div>
              <div>{b.customer_phone}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate">Meter</div>
              <div className="font-semibold">{b.meter_code || "—"}</div>
              <div>
                Previous {b.previous_reading} → Current {b.current_reading}
              </div>
              <div className="font-semibold">Consumption {m3(b.consumption)}</div>
              <div className="text-xs text-slate">Tariff: {b.tariff_name}</div>
            </div>
          </div>
          {b.lines?.length > 0 && (
            <div className="mb-3 rounded-md bg-wash p-3 text-xs">
              <div className="mb-1 font-bold text-slate">Tariff calculation</div>
              {b.lines.map((l: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{l.label || l.description}</span>
                  <span>{ghs(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <table className="w-full text-sm">
            <tbody>
              {lines.map(([k, v]) => (
                <tr key={k} className="border-b border-line/60">
                  <td className="py-1.5">{k}</td>
                  <td className="py-1.5 text-right tabular-nums">{ghs(v)}</td>
                </tr>
              ))}
              <tr className="border-b border-line font-bold">
                <td className="py-1.5">Current charges</td>
                <td className="py-1.5 text-right">{ghs(b.current_charges)}</td>
              </tr>
              {Number(b.previous_balance) !== 0 && (
                <tr className="border-b border-line/60">
                  <td className="py-1.5">Previous balance</td>
                  <td className="py-1.5 text-right">{ghs(b.previous_balance)}</td>
                </tr>
              )}
              <tr className="text-base font-extrabold">
                <td className="py-2">Total amount</td>
                <td className="py-2 text-right">{ghs(b.total_amount)}</td>
              </tr>
              <tr className="text-sm">
                <td className="py-1 text-slate">Paid</td>
                <td className="py-1 text-right text-ok">{ghs(b.amount_paid)}</td>
              </tr>
              <tr className="text-base font-extrabold">
                <td className="py-1">Outstanding</td>
                <td className={`py-1 text-right ${Number(b.outstanding_amount) > 0 ? "text-bad" : "text-ok"}`}>
                  {ghs(b.outstanding_amount)}
                </td>
              </tr>
            </tbody>
          </table>
          {b.notes && <p className="mt-3 text-xs text-slate">{b.notes}</p>}
          <p className="mt-4 text-xs text-slate">
            Pay via Mobile Money, bank, agent, or the customer portal. Quote {b.invoice_number} or {b.customer_code}.
          </p>
        </Card>
        <div className="space-y-4 print:hidden">
          <Card title="Payments on this bill">
            <Table
              rows={pays}
              columns={[
                { key: "reference", label: "Ref" },
                { key: "paid_at", label: "Date", render: (r) => date(r.paid_at) },
                { key: "amount", label: "Amount", render: (r) => ghs(r.amount) },
                { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
              ]}
              empty={<div className="py-4 text-center text-xs text-slate">No payments yet.</div>}
            />
          </Card>
          <Card title="Adjustments">
            <Table
              rows={adj}
              columns={[
                { key: "created_at", label: "Date", render: (r) => date(r.created_at) },
                {
                  key: "amount",
                  label: "Amount",
                  render: (r) => <span className={Number(r.amount) < 0 ? "text-ok" : "text-bad"}>{ghs(r.amount)}</span>,
                },
                {
                  key: "reason",
                  label: "Reason",
                  render: (r) => (
                    <span className="text-xs">
                      {r.reason}
                      <div className="text-slate">by {r.approved_by_name}</div>
                    </span>
                  ),
                },
              ]}
              empty={<div className="py-4 text-center text-xs text-slate">No adjustments.</div>}
            />
          </Card>
          <Card title="Details">
            <KV
              items={[
                ["Status", <Badge value={b.status} />],
                ["Issued", datetime(b.issued_at)],
                ["Community", b.community_name],
                ["Period", b.period_name || "—"],
                [
                  "Customer",
                  <Link href={`/customers/${b.customer}`} className="text-river">
                    {b.customer_name}
                  </Link>,
                ],
              ]}
            />
          </Card>
        </div>
      </div>
      <Modal
        open={modal === "adjust" || modal === "request"}
        onClose={() => setModal(null)}
        title={modal === "adjust" ? "Adjust bill" : "Request bill adjustment"}
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            modal === "adjust"
              ? go(() => api(`/api/bills/${id}/adjust/`, { body: form }), "Bill adjusted")
              : go(
                  () =>
                    api("/api/approvals/", {
                      body: {
                        request_type: "BILL_ADJUSTMENT",
                        payload: { bill: b.id, amount: form.amount },
                        reason: form.reason,
                        target_label: b.invoice_number,
                        target_model: "Bill",
                        target_id: b.id,
                      },
                    }),
                  "Adjustment request sent for approval",
                );
          }}
        >
          <Field label="Amount (GHS) *" hint="Negative reduces the bill (credit), positive increases it">
            <Input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e: any) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Reason *">
            <Textarea required value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {modal === "adjust" ? "Apply adjustment" : "Submit request"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={modal === "cancel"} onClose={() => setModal(null)} title="Cancel bill">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            go(() => api(`/api/bills/${id}/cancel/`, { body: form }), "Bill cancelled");
          }}
        >
          <p className="text-sm text-slate">
            The outstanding amount will be credited back via an adjustment. Payments already made stay on the customer's account as credit.
          </p>
          <Field label="Reason *">
            <Textarea required value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Back
            </Button>
            <Button type="submit" variant="danger" loading={busy}>
              Cancel bill
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
