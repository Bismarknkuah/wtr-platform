"use client";
/** Data hook and shared widgets for the three platform-role dashboards. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Table, useToast } from "@/components/ui";
import { date, num, title } from "@/lib/format";

export function usePlatformData() {
  const [d, setD] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api("/api/dashboard/platform/")
      .then(setD)
      .catch((e) => setErr(e.message));
    api("/api/dashboard/activity/", { params: { limit: 12 } })
      .then(setFeed)
      .catch(() => setFeed([]));
  }, [tick]);
  return { d, feed, err, reload: () => setTick((t) => t + 1) };
}

/** Pending registrations table with one-click approve — shared by the super admin and ops admin. */
export function PendingRegistrations({ d, reload, canApprove }: { d: any; reload: () => void; canApprove: boolean }) {
  const { push } = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const approve = async (c: any) => {
    if (!window.confirm(`Approve ${c.name}? It goes live immediately; you then create its community admin.`)) return;
    setBusy(c.id);
    try {
      await api(`/api/communities/${c.id}/approve/`, { body: {} });
      push(`${c.name} approved — now create its community admin under Users & roles`);
      reload();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(null);
    }
  };
  return (
    <Table
      rows={d.pending}
      columns={[
        {
          key: "name",
          label: "Community (district utility)",
          render: (r) => (
            <Link href={`/communities/${r.id}`} className="font-semibold text-river">
              {r.name}
              <div className="text-xs font-normal text-slate">
                {r.district}, {r.region} · {title(r.water_system_type)}
              </div>
            </Link>
          ),
        },
        { key: "households_count", label: "Households (declared)", render: (r) => num(r.households_count) },
        { key: "towns", label: "Towns", render: (r) => num(r.towns) },
        {
          key: "contact_name",
          label: "Contact",
          render: (r) => (
            <div>
              {r.contact_name || "—"}
              <div className="text-xs text-slate">{r.contact_phone}</div>
            </div>
          ),
        },
        { key: "registration_date", label: "Registered", render: (r) => date(r.registration_date) },
        {
          key: "__a",
          label: "",
          className: "text-right",
          render: (r) =>
            canApprove ? (
              <Button size="sm" variant="ok" loading={busy === r.id} onClick={() => approve(r)}>
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            ) : null,
        },
      ]}
      empty={<div className="py-8 text-center text-sm text-slate">No registrations waiting.</div>}
    />
  );
}
