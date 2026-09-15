"use client";
/** Customers / households register. */
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { CATEGORIES, CUSTOMER_STATUS } from "@/lib/options";
import { ghs, title } from "@/lib/format";
const RISK = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];
export default function CustomersPage() {
  return (
    <ResourcePage
      endpoint="/api/customers/"
      title="Customers"
      subtitle="Households, businesses and institutions connected to the water system."
      createPerm="CREATE_CUSTOMER"
      editPerm="EDIT_CUSTOMER"
      deletePerm="DELETE_CUSTOMER"
      createLabel="Register customer"
      ordering="-created_at"
      rowHref={(r) => `/customers/${r.id}`}
      filters={[
        { name: "category", label: "Category", options: CATEGORIES },
        { name: "town", label: "Town", lookup: { endpoint: "/api/towns/", labelKey: "name" } },
        { name: "account_status", label: "Status", options: CUSTOMER_STATUS },
        { name: "risk_level", label: "Risk", options: RISK },
      ]}
      columns={[
        {
          key: "household_name",
          label: "Customer",
          render: (r) => (
            <div>
              <b>{r.household_name}</b>
              <div className="text-xs text-slate">
                {r.customer_id} · {r.contact_person}
              </div>
            </div>
          ),
        },
        { key: "phone", label: "Phone" },
        { key: "category", label: "Category", render: (r) => title(r.category) },
        {
          key: "meter",
          label: "Meter",
          render: (r) =>
            r.meter ? (
              <span>
                {r.meter.meter_id} <Badge value={r.meter.status} />
              </span>
            ) : (
              <span className="text-slate">none</span>
            ),
        },
        { key: "tariff_plan_name", label: "Tariff", render: (r) => r.tariff_plan_name || <span className="text-slate">default</span> },
        {
          key: "outstanding_balance",
          label: "Balance",
          render: (r) => (
            <span
              className={`font-bold tabular-nums ${Number(r.outstanding_balance) > 0 ? "text-bad" : Number(r.outstanding_balance) < 0 ? "text-ok" : ""}`}
            >
              {ghs(r.outstanding_balance)}
            </span>
          ),
        },
        { key: "risk_level", label: "Risk", render: (r) => <Badge value={r.risk_level} /> },
        { key: "account_status", label: "Status", render: (r) => <Badge value={r.account_status} /> },
      ]}
      fields={[
        { name: "household_name", label: "Household / business name", required: true },
        { name: "contact_person", label: "Contact person", required: true },
        { name: "phone", label: "Phone", required: true },
        { name: "alternative_phone", label: "Alternative phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, defaultValue: "RESIDENTIAL", required: true },
        {
          name: "town",
          label: "Town",
          type: "lookup",
          lookup: { endpoint: "/api/towns/", labelKey: "name" },
          hint: "Which town / zone of the community",
        },
        {
          name: "property",
          label: "Property",
          type: "lookup",
          lookup: { endpoint: "/api/properties/", labelKey: (r: any) => `${r.property_id} · ${r.address}` },
        },
        {
          name: "tariff_plan",
          label: "Tariff plan",
          type: "lookup",
          lookup: { endpoint: "/api/tariffs/", labelKey: (r: any) => `${r.name} (${r.scope})`, params: { is_active: true } },
          hint: "Blank = the default plan for the category",
        },
        { name: "address", label: "Address", span: 2 },
        { name: "occupants", label: "Occupants", type: "number", defaultValue: 1 },
        { name: "connection_date", label: "Connection date", type: "date" },
        { name: "latitude", label: "Latitude", type: "number", step: "0.000001" },
        { name: "longitude", label: "Longitude", type: "number", step: "0.000001" },
        { name: "account_status", label: "Account status", type: "select", options: CUSTOMER_STATUS, defaultValue: "ACTIVE" },
        { name: "notes", label: "Notes", type: "textarea", span: 2 },
      ]}
    />
  );
}
