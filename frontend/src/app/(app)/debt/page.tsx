"use client";
/** Debt management — aging, top debtors, dunning ladder (approval-gated disconnection), write-off requests. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCommunityScope, CommunityPicker } from "@/components/CommunityScope";
import { Badge, Button, Card, PageHeader, Spinner, Stat, Table, useToast } from "@/components/ui";
import { datetime, ghs, num, title } from "@/lib/format";

export default function DebtPage() {
  const { can, isPlatform } = useAuth();
  const { push } = useToast();
  const { community, setCommunity } = useCommunityScope();
  const [aging, setAging] = useState<any>(null);
  const [hist, setHist] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const p = isPlatform && community ? { community } : {};
  const load = () => {
    if (isPlatform && !community) return;
    api("/api/bills/aging/", { params: p })
      .then(setAging)
      .catch((e) => push(e.message, "bad"));
    api("/api/bills/dunning_history/", { params: { ...p, page_size: 30 } })
      .then((d) => setHist(d.results || d))
      .catch(() => {});
  };
  useEffect(load, [community]); // eslint-disable-line
  const run = async () => {
    setBusy(true);
    try {
      const d = await api("/api/bills/run_dunning/", { body: p });
      const a = d.actions || [];
      push(`Dunning run: ${a.length} actions · ${a.filter((x: any) => x.stage === "DISCONNECTION").length} disconnection approvals raised`);
      load();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const total = aging ? Object.values(aging.buckets).reduce((a: number, b: any) => a + Number(b), 0) : 0;
  return (
    <div>
      <PageHeader
        title="Debt management"
        subtitle="Reminder → 2nd reminder → final notice → disconnection warning → disconnection (needs approval)."
        actions={
          <>
            {isPlatform && <CommunityPicker value={community} onChange={setCommunity} />}
            {can("MANAGE_DEBT") && (
              <Button onClick={run} loading={busy}>
                Run dunning now
              </Button>
            )}
          </>
        }
      />
      {isPlatform && !community ? (
        <Card>
          <div className="py-8 text-center text-sm text-slate">Select a community.</div>
        </Card>
      ) : !aging ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
            <Stat label="Total outstanding" value={ghs(total)} tone="bad" />
            {Object.entries(aging.buckets).map(([k, v]: any) => (
              <Stat
                key={k}
                label={k === "current" ? "Not yet due" : `${title(k).replace(" ", "–")} days`}
                value={ghs(v)}
                tone={k === "over_90" ? "bad" : k === "current" ? "ink" : "warn"}
              />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top debtors">
              <Table
                rows={aging.top_debtors}
                columns={[
                  {
                    key: "household",
                    label: "Customer",
                    render: (r) => (
                      <Link href={`/customers/${r.id}`} className="font-semibold text-river">
                        {r.household}
                        <div className="text-xs font-normal text-slate">
                          {r.customer_id} · {r.phone}
                        </div>
                      </Link>
                    ),
                  },
                  { key: "outstanding", label: "Owes", render: (r) => <b className="text-bad">{ghs(r.outstanding)}</b> },
                  { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
                ]}
                empty={<div className="py-6 text-center text-sm text-slate">Nobody owes anything. 🎉</div>}
              />
            </Card>
            <Card title="Dunning history">
              <Table
                rows={hist}
                columns={[
                  { key: "created_at", label: "When", render: (r) => datetime(r.created_at) },
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
                  { key: "stage", label: "Stage", render: (r) => <Badge value={r.stage} /> },
                  { key: "days_overdue", label: "Days", render: (r) => num(r.days_overdue) },
                  { key: "outstanding", label: "Outstanding", render: (r) => ghs(r.outstanding) },
                ]}
                empty={<div className="py-6 text-center text-sm text-slate">No dunning actions yet.</div>}
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
