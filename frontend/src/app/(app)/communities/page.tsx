"use client";
/** Communities — platform registry, approval, suspension. Community admins land on their own community page. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { COMMUNITY_STATUS, REGIONS, SYSTEM_TYPE } from "@/lib/options";
import { num, date } from "@/lib/format";

export default function CommunitiesPage() {
  const { user, isPlatform, can } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user && !isPlatform && user.community) router.replace(`/communities/${user.community}`);
  }, [user, isPlatform, router]);
  if (!user || !isPlatform) return null;
  const act = async (h: any, row: any, a: string) => {
    try {
      await h.api(`/api/communities/${row.id}/${a}/`, { body: {} });
      h.toast(`Community ${a}d`);
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/communities/"
      title="Communities"
      subtitle="Each community is an isolated tenant with its own customers, tariffs, bills and staff."
      scoped={false}
      createPerm="MANAGE_COMMUNITIES"
      editPerm="MANAGE_COMMUNITIES"
      createLabel="Register community"
      ordering="-created_at"
      rowHref={(r) => `/communities/${r.id}`}
      filters={[
        { name: "service_status", label: "Status", options: COMMUNITY_STATUS },
        { name: "region", label: "Region", options: REGIONS },
        { name: "water_system_type", label: "System", options: SYSTEM_TYPE },
      ]}
      columns={[
        {
          key: "name",
          label: "Community",
          render: (r) => (
            <div>
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-slate">{r.code}</div>
            </div>
          ),
        },
        {
          key: "region",
          label: "Region / district",
          render: (r) => (
            <div>
              {r.region}
              <div className="text-xs text-slate">{r.district}</div>
            </div>
          ),
        },
        { key: "water_system_type", label: "System", render: (r) => <Badge value={r.water_system_type} /> },
        { key: "customers_total", label: "Customers", render: (r) => num(r.customers_total) },
        { key: "active_meters", label: "Active meters", render: (r) => num(r.active_meters) },
        {
          key: "admin_name",
          label: "Admin",
          render: (r) =>
            r.admin_name ? (
              <div>
                {r.admin_name}
                <div className="text-xs text-slate">{r.admin_email}</div>
              </div>
            ) : (
              <span className="text-slate">—</span>
            ),
        },
        { key: "registration_date", label: "Registered", render: (r) => date(r.registration_date) },
        { key: "service_status", label: "Status", render: (r) => <Badge value={r.service_status} /> },
      ]}
      rowActions={(r, h) =>
        can("APPROVE_COMMUNITIES") ? (
          <>
            {r.service_status === "PENDING" && (
              <Button size="sm" variant="ok" onClick={() => act(h, r, "approve")}>
                Approve
              </Button>
            )}
            {r.service_status === "ACTIVE" && (
              <Button size="sm" variant="ghost" className="!text-warn" onClick={() => act(h, r, "suspend")}>
                Suspend
              </Button>
            )}
            {r.service_status === "SUSPENDED" && (
              <Button size="sm" variant="ghost" onClick={() => act(h, r, "activate")}>
                Reactivate
              </Button>
            )}
          </>
        ) : null
      }
      fields={[
        { name: "name", label: "Community name", required: true },
        { name: "water_system_type", label: "Water system type", type: "select", options: SYSTEM_TYPE, defaultValue: "PIPED" },
        { name: "region", label: "Region", type: "select", options: REGIONS, required: true },
        { name: "district", label: "District", required: true },
        { name: "municipality", label: "Municipality / assembly" },
        { name: "town", label: "Town" },
        { name: "water_source", label: "Water source", hint: "e.g. Borehole field, River intake" },
        { name: "households_count", label: "Estimated households", type: "number" },
        { name: "contact_name", label: "Contact person" },
        { name: "contact_phone", label: "Contact phone" },
        { name: "contact_email", label: "Contact email", type: "email" },
        {
          name: "subscription_plan",
          label: "Subscription plan",
          type: "lookup",
          lookup: { endpoint: "/api/plans/", labelKey: "name", scoped: false },
        },
        { name: "latitude", label: "Latitude", type: "number", step: "0.000001" },
        { name: "longitude", label: "Longitude", type: "number", step: "0.000001" },
        { name: "notes", label: "Notes", type: "textarea", span: 2 },
      ]}
    />
  );
}
