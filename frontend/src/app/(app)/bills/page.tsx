"use client";
/** Bills — immutable invoices. Changes happen only through adjustments (approval-gated) and cancellation. */
import { useSearchParams } from "next/navigation";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { BILL_STATUS } from "@/lib/options";
import { date, ghs, m3 } from "@/lib/format";
export default function BillsPage() {
  const { can } = useAuth();
  const sp = useSearchParams();
  const extra: Record<string, any> = {};
  ["status", "customer", "period"].forEach((k) => {
    const v = sp.get(k);
    if (v) extra[k] = v;
  });
  const refresh = async (h: any) => {
    try {
      const d = await h.api("/api/bills/refresh_overdue/", { body: {} });
      h.toast(`${d.updated ?? 0} bills marked overdue`);
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/bills/"
      title="Bills"
      subtitle="Every invoice with its full charge breakdown. Payments settle the oldest bills first."
      ordering="-issued_at"
      extraParams={extra}
      rowHref={(r) => `/bills/${r.id}`}
      filters={[{ name: "status", label: "Status", options: BILL_STATUS }]}
      headerActions={(h) =>
        can("MANAGE_DEBT") ? (
          <Button variant="secondary" onClick={() => refresh(h)}>
            Refresh overdue
          </Button>
        ) : null
      }
      columns={[
        { key: "invoice_number", label: "Invoice", render: (r) => <b className="text-river">{r.invoice_number}</b> },
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
        { key: "period_name", label: "Period" },
        { key: "consumption", label: "Usage", render: (r) => m3(r.consumption) },
        { key: "current_charges", label: "Charges", render: (r) => ghs(r.current_charges) },
        { key: "total_amount", label: "Total", render: (r) => <b>{ghs(r.total_amount)}</b> },
        {
          key: "outstanding_amount",
          label: "Owing",
          render: (r) => <span className={Number(r.outstanding_amount) > 0 ? "font-bold text-bad" : ""}>{ghs(r.outstanding_amount)}</span>,
        },
        { key: "due_date", label: "Due", render: (r) => date(r.due_date) },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
    />
  );
}
