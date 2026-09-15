"use client";
import ResourcePage from "@/components/ResourcePage";
import { date, m3, today } from "@/lib/format";
export default function ProductionPage() {
  return (
    <ResourcePage
      endpoint="/api/water-production/"
      title="Water production"
      subtitle="Daily volume pumped into the network. Production minus billed consumption = non-revenue water."
      createPerm="MANAGE_INFRASTRUCTURE"
      editPerm="MANAGE_INFRASTRUCTURE"
      createLabel="Log production"
      search={false}
      ordering="-date"
      columns={[
        { key: "date", label: "Date", render: (r) => date(r.date) },
        { key: "volume_m3", label: "Volume", render: (r) => <b>{m3(r.volume_m3)}</b> },
        { key: "pump_hours", label: "Pump hours", render: (r) => r.pump_hours ?? "—" },
        { key: "notes", label: "Notes" },
      ]}
      fields={[
        { name: "date", label: "Date", type: "date", defaultValue: today, required: true },
        { name: "volume_m3", label: "Volume produced (m³)", type: "number", step: "0.01", required: true },
        {
          name: "asset",
          label: "Source asset",
          type: "lookup",
          lookup: { endpoint: "/api/assets/", labelKey: (r: any) => `${r.name} (${r.asset_id})` },
        },
        { name: "pump_hours", label: "Pump hours", type: "number", step: "0.1" },
        { name: "notes", label: "Notes", span: 2 },
      ]}
    />
  );
}
