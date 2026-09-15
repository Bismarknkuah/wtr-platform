"use client";
/** Users & roles. Platform staff create platform accounts and each community's first admin; that admin creates the rest of the community's staff. */
import { useEffect, useState } from "react";
import ResourcePage from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { COMMUNITY_ROLES, PLATFORM_CREATABLE_ROLES } from "@/lib/options";
import { datetime, title } from "@/lib/format";
export default function UsersPage() {
  const { isPlatform, can } = useAuth();
  // Custom roles defined by this community under System settings → Custom roles. They appear in the
  // role picker as "custom:<id>" and are sent to the API as role=CUSTOM + custom_role=<id>.
  const [customRoles, setCustomRoles] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    if (isPlatform) return;
    api("/api/community-roles/", { params: { is_active: true, page_size: 100 } })
      .then((d) => setCustomRoles((d.results || d).map((r: any) => ({ value: `custom:${r.id}`, label: `${r.name} (custom)` }))))
      .catch(() => setCustomRoles([]));
  }, [isPlatform]);
  const roleOptions = isPlatform ? PLATFORM_CREATABLE_ROLES : [...COMMUNITY_ROLES.filter((r) => r.value !== "CUSTOM"), ...customRoles];
  const reset = async (h: any, r: any) => {
    const pwd = window.prompt(`New password for ${r.full_name}:`);
    if (!pwd) return;
    try {
      await h.api(`/api/auth/users/${r.id}/reset_password/`, { body: { password: pwd } });
      h.toast("Password reset");
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/auth/users/"
      title="Users & roles"
      subtitle={
        isPlatform
          ? "Platform accounts and each community's admin. Community staff are managed inside the community."
          : "Staff accounts and the role that decides what each person can see and do."
      }
      createPerm="MANAGE_USERS"
      editPerm="MANAGE_USERS"
      transform={(data) => {
        const { role_pick, ...rest } = data;
        if (typeof role_pick === "string" && role_pick.startsWith("custom:"))
          return { ...rest, role: "CUSTOM", custom_role: Number(role_pick.split(":")[1]) };
        return { ...rest, role: role_pick, custom_role: null };
      }}
      createLabel="Add user"
      ordering="-date_joined"
      filters={[
        { name: "role", label: "Role", options: isPlatform ? PLATFORM_CREATABLE_ROLES : COMMUNITY_ROLES },
        {
          name: "is_active",
          label: "Active",
          options: [
            { value: "true", label: "Active" },
            { value: "false", label: "Disabled" },
          ],
        },
      ]}
      columns={[
        {
          key: "full_name",
          label: "Name",
          render: (r) => (
            <div>
              <b>{r.full_name}</b>
              <div className="text-xs text-slate">
                {r.email}
                {r.phone ? ` · ${r.phone}` : ""}
              </div>
            </div>
          ),
        },
        {
          key: "role",
          label: "Role",
          render: (r) => (
            <span>
              {r.role_label || title(r.role)}
              {r.role === "CUSTOM" && <Badge value="CUSTOM" className="ml-1 !bg-river-soft !text-river" />}
            </span>
          ),
        },
        ...(isPlatform
          ? [
              {
                key: "community_name",
                label: "Community",
                render: (r: any) => r.community_name || <span className="text-slate">Platform</span>,
              },
            ]
          : []),
        { key: "last_login", label: "Last login", render: (r) => datetime(r.last_login) },
        { key: "is_active", label: "", render: (r) => <Badge value={r.is_active ? "ACTIVE" : "INACTIVE"} /> },
      ]}
      rowActions={(r, h) =>
        can("MANAGE_USERS") ? (
          <Button size="sm" variant="ghost" onClick={() => reset(h, r)}>
            Reset password
          </Button>
        ) : null
      }
      fields={[
        { name: "full_name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone" },
        {
          name: "role_pick",
          label: "Role",
          type: "select",
          options: roleOptions,
          required: true,
          hint: isPlatform ? undefined : "Built-in roles, plus any custom roles you created under System settings",
          fromRow: (row) => (row.role === "CUSTOM" && row.custom_role ? `custom:${row.custom_role}` : row.role),
        },
        ...(isPlatform
          ? [
              {
                name: "community",
                label: "Community (for a Community Admin)",
                type: "lookup" as const,
                lookup: { endpoint: "/api/communities/", labelKey: (c: any) => `${c.name} · ${c.code}`, scoped: false },
                hint: "Leave empty for platform accounts",
              },
            ]
          : []),
        { name: "password", label: "Password", hint: "Leave blank when editing to keep the current password" },
        { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
      ]}
    />
  );
}
