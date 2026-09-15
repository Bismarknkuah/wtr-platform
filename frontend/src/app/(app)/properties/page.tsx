"use client";
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { CATEGORIES } from "@/lib/options";
export default function PropertiesPage() {
  return (
    <ResourcePage
      endpoint="/api/properties/"
      title="Properties"
      subtitle="Physical premises that customers and meters attach to."
      createPerm="CREATE_CUSTOMER"
      editPerm="EDIT_CUSTOMER"
      filters={[{ name: "property_type", label: "Type", options: CATEGORIES }]}
      columns={[
        { key: "property_id", label: "ID", render: (r) => <b>{r.property_id}</b> },
        {
          key: "address",
          label: "Address",
          render: (r) => (
            <div>
              {r.address}
              <div className="text-xs text-slate">{r.landmark}</div>
            </div>
          ),
        },
        { key: "property_type", label: "Type", render: (r) => <Badge value={r.property_type} /> },
        { key: "latitude", label: "GPS", render: (r) => (r.latitude ? `${r.latitude}, ${r.longitude}` : "—") },
      ]}
      fields={[
        { name: "address", label: "Address", required: true, span: 2 },
        { name: "landmark", label: "Landmark" },
        { name: "property_type", label: "Type", type: "select", options: CATEGORIES, defaultValue: "RESIDENTIAL" },
        { name: "latitude", label: "Latitude", type: "number", step: "0.000001" },
        { name: "longitude", label: "Longitude", type: "number", step: "0.000001" },
        { name: "notes", label: "Notes", type: "textarea", span: 2 },
      ]}
    />
  );
}
