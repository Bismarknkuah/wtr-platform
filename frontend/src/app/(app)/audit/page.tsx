"use client";
/** Audit trail — immutable log of every create/update/delete/login/approval/payment with before→after diffs. */
import { useState } from "react";
import ResourcePage from "@/components/ResourcePage";
import { Badge, Button, Modal } from "@/components/ui";
import { datetime, title } from "@/lib/format";
const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "APPROVE",
  "REJECT",
  "PAYMENT",
  "REVERSE",
  "REFUND",
  "GENERATE_BILLS",
  "VALIDATE",
  "REPLACE",
].map((v) => ({ value: v, label: title(v) }));
export default function AuditPage() {
  const [row, setRow] = useState<any>(null);
  return (
    <>
      <ResourcePage
        endpoint="/api/audit-logs/"
        title="Audit trail"
        subtitle="Who did what, when, from where — and what changed. Read-only."
        ordering="-created_at"
        filters={[{ name: "action", label: "Action", options: ACTIONS }]}
        columns={[
          { key: "created_at", label: "When", render: (r) => <span className="text-xs">{datetime(r.created_at)}</span> },
          {
            key: "actor_label",
            label: "Who",
            render: (r) => (
              <div>
                {r.actor_label || "system"}
                <div className="text-xs text-slate">{r.ip_address}</div>
              </div>
            ),
          },
          { key: "action", label: "Action", render: (r) => <Badge value={r.action} /> },
          {
            key: "model_name",
            label: "What",
            render: (r) => (
              <div>
                {r.model_name}
                <div className="text-xs text-slate">{r.object_label}</div>
              </div>
            ),
          },
          { key: "community_name", label: "Community", render: (r) => r.community_name || "Platform" },
          { key: "reason", label: "Reason", render: (r) => <span className="text-xs">{r.reason}</span> },
        ]}
        rowActions={(r) =>
          Object.keys(r.changes || {}).length ? (
            <Button size="sm" variant="ghost" onClick={() => setRow(r)}>
              Changes
            </Button>
          ) : null
        }
      />
      <Modal open={!!row} onClose={() => setRow(null)} title={`${row?.action} · ${row?.model_name} ${row?.object_label || ""}`}>
        {row && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate">
                <th>Field</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(row.changes).map(([k, v]: any) => (
                <tr key={k} className="border-t border-line/60">
                  <td className="py-1 font-semibold">{k}</td>
                  <td className="py-1 text-bad">{String(v?.from ?? "—")}</td>
                  <td className="py-1 text-ok">{String(v?.to ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {row && <div className="mt-3 text-xs text-slate">{row.user_agent}</div>}
      </Modal>
    </>
  );
}
