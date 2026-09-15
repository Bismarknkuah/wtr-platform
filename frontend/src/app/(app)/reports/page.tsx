"use client";
/** Financial reports — revenue, breakdown by charge type / tariff / customer type / method, expenses, daily collections. CSV export. */
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCommunityScope, CommunityPicker } from "@/components/CommunityScope";
import { Button, Card, Field, Input, PageHeader, Spinner, Stat, Table } from "@/components/ui";
import { BilledVsCollected, Donut } from "@/components/charts";
import { ghs, num, pct, title } from "@/lib/format";

export default function ReportsPage() {
  const { isPlatform } = useAuth();
  const { community, setCommunity } = useCommunityScope();
  const first = new Date();
  first.setDate(1);
  const [start, setStart] = useState(first.toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (isPlatform && !community) return;
    setD(null);
    api("/api/analytics/revenue/", { params: { start, end, ...(isPlatform ? { community } : {}) } })
      .then(setD)
      .catch((e) => setErr(e.message));
  }, [start, end, community, isPlatform]);
  const csv = () => {
    if (!d) return;
    const rows = [
      ["Metric", "Value"],
      ["Billed", d.billed],
      ["Collected", d.collected],
      ["Collection efficiency %", d.collection_efficiency ?? ""],
      ...Object.entries(d.breakdown).map(([k, v]) => [title(k), v]),
      ["Maintenance expenses", d.expenses.maintenance],
      ["Refunds", d.expenses.refunds],
      ["Outstanding total", d.outstanding_total],
      [],
      ["Date", "Collected", "Payments"],
      ...d.daily.map((x: any) => [x.date, x.total, x.count]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wtr-revenue-${start}-to-${end}.csv`;
    a.click();
  };
  return (
    <div>
      <PageHeader
        title="Financial reports"
        subtitle="Revenue, collections and expenses for any date range."
        actions={
          <>
            {isPlatform && <CommunityPicker value={community} onChange={setCommunity} />}
            <Field label="From">
              <Input type="date" value={start} onChange={(e: any) => setStart(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={end} onChange={(e: any) => setEnd(e.target.value)} />
            </Field>
            <Button variant="secondary" onClick={csv} disabled={!d}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </>
        }
      />
      {err && <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
      {isPlatform && !community ? (
        <Card>
          <div className="py-8 text-center text-sm text-slate">Select a community.</div>
        </Card>
      ) : !d ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Billed" value={ghs(d.billed)} />
            <Stat label="Collected" value={ghs(d.collected)} tone="ok" />
            <Stat label="Collection efficiency" value={pct(d.collection_efficiency)} />
            <Stat label="Maintenance spend" value={ghs(d.expenses.maintenance)} tone="warn" />
            <Stat label="Outstanding (all time)" value={ghs(d.outstanding_total)} tone="bad" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Daily collections" className="lg:col-span-2">
              <BilledVsCollected data={d.daily.map((x: any) => ({ month: x.date.slice(5), billed: 0, collected: x.total }))} />
            </Card>
            <Card title="Revenue by charge type">
              <Donut
                data={Object.entries(d.breakdown)
                  .filter(([, v]) => Number(v) > 0)
                  .map(([k, v]) => ({ name: title(k), value: Number(v) }))}
                nameKey="name"
                valueKey="value"
              />
            </Card>
            <Card title="By tariff plan">
              <Table
                rows={d.by_tariff.map((x: any, i: number) => ({ id: i, ...x }))}
                columns={[
                  { key: "tariff_name", label: "Tariff" },
                  { key: "bills", label: "Bills", render: (r) => num(r.bills) },
                  { key: "total", label: "Charges", render: (r) => ghs(r.total) },
                ]}
              />
            </Card>
            <Card title="By customer type">
              <Table
                rows={d.by_customer_type.map((x: any, i: number) => ({ id: i, ...x }))}
                columns={[
                  { key: "customer__category", label: "Type", render: (r) => title(r.customer__category) },
                  { key: "bills", label: "Bills" },
                  { key: "total", label: "Charges", render: (r) => ghs(r.total) },
                ]}
              />
            </Card>
            <Card title="By payment channel">
              <Table
                rows={d.by_method.map((x: any, i: number) => ({ id: i, ...x }))}
                columns={[
                  { key: "method", label: "Channel", render: (r) => title(r.method) },
                  { key: "count", label: "Payments" },
                  { key: "total", label: "Collected", render: (r) => ghs(r.total) },
                ]}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
