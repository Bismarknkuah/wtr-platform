"use client";
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { MAINT_TYPE } from "@/lib/options";
import { date, ghs, today } from "@/lib/format";
export default function MaintenancePage() {
  return (
    <ResourcePage
      endpoint="/api/maintenance/"
      title="Maintenance"
      subtitle="Logging a job reschedules the asset's next maintenance automatically."
      createPerm="RECORD_MAINTENANCE"
      editPerm="RECORD_MAINTENANCE"
      createLabel="Log maintenance"
      ordering="-performed_on"
      filters={[
        { name: "maintenance_type", label: "Type", options: MAINT_TYPE },
        { name: "was_failure", label: "Failure", options: [{ value: "true", label: "Failures only" }] },
      ]}
      columns={[
        { key: "performed_on", label: "Date", render: (r) => date(r.performed_on) },
        {
          key: "asset_name",
          label: "Asset",
          render: (r) => (
            <div>
              <b>{r.asset_name}</b>
              <div className="text-xs text-slate">{r.asset_code}</div>
            </div>
          ),
        },
        { key: "maintenance_type", label: "Type", render: (r) => <Badge value={r.maintenance_type} /> },
        {
          key: "description",
          label: "Work done",
          render: (r) => (
            <span className="text-sm">
              {r.description}
              {r.was_failure && <div className="text-xs text-bad">Failure: {r.failure_cause}</div>}
            </span>
          ),
        },
        { key: "technician_label", label: "Technician" },
        { key: "cost", label: "Cost", render: (r) => ghs(r.cost) },
        { key: "downtime_hours", label: "Downtime (h)" },
      ]}
      fields={[
        {
          name: "asset",
          label: "Asset",
          type: "lookup",
          required: true,
          lookup: { endpoint: "/api/assets/", labelKey: (r: any) => `${r.name} (${r.asset_id})` },
        },
        { name: "maintenance_type", label: "Type", type: "select", options: MAINT_TYPE, defaultValue: "PREVENTIVE" },
        { name: "performed_on", label: "Performed on", type: "date", defaultValue: today, required: true },
        {
          name: "technician",
          label: "Technician (staff)",
          type: "lookup",
          lookup: { endpoint: "/api/auth/users/", labelKey: "full_name", params: { role: "TECHNICIAN" } },
        },
        { name: "technician_name", label: "External technician / contractor" },
        { name: "cost", label: "Cost (GHS)", type: "number", step: "0.01", defaultValue: 0 },
        { name: "downtime_hours", label: "Downtime (hours)", type: "number", step: "0.5", defaultValue: 0 },
        { name: "was_failure", label: "This was a failure / breakdown", type: "checkbox" },
        { name: "failure_cause", label: "Failure cause" },
        { name: "description", label: "Description of work", type: "textarea", required: true, span: 2 },
        { name: "parts_used", label: "Parts used", type: "textarea", span: 2 },
      ]}
    />
  );
}
