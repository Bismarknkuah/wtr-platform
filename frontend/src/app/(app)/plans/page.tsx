"use client";
/** Subscription plans (platform). */
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { ghs, num } from "@/lib/format";
export default function PlansPage() {
  return (
    <ResourcePage
      endpoint="/api/plans/"
      title="Subscription plans"
      subtitle="Commercial packaging for communities on the platform."
      scoped={false}
      createPerm="MANAGE_PLANS"
      editPerm="MANAGE_PLANS"
      search={false}
      columns={[
        { key: "name", label: "Plan", render: (r) => <b>{r.name}</b> },
        { key: "monthly_price", label: "Monthly price", render: (r) => ghs(r.monthly_price) },
        { key: "max_customers", label: "Max customers", render: (r) => num(r.max_customers) },
        { key: "max_staff", label: "Max staff" },
        { key: "communities_count", label: "Communities" },
        { key: "is_active", label: "", render: (r) => <Badge value={r.is_active ? "ACTIVE" : "INACTIVE"} /> },
      ]}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "monthly_price", label: "Monthly price (GHS)", type: "number", step: "0.01" },
        { name: "max_customers", label: "Max customers", type: "number", defaultValue: 1000 },
        { name: "max_staff", label: "Max staff", type: "number", defaultValue: 20 },
        { name: "description", label: "Description", type: "textarea", span: 2 },
        { name: "features", label: "Features (JSON list)", type: "json", span: 2, hint: '["SMS receipts", "Analytics"]' },
        { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
      ]}
    />
  );
}
