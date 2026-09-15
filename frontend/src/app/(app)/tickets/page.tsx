"use client";
/** Service requests (staff view). */
import { useSearchParams } from "next/navigation";
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { PRIORITY, TICKET_CATEGORY, TICKET_STATUS } from "@/lib/options";
import { datetime, title } from "@/lib/format";
export default function TicketsPage() {
  const sp = useSearchParams();
  const extra: Record<string, any> = {};
  ["status", "assigned_to"].forEach((k) => {
    const v = sp.get(k);
    if (v) extra[k] = v;
  });
  return (
    <ResourcePage
      endpoint="/api/tickets/"
      title="Service requests"
      subtitle="Leaks, no-water reports, meter faults, bill disputes, new connections."
      createPerm="CREATE_TICKET"
      createLabel="New request"
      ordering="-created_at"
      extraParams={extra}
      rowHref={(r) => `/tickets/${r.id}`}
      filters={[
        { name: "status", label: "Status", options: TICKET_STATUS },
        { name: "priority", label: "Priority", options: PRIORITY },
        { name: "category", label: "Category", options: TICKET_CATEGORY },
        { name: "town", label: "Town", lookup: { endpoint: "/api/towns/", labelKey: "name" } },
        {
          name: "source",
          label: "Source",
          options: [
            { value: "STAFF", label: "Staff" },
            { value: "PORTAL", label: "Customer portal" },
            { value: "PUBLIC", label: "Public link / QR" },
          ],
        },
      ]}
      columns={[
        { key: "ticket_number", label: "Ticket", render: (r) => <b className="text-river">{r.ticket_number}</b> },
        {
          key: "title",
          label: "Issue",
          render: (r) => (
            <div>
              {r.title}
              <div className="text-xs text-slate">
                {title(r.category)}
                {r.location ? ` · ${r.location}` : ""}
              </div>
            </div>
          ),
        },
        {
          key: "customer_name",
          label: "Customer",
          render: (r) =>
            r.customer_name ? (
              <div>
                {r.customer_name}
                <div className="text-xs text-slate">{r.customer_code}</div>
              </div>
            ) : r.source === "PUBLIC" ? (
              <div>
                <span className="text-ink">{r.reporter_name || "Anonymous"}</span>
                <div className="text-xs text-slate">{r.reporter_phone || "no phone"} · public report</div>
              </div>
            ) : (
              "—"
            ),
        },
        {
          key: "town_name",
          label: "Where",
          render: (r) => (
            <div>
              {r.town_name || <span className="text-slate">—</span>}
              {r.location && <div className="max-w-[180px] truncate text-xs text-slate">{r.location}</div>}
            </div>
          ),
        },
        { key: "assigned_to_name", label: "Assigned", render: (r) => r.assigned_to_name || <span className="text-slate">unassigned</span> },
        { key: "priority", label: "Priority", render: (r) => <Badge value={r.priority} /> },
        { key: "created_at", label: "Raised", render: (r) => datetime(r.created_at) },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      fields={[
        { name: "title", label: "Title", required: true, span: 2 },
        { name: "category", label: "Category", type: "select", options: TICKET_CATEGORY, defaultValue: "OTHER", required: true },
        { name: "priority", label: "Priority", type: "select", options: PRIORITY, defaultValue: "MEDIUM" },
        {
          name: "customer",
          label: "Customer",
          type: "lookup",
          lookup: { endpoint: "/api/customers/", labelKey: (r: any) => `${r.household_name} · ${r.customer_id}` },
        },
        { name: "location", label: "Location" },
        { name: "description", label: "Description", type: "textarea", required: true, span: 2 },
      ]}
    />
  );
}
