"use client";
/** Customer portal — my service requests + raise a new one. */
import ResourcePage from "@/components/ResourcePage";
import { Badge } from "@/components/ui";
import { TICKET_CATEGORY } from "@/lib/options";
import { datetime, title } from "@/lib/format";
export default function PortalRequests() {
  return (
    <ResourcePage
      endpoint="/api/tickets/"
      title="My requests"
      subtitle="Report a leak, no water, a faulty meter or a billing question. We'll keep you updated here and by SMS."
      createLabel="New request"
      ordering="-created_at"
      search={false}
      scoped={false}
      rowHref={(r) => `/tickets/${r.id}`}
      columns={[
        { key: "ticket_number", label: "Ticket", render: (r) => <b className="text-river">{r.ticket_number}</b> },
        {
          key: "title",
          label: "Issue",
          render: (r) => (
            <div>
              {r.title}
              <div className="text-xs text-slate">{title(r.category)}</div>
            </div>
          ),
        },
        { key: "created_at", label: "Raised", render: (r) => datetime(r.created_at) },
        { key: "assigned_to_name", label: "Handled by", render: (r) => r.assigned_to_name || "—" },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      fields={[
        {
          name: "category",
          label: "What is it about?",
          type: "select",
          options: TICKET_CATEGORY.filter((o) => !["DISCONNECTION"].includes(String(o.value))),
          defaultValue: "LEAK",
          required: true,
        },
        { name: "title", label: "Short title", required: true },
        { name: "location", label: "Where exactly?", span: 2 },
        { name: "description", label: "Describe the problem", type: "textarea", required: true, span: 2 },
      ]}
    />
  );
}
