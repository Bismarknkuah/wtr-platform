"use client";
/** Reading routes — group households and assign to a meter reader. */
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
export default function RoutesPage() {
  return (
    <ResourcePage
      endpoint="/api/routes/"
      title="Reading routes"
      subtitle="Each route is a reader's walking list. Customers on the route appear in the reader's mobile dashboard."
      createPerm="MANAGE_METERS"
      editPerm="MANAGE_METERS"
      createLabel="New route"
      columns={[
        { key: "name", label: "Route", render: (r) => <b>{r.name}</b> },
        { key: "reader_name", label: "Reader", render: (r) => r.reader_name || <span className="text-slate">unassigned</span> },
        { key: "customers_count", label: "Households" },
        { key: "schedule_note", label: "Schedule" },
        { key: "is_active", label: "", render: (r) => <Badge value={r.is_active ? "ACTIVE" : "INACTIVE"} /> },
      ]}
      transform={(d) => {
        if (typeof d.customers === "string")
          d.customers = d.customers
            .split(",")
            .map((x: string) => parseInt(x.trim()))
            .filter((x: number) => !isNaN(x));
        return d;
      }}
      fields={[
        { name: "name", label: "Route name", required: true },
        {
          name: "reader",
          label: "Meter reader",
          type: "lookup",
          lookup: {
            endpoint: "/api/auth/users/",
            labelKey: (r: any) => `${r.full_name} (${r.email})`,
            params: { role: "METER_READER", is_active: true },
          },
        },
        { name: "schedule_note", label: "Schedule note", hint: "e.g. 1st–3rd of every month" },
        { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
        {
          name: "customers",
          label: "Customer IDs on this route",
          type: "textarea",
          span: 2,
          hint: "Comma-separated internal customer IDs (the number in the customer page URL). Tip: filter the Customers page by area, then paste the IDs.",
        },
      ]}
    />
  );
}
