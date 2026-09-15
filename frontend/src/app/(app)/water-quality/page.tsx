"use client";
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { COMPLIANCE } from "@/lib/options";
import { date, today } from "@/lib/format";
export default function WaterQualityPage() {
  return (
    <ResourcePage
      endpoint="/api/water-quality/"
      title="Water quality"
      subtitle="Results are graded automatically against WHO / Ghana Standards Authority limits: pH 6.5–8.5, turbidity ≤ 5 NTU, chlorine 0.2–5 mg/L, TDS ≤ 1000 mg/L, E. coli 0."
      createPerm="MANAGE_WATER_QUALITY"
      editPerm="MANAGE_WATER_QUALITY"
      createLabel="Record test"
      ordering="-tested_on"
      filters={[{ name: "compliance_status", label: "Result", options: COMPLIANCE }]}
      columns={[
        { key: "tested_on", label: "Date", render: (r) => date(r.tested_on) },
        {
          key: "testing_location",
          label: "Location",
          render: (r) => (
            <div>
              {r.testing_location}
              <div className="text-xs text-slate">{r.laboratory}</div>
            </div>
          ),
        },
        { key: "ph", label: "pH", render: (r) => r.ph ?? "—" },
        { key: "turbidity_ntu", label: "Turbidity", render: (r) => r.turbidity_ntu ?? "—" },
        { key: "chlorine_mg_l", label: "Chlorine", render: (r) => r.chlorine_mg_l ?? "—" },
        { key: "tds_mg_l", label: "TDS", render: (r) => r.tds_mg_l ?? "—" },
        { key: "ecoli_cfu", label: "E. coli", render: (r) => r.ecoli_cfu ?? "—" },
        {
          key: "issues",
          label: "Issues",
          render: (r) =>
            r.issues?.length ? (
              <ul className="text-xs text-bad">
                {r.issues.map((i: string) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-ok">Within limits</span>
            ),
        },
        { key: "compliance_status", label: "Result", render: (r) => <Badge value={r.compliance_status} /> },
      ]}
      fields={[
        { name: "testing_location", label: "Sampling point", required: true },
        { name: "tested_on", label: "Tested on", type: "date", defaultValue: today, required: true },
        { name: "laboratory", label: "Laboratory" },
        {
          name: "asset",
          label: "Source asset",
          type: "lookup",
          lookup: { endpoint: "/api/assets/", labelKey: (r: any) => `${r.name} (${r.asset_id})` },
        },
        { name: "ph", label: "pH", type: "number", step: "0.01" },
        { name: "turbidity_ntu", label: "Turbidity (NTU)", type: "number", step: "0.01" },
        { name: "chlorine_mg_l", label: "Residual chlorine (mg/L)", type: "number", step: "0.001" },
        { name: "tds_mg_l", label: "TDS (mg/L)", type: "number", step: "0.01" },
        { name: "temperature_c", label: "Temperature (°C)", type: "number", step: "0.1" },
        { name: "ecoli_cfu", label: "E. coli (CFU/100 ml)", type: "number" },
        { name: "coliform_cfu", label: "Total coliform (CFU/100 ml)", type: "number" },
        { name: "result_summary", label: "Summary / remarks", type: "textarea", span: 2 },
      ]}
    />
  );
}
