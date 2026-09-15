"use client";
/** Customer portal — my bills + statement. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, PageHeader, Spinner, Table, Tabs } from "@/components/ui";
import { date, datetime, ghs, m3 } from "@/lib/format";
export default function PortalBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<any[] | null>(null);
  const [stmt, setStmt] = useState<any[]>([]);
  const [tab, setTab] = useState("bills");
  const [owing, setOwing] = useState(0);
  useEffect(() => {
    api("/api/bills/", { params: { page_size: 100, ordering: "-issued_at" } })
      .then((d) => setBills(d.results))
      .catch(() => setBills([]));
    if (user?.customer_id)
      api(`/api/customers/${user.customer_id}/statement/`)
        .then((d) => {
          setStmt(d.entries);
          setOwing(Number(d.customer.outstanding_balance));
        })
        .catch(() => {});
  }, [user?.customer_id]);
  return (
    <div>
      <PageHeader
        title="My bills"
        subtitle="Every bill on your account, and the full statement."
        actions={
          owing > 0 ? (
            <Link href="/portal/pay">
              <Button>Pay {ghs(owing)}</Button>
            </Link>
          ) : undefined
        }
      />
      <Tabs
        tabs={[
          { key: "bills", label: "Bills" },
          { key: "statement", label: "Statement" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Card>
        {bills === null ? (
          <Spinner />
        ) : tab === "bills" ? (
          <Table
            rows={bills}
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
              { key: "amount_paid", label: "Paid", render: (r) => ghs(r.amount_paid) },
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
            empty={<div className="py-8 text-center text-sm text-slate">No bills yet.</div>}
          />
        ) : (
          <Table
            rows={stmt}
            columns={[
              { key: "created_at", label: "Date", render: (r) => datetime(r.created_at) },
              { key: "entry_type", label: "Type", render: (r) => <Badge value={r.entry_type} /> },
              { key: "description", label: "Description" },
              { key: "debit", label: "Charged", render: (r) => (Number(r.debit) ? ghs(r.debit) : "") },
              { key: "credit", label: "Paid / credited", render: (r) => (Number(r.credit) ? ghs(r.credit) : "") },
              { key: "balance_after", label: "Balance", render: (r) => <b>{ghs(r.balance_after)}</b> },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
