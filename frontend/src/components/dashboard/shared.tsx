"use client";
/** Building blocks shared by the role dashboards. Each dashboard page stays its own file and composes these. */
import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useCommunityScope, CommunityPicker } from "@/components/CommunityScope";
import { Spinner } from "@/components/ui";
import { num } from "@/lib/format";

export function useCommunityDashboard() {
  const { community, setCommunity, isPlatform } = useCommunityScope();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isPlatform && !community) {
      setData(null);
      return;
    }
    setData(null);
    api("/api/dashboard/community/", { params: isPlatform ? { community } : {} })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [community, isPlatform]);
  const picker = isPlatform ? <CommunityPicker value={community} onChange={setCommunity} /> : null;
  const body = error ? (
    <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>
  ) : isPlatform && !community ? (
    <div className="rounded-lg bg-white p-6 text-sm text-slate shadow-card">Select a community to view its dashboard.</div>
  ) : !data ? (
    <Spinner />
  ) : null;
  return { data, picker, body, community };
}

/** The core engine, live: Meter → Reading → Consumption → Bill → Payment. The one memorable element on the ops dashboards. */
export function PipelineStrip({ o, a }: { o: any; a: any }) {
  const steps: { label: string; value: ReactNode; href: string; note?: string; warn?: boolean }[] = [
    { label: "Active meters", value: num(o.active_meters), href: "/meters" },
    {
      label: "Readings to validate",
      value: num(a.pending_readings),
      href: "/readings?status=PENDING",
      warn: a.pending_readings > 0,
      note: a.anomalous_readings ? `${a.anomalous_readings} flagged` : undefined,
    },
    { label: "Consumption this month", value: `${num(o.monthly_consumption_m3)} m³`, href: "/readings" },
    { label: "Billed this month", value: `GHS ${num(o.bills_generated.toFixed(0))}`, href: "/bills" },
    {
      label: "Collected",
      value: `GHS ${num(o.collected.toFixed(0))}`,
      href: "/payments",
      note: o.collection_efficiency != null ? `${o.collection_efficiency}% efficiency` : undefined,
    },
    {
      label: "Outstanding",
      value: `GHS ${num(o.outstanding.toFixed(0))}`,
      href: "/debt",
      warn: a.overdue_bills > 0,
      note: a.overdue_bills ? `${a.overdue_bills} overdue bills` : undefined,
    },
  ];
  return (
    <div className="mb-5 overflow-x-auto rounded-lg bg-ink p-2 shadow-card">
      <div className="flex min-w-[900px] items-stretch">
        {steps.map((s, i) => (
          <Link key={s.label} href={s.href} className="group flex flex-1 items-center">
            <div className="flex-1 rounded-md px-4 py-3 transition group-hover:bg-white/10">
              <div className="text-[11px] font-semibold text-white/60">{s.label}</div>
              <div className={`text-xl font-extrabold tabular-nums ${s.warn ? "text-amber-300" : "text-white"}`}>{s.value}</div>
              {s.note && <div className="text-[11px] text-white/50">{s.note}</div>}
            </div>
            {i < steps.length - 1 && <ArrowRight className="mx-1 h-4 w-4 shrink-0 text-white/30" />}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AlertList({ a }: { a: any }) {
  const items: [string, number, string][] = [
    ["Readings pending validation", a.pending_readings, "/readings?status=PENDING"],
    ["Anomalous readings", a.anomalous_readings, "/readings?is_anomalous=true"],
    ["High-risk accounts", a.high_risk_customers, "/customers?risk_level=HIGH"],
    ["Overdue bills", a.overdue_bills, "/bills?status=OVERDUE"],
    ["Open service requests", a.open_tickets, "/tickets"],
    ["Active outages", a.active_outages, "/outages"],
    ["Maintenance due (14 days)", a.maintenance_due, "/maintenance"],
    ["Pending approvals", a.pending_approvals, "/approvals?status=PENDING"],
    ["Water-quality alerts (90 days)", a.quality_alerts, "/water-quality"],
    ["Open emergencies", a.open_emergencies, "/emergencies"],
  ];
  return (
    <ul className="divide-y divide-line/60 text-sm">
      {items.map(([l, v, h]) => (
        <li key={l}>
          <Link href={h} className="flex items-center justify-between py-2 hover:text-river">
            <span className="text-slate">{l}</span>
            <span className={`font-extrabold tabular-nums ${v > 0 ? "text-warn" : "text-ink"}`}>{v}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Generic loader for the role dashboards (`/api/dashboard/<role>/`).
 *
 * Community-scoped roles just fetch. Platform roles get a community picker and the endpoint
 * is called with `?community=<id>`; `allowAll` lets the auditor view the whole platform.
 */
export function useRoleDashboard(endpoint: string, opts: { allowAll?: boolean; scoped?: boolean } = {}) {
  const { community, setCommunity, isPlatform } = useCommunityScope();
  const scoped = opts.scoped ?? true;
  const needsCommunity = scoped && isPlatform && !opts.allowAll;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (needsCommunity && !community) {
      setData(null);
      return;
    }
    setData(null);
    setError("");
    const params = scoped && isPlatform && community ? { community } : {};
    api(endpoint, { params })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [endpoint, community, isPlatform, needsCommunity, scoped, tick]);

  const reload = () => setTick((t) => t + 1);
  const picker = scoped && isPlatform ? <CommunityPicker value={community} onChange={setCommunity} allowAll={opts.allowAll} /> : null;
  const body = error ? (
    <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>
  ) : needsCommunity && !community ? (
    <div className="rounded-lg bg-white p-6 text-sm text-slate shadow-card">Select a community to view this dashboard.</div>
  ) : !data ? (
    <Spinner />
  ) : null;

  return { data, error, picker, body, community, isPlatform, reload };
}
