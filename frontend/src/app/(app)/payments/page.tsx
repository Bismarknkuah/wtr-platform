"use client";
/** Payments — record (any channel), reverse, refund; receipts and ledger tabs. */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Modal, KV, Tabs, PageHeader } from "@/components/ui";
import { PAY_METHOD, PAY_STATUS } from "@/lib/options";
import { datetime, ghs, title } from "@/lib/format";

function Payments() {
  const { can } = useAuth();
  const sp = useSearchParams();
  const extra: Record<string, any> = {};
  ["status", "customer"].forEach((k) => {
    const v = sp.get(k);
    if (v) extra[k] = v;
  });
  const [rc, setRc] = useState<any>(null);
  const reverse = async (h: any, r: any) => {
    const reason = window.prompt(`Reverse ${r.reference}? This re-opens the bills it paid. Reason:`);
    if (!reason) return;
    try {
      await h.api(`/api/payments/${r.id}/reverse/`, { body: { reason } });
      h.toast("Payment reversed");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  const refund = async (h: any, r: any) => {
    const amount = window.prompt(`Refund amount (max ${r.amount}):`, r.amount);
    if (!amount) return;
    const reason = window.prompt("Reason for refund:");
    if (!reason) return;
    try {
      await h.api(`/api/payments/${r.id}/refund/`, { body: { amount, reason } });
      h.toast("Refund recorded");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  const confirm = async (h: any, r: any) => {
    const ref = window.prompt("Provider transaction reference:", r.provider_reference || "");
    if (ref === null) return;
    try {
      await h.api(`/api/payments/${r.id}/confirm/`, { body: { provider_reference: ref } });
      h.toast("Payment confirmed and applied");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <>
      <ResourcePage
        endpoint="/api/payments/"
        title=""
        createPerm="RECORD_PAYMENT"
        createLabel="Record payment"
        ordering="-paid_at"
        extraParams={extra}
        filters={[
          { name: "status", label: "Status", options: PAY_STATUS },
          { name: "method", label: "Method", options: PAY_METHOD },
        ]}
        columns={[
          {
            key: "reference",
            label: "Reference",
            render: (r) => (
              <div>
                <b>{r.reference}</b>
                <div className="text-xs text-slate">{r.receipt_number}</div>
              </div>
            ),
          },
          { key: "paid_at", label: "Paid", render: (r) => datetime(r.paid_at) },
          {
            key: "customer_name",
            label: "Customer",
            render: (r) => (
              <div>
                {r.customer_name}
                <div className="text-xs text-slate">{r.customer_code}</div>
              </div>
            ),
          },
          { key: "amount", label: "Amount", render: (r) => <b>{ghs(r.amount)}</b> },
          {
            key: "method",
            label: "Channel",
            render: (r) => (
              <div>
                {title(r.method)}
                <div className="text-xs text-slate">
                  {r.provider}
                  {r.provider_reference ? ` · ${r.provider_reference}` : ""}
                </div>
              </div>
            ),
          },
          {
            key: "allocations",
            label: "Applied to",
            render: (r) => (
              <span className="text-xs">
                {(r.allocations || []).map((a: any) => `${a.invoice} (${ghs(a.amount)})`).join(", ") || "credit"}
              </span>
            ),
          },
          { key: "recorded_by_name", label: "By" },
          { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
        ]}
        rowActions={(r, h) => (
          <>
            {r.status === "SUCCESSFUL" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    const d = await h.api("/api/receipts/", { params: { search: r.reference } });
                    setRc(d.results?.[0] || null);
                    if (!d.results?.length) h.toast("Receipt not found", "bad");
                  } catch (e: any) {
                    h.toast(e.message, "bad");
                  }
                }}
              >
                Receipt
              </Button>
            )}
            {r.status === "PENDING" && can("RECORD_PAYMENT") && (
              <Button size="sm" variant="ok" onClick={() => confirm(h, r)}>
                Confirm
              </Button>
            )}
            {r.status === "SUCCESSFUL" && can("REFUND_PAYMENT") && (
              <>
                <Button size="sm" variant="ghost" className="!text-warn" onClick={() => refund(h, r)}>
                  Refund
                </Button>
                <Button size="sm" variant="ghost" className="!text-bad" onClick={() => reverse(h, r)}>
                  Reverse
                </Button>
              </>
            )}
          </>
        )}
        fields={[
          {
            name: "customer",
            label: "Customer",
            type: "lookup",
            required: true,
            lookup: {
              endpoint: "/api/customers/",
              labelKey: (r: any) => `${r.household_name} · ${r.customer_id} · owes ${ghs(r.outstanding_balance)}`,
            },
          },
          { name: "amount", label: "Amount (GHS)", type: "number", step: "0.01", required: true },
          { name: "method", label: "Channel", type: "select", options: PAY_METHOD, defaultValue: "MOBILE_MONEY" },
          { name: "provider", label: "Provider", hint: "MTN MoMo, Telecel Cash, GCB, Paystack, agent name…" },
          { name: "provider_reference", label: "Transaction / receipt ref" },
          { name: "payer_phone", label: "Payer phone" },
          { name: "payer_name", label: "Payer name" },
          { name: "paid_at", label: "Paid at", type: "datetime" },
          { name: "notes", label: "Notes", type: "textarea", span: 2 },
        ]}
      />
      <Modal open={!!rc} onClose={() => setRc(null)} title={`Receipt ${rc?.receipt_number}`}>
        {rc && (
          <div>
            <KV
              items={[
                ["Payment", rc.payment_reference],
                ["Customer", rc.customer_name],
                ["Amount", ghs(rc.amount)],
                ["Issued", datetime(rc.issued_at)],
                ["Delivered via", (rc.delivered_via || []).join(", ") || "portal"],
              ]}
            />
            <pre className="mt-3 max-h-64 overflow-auto rounded bg-wash p-3 text-xs">{JSON.stringify(rc.snapshot, null, 2)}</pre>
            <div className="mt-3 flex justify-end">
              <Button variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
function Receipts() {
  return (
    <ResourcePage
      endpoint="/api/receipts/"
      title=""
      ordering="-issued_at"
      columns={[
        { key: "receipt_number", label: "Receipt", render: (r) => <b>{r.receipt_number}</b> },
        { key: "payment_reference", label: "Payment" },
        { key: "customer_name", label: "Customer" },
        { key: "amount", label: "Amount", render: (r) => ghs(r.amount) },
        { key: "issued_at", label: "Issued", render: (r) => datetime(r.issued_at) },
        { key: "delivered_via", label: "Delivered", render: (r) => (r.delivered_via || []).join(", ") || "portal" },
      ]}
    />
  );
}
function Ledger() {
  return (
    <ResourcePage
      endpoint="/api/ledger/"
      title=""
      search={false}
      ordering="-created_at"
      filters={[
        {
          name: "entry_type",
          label: "Type",
          options: ["BILL", "PAYMENT", "ADJUSTMENT", "REFUND", "REVERSAL", "WRITE_OFF", "OPENING"].map((v) => ({
            value: v,
            label: title(v),
          })),
        },
      ]}
      columns={[
        { key: "created_at", label: "Date", render: (r) => datetime(r.created_at) },
        { key: "customer", label: "Customer ID" },
        { key: "entry_type", label: "Type", render: (r) => <Badge value={r.entry_type} /> },
        {
          key: "description",
          label: "Description",
          render: (r) => (
            <span>
              {r.description} <span className="text-xs text-slate">{r.reference}</span>
            </span>
          ),
        },
        { key: "debit", label: "Debit", render: (r) => (Number(r.debit) ? ghs(r.debit) : "") },
        { key: "credit", label: "Credit", render: (r) => (Number(r.credit) ? ghs(r.credit) : "") },
        { key: "balance_after", label: "Balance after", render: (r) => <b>{ghs(r.balance_after)}</b> },
      ]}
    />
  );
}

export default function PaymentsPage() {
  const [tab, setTab] = useState("payments");
  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="MoMo, bank, cash, agent, USSD, online. Every payment produces a receipt and an immutable ledger entry."
      />
      <Tabs
        tabs={[
          { key: "payments", label: "Payments" },
          { key: "receipts", label: "Receipts" },
          { key: "ledger", label: "Ledger" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "payments" ? <Payments /> : tab === "receipts" ? <Receipts /> : <Ledger />}
    </div>
  );
}
