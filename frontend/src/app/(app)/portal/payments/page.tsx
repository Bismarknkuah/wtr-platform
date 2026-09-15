"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Card, PageHeader, Spinner, Table } from "@/components/ui";
import { datetime, ghs, title } from "@/lib/format";
export default function PortalPayments() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    api("/api/payments/", { params: { page_size: 100, ordering: "-paid_at" } })
      .then((d) => setRows(d.results))
      .catch(() => setRows([]));
  }, []);
  return (
    <div>
      <PageHeader title="My payments" subtitle="Every payment and its receipt number." />
      <Card>
        {rows === null ? (
          <Spinner />
        ) : (
          <Table
            rows={rows}
            columns={[
              { key: "paid_at", label: "Date", render: (r) => datetime(r.paid_at) },
              { key: "reference", label: "Reference", render: (r) => <b>{r.reference}</b> },
              { key: "receipt_number", label: "Receipt", render: (r) => r.receipt_number || "—" },
              { key: "amount", label: "Amount", render: (r) => <b>{ghs(r.amount)}</b> },
              { key: "method", label: "Channel", render: (r) => title(r.method) },
              {
                key: "allocations",
                label: "Applied to",
                render: (r) => (
                  <span className="text-xs">{(r.allocations || []).map((a: any) => a.invoice).join(", ") || "account credit"}</span>
                ),
              },
              { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
            ]}
            empty={<div className="py-8 text-center text-sm text-slate">No payments yet.</div>}
          />
        )}
      </Card>
    </div>
  );
}
