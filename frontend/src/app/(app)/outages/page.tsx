"use client";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { OUTAGE_STATUS } from "@/lib/options";
import { datetime, num } from "@/lib/format";
export default function OutagesPage() {
  const { can } = useAuth();
  const restore = async (h: any, r: any) => {
    if (!window.confirm("Mark supply as restored and notify affected customers?")) return;
    try {
      await h.api(`/api/outages/${r.id}/restore/`, { body: {} });
      h.toast("Outage restored — customers notified");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/outages/"
      title="Outages"
      subtitle="Declaring an outage notifies every active customer by SMS/portal; restoring it tells them the water is back."
      createPerm="MANAGE_OUTAGES"
      editPerm="MANAGE_OUTAGES"
      createLabel="Declare outage"
      ordering="-started_at"
      search={false}
      filters={[{ name: "status", label: "Status", options: OUTAGE_STATUS }]}
      columns={[
        { key: "affected_area", label: "Area", render: (r) => <b>{r.affected_area || "Whole community"}</b> },
        {
          key: "cause",
          label: "Cause",
          render: (r) => (
            <div>
              {r.cause}
              <div className="text-xs text-slate">{r.asset_name}</div>
            </div>
          ),
        },
        { key: "started_at", label: "Started", render: (r) => datetime(r.started_at) },
        { key: "expected_restoration", label: "Expected back", render: (r) => datetime(r.expected_restoration) },
        { key: "restored_at", label: "Restored", render: (r) => datetime(r.restored_at) },
        { key: "customers_notified", label: "Notified", render: (r) => num(r.customers_notified) },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      rowActions={(r, h) =>
        can("MANAGE_OUTAGES") && r.status === "ACTIVE" ? (
          <Button size="sm" variant="ok" onClick={() => restore(h, r)}>
            Restore
          </Button>
        ) : null
      }
      fields={[
        { name: "cause", label: "Cause", required: true, span: 2 },
        { name: "affected_area", label: "Affected area", hint: "Zone, street or 'whole community'" },
        {
          name: "asset",
          label: "Related asset",
          type: "lookup",
          lookup: { endpoint: "/api/assets/", labelKey: (r: any) => `${r.name} (${r.asset_id})` },
        },
        { name: "started_at", label: "Started at", type: "datetime", required: true },
        { name: "expected_restoration", label: "Expected restoration", type: "datetime" },
        { name: "notify_customers", label: "Notify customers now", type: "checkbox", defaultValue: true },
        { name: "notes", label: "Notes", type: "textarea", span: 2 },
      ]}
    />
  );
}
