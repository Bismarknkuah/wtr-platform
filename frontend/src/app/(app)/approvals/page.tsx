"use client";
/** Approvals — request + decide. Approving executes the underlying action atomically. */
import { useSearchParams } from "next/navigation";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { APPROVAL_STATUS, APPROVAL_TYPE } from "@/lib/options";
import { datetime } from "@/lib/format";
export default function ApprovalsPage() {
  const { can, user } = useAuth();
  const sp = useSearchParams();
  const extra: Record<string, any> = {};
  const st = sp.get("status");
  if (st) extra.status = st;
  const decide = async (h: any, r: any, a: "approve" | "reject") => {
    const note = window.prompt(a === "approve" ? "Approval note (optional):" : "Reason for rejection:") ?? "";
    if (a === "reject" && !note) return;
    try {
      const d = await h.api(`/api/approvals/${r.id}/${a}/`, { body: { note } });
      h.toast(
        d.status === "EXECUTED"
          ? "Approved and executed"
          : d.status === "FAILED"
            ? `Approved but execution failed: ${d.execution_result?.error}`
            : "Rejected",
        d.status === "FAILED" ? "bad" : "ok",
      );
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/approvals/"
      title="Approvals"
      subtitle="Sensitive changes need a second pair of eyes. You cannot approve your own request."
      createPerm="REQUEST_APPROVAL"
      createLabel="New request"
      ordering="-created_at"
      extraParams={extra}
      filters={[
        { name: "status", label: "Status", options: APPROVAL_STATUS },
        { name: "request_type", label: "Type", options: APPROVAL_TYPE },
      ]}
      columns={[
        {
          key: "request_type_label",
          label: "Request",
          render: (r) => (
            <div>
              <b>{r.request_type_label}</b>
              <div className="text-xs text-slate">{r.target_label}</div>
            </div>
          ),
        },
        {
          key: "payload",
          label: "Details",
          render: (r) => (
            <code className="text-xs">
              {Object.entries(r.payload || {})
                .map(([k, v]) => `${k}=${v}`)
                .join(" ")}
            </code>
          ),
        },
        { key: "reason", label: "Reason", render: (r) => <span className="text-xs">{r.reason}</span> },
        {
          key: "requested_by_name",
          label: "Requested by",
          render: (r) => (
            <div>
              {r.requested_by_name}
              <div className="text-xs text-slate">{datetime(r.created_at)}</div>
            </div>
          ),
        },
        {
          key: "reviewed_by_name",
          label: "Decision",
          render: (r) =>
            r.reviewed_by_name ? (
              <div>
                {r.reviewed_by_name}
                <div className="text-xs text-slate">
                  {datetime(r.reviewed_at)}
                  {r.review_note ? ` · ${r.review_note}` : ""}
                </div>
                {r.execution_result?.error && <div className="text-xs text-bad">{r.execution_result.error}</div>}
              </div>
            ) : (
              "—"
            ),
        },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      rowActions={(r, h) =>
        can("APPROVE_REQUESTS") && r.status === "PENDING" && r.requested_by !== user?.id ? (
          <>
            <Button size="sm" variant="ok" onClick={() => decide(h, r, "approve")}>
              Approve
            </Button>
            <Button size="sm" variant="ghost" className="!text-bad" onClick={() => decide(h, r, "reject")}>
              Reject
            </Button>
          </>
        ) : null
      }
      fields={[
        { name: "request_type", label: "Type", type: "select", options: APPROVAL_TYPE, required: true },
        { name: "target_label", label: "What it concerns", hint: "e.g. INV-WTR-2026-000458 or a customer name" },
        {
          name: "payload",
          label: "Payload (JSON)",
          type: "json",
          required: true,
          span: 2,
          hint: 'Required keys by type — BILL_ADJUSTMENT: {"bill": id, "amount": -10} · REFUND: {"payment": id, "amount": 20} · TARIFF_CHANGE: {"customer": id, "tariff_plan": id} · METER_REPLACEMENT: {"old_meter", "new_meter", "final_reading", "initial_reading"} · DEBT_WRITE_OFF: {"customer": id, "amount": 50} · DISCONNECTION / RECONNECTION / CUSTOMER_DEACTIVATION: {"customer": id} · PAYMENT_CORRECTION: {"payment": id}',
        },
        { name: "reason", label: "Reason", type: "textarea", required: true, span: 2 },
      ]}
    />
  );
}
