"use client";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { EMERGENCY_STATUS, EMERGENCY_TYPE, SEVERITY } from "@/lib/options";
import { datetime, title } from "@/lib/format";
export default function EmergenciesPage() {
  const { can } = useAuth();
  const resolve = async (h: any, r: any) => {
    const notes = window.prompt("Response / resolution notes:");
    if (notes === null) return;
    try {
      await h.api(`/api/emergencies/${r.id}/resolve/`, { body: { response_notes: notes } });
      h.toast("Emergency resolved");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/emergencies/"
      title="Emergencies"
      subtitle="Pipeline bursts, pump failures, contamination, shortages. Declaring one alerts community staff immediately."
      createPerm="MANAGE_EMERGENCIES"
      editPerm="MANAGE_EMERGENCIES"
      createLabel="Declare emergency"
      ordering="-declared_at"
      search={false}
      filters={[
        { name: "status", label: "Status", options: EMERGENCY_STATUS },
        { name: "severity", label: "Severity", options: SEVERITY },
        { name: "emergency_type", label: "Type", options: EMERGENCY_TYPE },
      ]}
      columns={[
        {
          key: "title",
          label: "Emergency",
          render: (r) => (
            <div>
              <b>{r.title}</b>
              <div className="text-xs text-slate">
                {title(r.emergency_type)} · declared by {r.declared_by_name}
              </div>
            </div>
          ),
        },
        { key: "severity", label: "Severity", render: (r) => <Badge value={r.severity} /> },
        { key: "declared_at", label: "Declared", render: (r) => datetime(r.declared_at) },
        { key: "resolved_at", label: "Resolved", render: (r) => datetime(r.resolved_at) },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      rowActions={(r, h) =>
        can("MANAGE_EMERGENCIES") && r.status !== "RESOLVED" ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await h.api(`/api/emergencies/${r.id}/`, { method: "PATCH", body: { status: "RESPONDING" } });
                h.reload();
              }}
            >
              Responding
            </Button>
            <Button size="sm" variant="ok" onClick={() => resolve(h, r)}>
              Resolve
            </Button>
          </>
        ) : null
      }
      fields={[
        { name: "title", label: "Title", required: true, span: 2 },
        { name: "emergency_type", label: "Type", type: "select", options: EMERGENCY_TYPE, required: true },
        { name: "severity", label: "Severity", type: "select", options: SEVERITY, defaultValue: "HIGH" },
        { name: "description", label: "What happened / where", type: "textarea", required: true, span: 2 },
      ]}
    />
  );
}
