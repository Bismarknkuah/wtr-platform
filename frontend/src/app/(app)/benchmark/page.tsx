"use client";
/**
 * Community health benchmark (platform).
 *
 * Ranks every community on health indicators — percentages, counts and the sustainability
 * score. Deliberately no money and no customer detail: platform staff can see *how well* a
 * community is doing, never *what* it is doing. That is the community's own business.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Card, PageHeader, Spinner, Table } from "@/components/ui";
import { ProgressBar } from "@/components/dashboard/widgets";
import { date, num, pct, title } from "@/lib/format";

const COMPONENTS: { key: string; label: string }[] = [
  { key: "collection_efficiency", label: "Collection" },
  { key: "water_availability", label: "Availability" },
  { key: "water_quality", label: "Quality" },
  { key: "infrastructure_reliability", label: "Reliability" },
  { key: "leakage_water_loss", label: "Leakage" },
  { key: "customer_satisfaction", label: "Satisfaction" },
  { key: "maintenance_performance", label: "Maintenance" },
];

export default function BenchmarkPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [sort, setSort] = useState("score");
  const [desc, setDesc] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api("/api/analytics/benchmark/")
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const sorted = rows
    ? [...rows].sort((a, b) => {
        const av = a[sort] ?? -Infinity;
        const bv = b[sort] ?? -Infinity;
        return desc ? bv - av : av - bv;
      })
    : [];

  const H = (k: string, l: string) => (
    <button
      type="button"
      onClick={() => {
        if (sort === k) setDesc(!desc);
        else {
          setSort(k);
          setDesc(true);
        }
      }}
      className={sort === k ? "text-river" : ""}
    >
      {l}
      {sort === k ? (desc ? " ↓" : " ↑") : ""}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Community health"
        subtitle="Every community ranked on health indicators this month. Click a column to sort; click a row for the score breakdown."
      />
      <Card>
        {rows === null ? (
          <Spinner />
        ) : (
          <Table
            rows={sorted}
            onRowClick={(r: any) => setOpen(open === r.id ? null : r.id)}
            columns={[
              {
                key: "name",
                label: "Community",
                render: (r) => (
                  <div>
                    <Link href={`/communities/${r.id}`} className="font-semibold text-river">
                      {r.name}
                    </Link>
                    <div className="text-xs text-slate">
                      {r.code} · {r.region} · {title(r.water_system_type)}
                    </div>
                  </div>
                ),
              },
              { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
              { key: "approved_at", label: "Live since", render: (r) => (r.approved_at ? date(r.approved_at) : "—") },
              { key: "customers", label: H("customers", "Households"), render: (r) => num(r.customers) },
              { key: "metered_percent", label: H("metered_percent", "Metered"), render: (r) => pct(r.metered_percent) },
              {
                key: "collection_efficiency",
                label: H("collection_efficiency", "Collection"),
                render: (r) => pct(r.collection_efficiency),
              },
              {
                key: "water_loss_percent",
                label: H("water_loss_percent", "Water loss"),
                render: (r) => (
                  <span className={r.water_loss_percent > 30 ? "font-bold text-bad" : r.water_loss_percent > 20 ? "text-warn" : ""}>
                    {pct(r.water_loss_percent)}
                  </span>
                ),
              },
              { key: "outages", label: H("outages", "Outages"), render: (r) => num(r.outages) },
              { key: "quality_alerts", label: H("quality_alerts", "Quality alerts"), render: (r) => num(r.quality_alerts) },
              { key: "open_tickets", label: H("open_tickets", "Open requests"), render: (r) => num(r.open_tickets) },
              {
                key: "score",
                label: H("score", "Score"),
                render: (r) => (
                  <span className="font-extrabold">
                    {r.score} <Badge value={r.grade} />
                  </span>
                ),
              },
            ]}
            expanded={(r: any) =>
              open === r.id ? (
                <div className="grid gap-x-8 gap-y-2 bg-wash/60 px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
                  {COMPONENTS.map((c) => (
                    <ProgressBar
                      key={c.key}
                      value={r.components?.[c.key] ?? 0}
                      label={c.label}
                      detail={`${r.components?.[c.key] ?? "—"}`}
                    />
                  ))}
                </div>
              ) : null
            }
          />
        )}
      </Card>
      <p className="mt-3 text-xs text-slate">
        Indicators only. Customer records, bills, payments and operations are managed exclusively by each community&apos;s own officers.
      </p>
    </div>
  );
}
