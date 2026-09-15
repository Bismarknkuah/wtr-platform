"use client";
/**
 * System settings (Community Admin).
 *
 *   1. Feature access by role — roles × modules matrix with tick-all / untick-all for the whole
 *      grid, per role and per module. Built-in roles and the community's own custom roles both
 *      appear. Unticking takes the module away from that role in THIS community only; the server
 *      recomputes effective permissions on every request.
 *   2. Custom roles — the admin creates roles with any name ("Zone supervisor", "Board member")
 *      and ticks the modules they may use; staff are then assigned the role under Users & roles.
 *   3. Community-wide switches — customer portal, online payments, self-service requests, usage charts.
 *
 * The admin's own role is never restricted, so the community can always be administered.
 * Data: GET/PATCH /api/communities/{id}/features/ · /api/community-roles/
 */
import { useEffect, useMemo, useState } from "react";
import { Check, CheckSquare, Pencil, Plus, RotateCcw, Save, ShieldCheck, Square, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, Tabs, useToast } from "@/components/ui";
import { SectionTitle } from "@/components/dashboard/widgets";

type Module = { key: string; label: string; group: string; perms: string[] };
type RoleRow = {
  key: string;
  label: string;
  builtin: boolean;
  default_modules: string[];
  custom_role_id?: number;
  users?: number;
  description?: string;
};

const FLAG_LABELS: Record<string, { label: string; help: string }> = {
  customer_portal_enabled: { label: "Customer portal", help: "Households can sign in to see bills, usage and notices." },
  online_payments_enabled: {
    label: "Online payments",
    help: "Households can pay by MoMo / card from the portal. Office and agent payments are unaffected.",
  },
  customer_requests_enabled: {
    label: "Self-service requests",
    help: "Households can raise leak / no-water / dispute requests themselves.",
  },
  show_usage_to_customers: { label: "Usage charts for households", help: "Show consumption history in the portal." },
};

/* ---------------------------------------------------------------------------------------------- */
/* Custom role editor                                                                             */
/* ---------------------------------------------------------------------------------------------- */

function RoleEditor({
  modules,
  groups,
  initial,
  onClose,
  onSaved,
}: {
  modules: Module[];
  groups: [string, Module[]][];
  initial?: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [picked, setPicked] = useState<Set<string>>(new Set(initial?.modules || []));
  const [busy, setBusy] = useState(false);
  const toggle = (k: string) => {
    const n = new Set(picked);
    n.has(k) ? n.delete(k) : n.add(k);
    setPicked(n);
  };
  const save = async (e: any) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const body = { name: name.trim(), description, modules: [...picked] };
      if (initial?.id) await api(`/api/community-roles/${initial.id}/`, { method: "PATCH", body });
      else await api("/api/community-roles/", { body });
      push(initial?.id ? "Role updated" : `Role "${name}" created — assign it under Users & roles`);
      onSaved();
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="rounded-lg border border-river bg-river-soft/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">{initial?.id ? `Edit role: ${initial.name}` : "New custom role"}</div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate hover:bg-white" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Role name *">
          <Input
            value={name}
            onChange={(e: any) => setName(e.target.value)}
            placeholder="e.g. Zone supervisor, Board member, Standpipe attendant"
            required
          />
        </Field>
        <Field label="What this role does (optional)">
          <Input
            value={description}
            onChange={(e: any) => setDescription(e.target.value)}
            placeholder="Shown to the admin when assigning staff"
          />
        </Field>
      </div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate">Features this role may use</div>
        <div className="flex gap-2 text-xs">
          <button type="button" className="font-semibold text-river" onClick={() => setPicked(new Set(modules.map((m) => m.key)))}>
            Tick all
          </button>
          <button type="button" className="font-semibold text-bad" onClick={() => setPicked(new Set())}>
            Untick all
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groups.map(([group, mods]) => (
          <div key={group} className="rounded-md bg-white p-3">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-light">{group}</div>
            {mods.map((m) => (
              <label key={m.key} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={picked.has(m.key)} onChange={() => toggle(m.key)} />
                {m.label}
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          <Save className="h-4 w-4" />
          {initial?.id ? "Save role" : "Create role"}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Page                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

export default function SystemSettingsPage() {
  const { user, can } = useAuth();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [access, setAccess] = useState<Record<string, string[]>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"matrix" | "roles" | "switches">("matrix");
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null | "new">(null);
  const cid = user?.community;

  const load = () =>
    Promise.all([api(`/api/communities/${cid}/features/`), api("/api/community-roles/", { params: { page_size: 100 } })])
      .then(([r, roles]) => {
        setD(r);
        setAccess(r.module_access || {});
        setFlags(r.flags || {});
        setCustomRoles(roles.results || roles);
      })
      .catch((e) => push(e.message, "bad"));
  useEffect(() => {
    if (cid) load();
  }, [cid]); // eslint-disable-line

  const groups = useMemo<[string, Module[]][]>(() => {
    if (!d) return [];
    const map = new Map<string, Module[]>();
    d.modules.forEach((m: Module) => map.set(m.group, [...(map.get(m.group) || []), m]));
    return [...map.entries()];
  }, [d]);

  if (!can("MANAGE_COMMUNITY_SETTINGS"))
    return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">Only the community admin can change system settings.</div>;
  if (!d) return <Spinner />;

  const roles: RoleRow[] = d.roles;
  const isDisabled = (role: string, mod: string) => (access[role] || []).includes(mod);
  const applicable = (row: RoleRow, mod: string) => row.default_modules.includes(mod);
  const isOn = (row: RoleRow, mod: string) => applicable(row, mod) && !isDisabled(row.key, mod);
  const setCell = (next: Record<string, string[]>, row: RoleRow, mod: string, on: boolean) => {
    const cur = new Set(next[row.key] || []);
    on ? cur.delete(mod) : cur.add(mod);
    next[row.key] = [...cur].sort();
  };
  const toggle = (row: RoleRow, mod: string) => {
    const next = { ...access };
    setCell(next, row, mod, !isOn(row, mod));
    setAccess(next);
    setDirty(true);
  };
  const setAllForRole = (row: RoleRow, on: boolean) => {
    setAccess({ ...access, [row.key]: on ? [] : [...row.default_modules] });
    setDirty(true);
  };
  const setAllForModule = (mod: string, on: boolean) => {
    const next = { ...access };
    roles.forEach((r) => applicable(r, mod) && setCell(next, r, mod, on));
    setAccess(next);
    setDirty(true);
  };
  const setEverything = (on: boolean) => {
    const next: Record<string, string[]> = {};
    roles.forEach((r) => (next[r.key] = on ? [] : [...r.default_modules]));
    setAccess(next);
    setDirty(true);
  };
  const allOn = roles.every((r) => !(access[r.key] || []).length);
  const save = async () => {
    setSaving(true);
    try {
      const r = await api(`/api/communities/${cid}/features/`, { method: "PATCH", body: { module_access: access, ...flags } });
      setD(r);
      setAccess(r.module_access || {});
      setFlags(r.flags || {});
      setDirty(false);
      push("System settings saved. Staff see the change the next time a page loads.");
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setSaving(false);
    }
  };
  const removeRole = async (r: any) => {
    if (!window.confirm(`Delete the "${r.name}" role?${r.users_count ? ` ${r.users_count} user(s) hold it — reassign them first.` : ""}`))
      return;
    try {
      await api(`/api/community-roles/${r.id}/`, { method: "DELETE" });
      push("Role deleted");
      load();
    } catch (e: any) {
      push(e.message, "bad");
    }
  };

  return (
    <div>
      <PageHeader
        title="System settings"
        subtitle="Decide which features each role in your community can use, create your own roles, and choose which portal features households get."
        actions={
          tab !== "roles" ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAccess(d.module_access || {});
                  setFlags(d.flags || {});
                  setDirty(false);
                }}
                disabled={!dirty}
              >
                <RotateCcw className="h-4 w-4" />
                Discard
              </Button>
              <Button onClick={save} loading={saving} disabled={!dirty}>
                <Save className="h-4 w-4" />
                Save changes
              </Button>
            </div>
          ) : undefined
        }
      />

      <Tabs
        tabs={[
          { key: "matrix", label: "Feature access by role" },
          { key: "roles", label: `Custom roles (${customRoles.length})` },
          { key: "switches", label: "Community-wide switches" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as any)}
      />

      {tab === "matrix" && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate">
              A tick means the role can use the module. Grey cells are modules the role never has by default (for a built-in role, change
              the role; for a custom role, edit the role). Your own Community Admin role always has everything.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setEverything(true)} disabled={allOn}>
                <CheckSquare className="h-4 w-4" />
                Tick all
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEverything(false)}>
                <Square className="h-4 w-4" />
                Untick all
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] font-bold text-slate">
                  <th className="px-2 py-2 text-left">Module</th>
                  {roles.map((r) => (
                    <th key={r.key} className="px-2 py-2 text-center align-bottom">
                      <div className="flex flex-col items-center">
                        <span>{r.label}</span>
                        {!r.builtin && <Badge value="CUSTOM" className="mt-0.5 !bg-river-soft !text-river" />}
                      </div>
                      <div className="mt-1 flex justify-center gap-1 font-normal">
                        <button type="button" className="text-river hover:underline" onClick={() => setAllForRole(r, true)}>
                          all
                        </button>
                        <span className="text-slate-light">·</span>
                        <button type="button" className="text-bad hover:underline" onClick={() => setAllForRole(r, false)}>
                          none
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, mods]) => (
                  <>
                    <tr key={`g-${group}`} className="bg-wash/60">
                      <td colSpan={roles.length + 1} className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-light">
                        {group}
                      </td>
                    </tr>
                    {mods.map((m) => (
                      <tr key={m.key} className="border-b border-line/60">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-semibold text-ink">{m.label}</div>
                              <div className="text-[11px] text-slate-light">
                                {m.perms.map((p) => p.toLowerCase().replace(/_/g, " ")).join(" · ")}
                              </div>
                            </div>
                            <div className="ml-auto flex shrink-0 gap-1 text-[11px]">
                              <button
                                type="button"
                                className="text-river hover:underline"
                                onClick={() => setAllForModule(m.key, true)}
                                title="Tick this module for every role that can have it"
                              >
                                all
                              </button>
                              <span className="text-slate-light">·</span>
                              <button
                                type="button"
                                className="text-bad hover:underline"
                                onClick={() => setAllForModule(m.key, false)}
                                title="Untick this module for every role"
                              >
                                none
                              </button>
                            </div>
                          </div>
                        </td>
                        {roles.map((r) => {
                          const ok = applicable(r, m.key);
                          const on = ok && !isDisabled(r.key, m.key);
                          return (
                            <td key={r.key} className="px-2 py-2 text-center">
                              {ok ? (
                                <button
                                  type="button"
                                  aria-label={`${r.label}: ${m.label} ${on ? "enabled" : "disabled"}`}
                                  onClick={() => toggle(r, m.key)}
                                  className={`inline-grid h-7 w-7 place-items-center rounded-md border transition ${on ? "border-ok bg-ok text-white" : "border-line bg-white text-transparent hover:border-bad"}`}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="inline-block h-7 w-7 rounded-md bg-wash" title="Not part of this role" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          {editing ? (
            <RoleEditor
              modules={d.modules}
              groups={groups}
              initial={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                load();
              }}
            />
          ) : (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-ink">Roles you define</div>
                  <p className="text-xs text-slate">
                    Give a role any name and tick the features it may use. Then assign it to staff under Users &amp; roles. Custom roles
                    also appear in the feature matrix.
                  </p>
                </div>
                <Button onClick={() => setEditing("new")}>
                  <Plus className="h-4 w-4" />
                  New custom role
                </Button>
              </div>
            </Card>
          )}
          <Card>
            {customRoles.length ? (
              <ul className="divide-y divide-line/60">
                {customRoles.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-ink">
                        {r.name}
                        {!r.is_active && <Badge value="INACTIVE" />}
                        <span className="text-xs font-normal text-slate">
                          {r.users_count} user{r.users_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      {r.description && <div className="text-xs text-slate">{r.description}</div>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.modules.map((k: string) => (
                          <span key={k} className="rounded bg-wash px-1.5 py-0.5 text-[11px] text-slate">
                            {d.modules.find((m: Module) => m.key === k)?.label || k}
                          </span>
                        ))}
                        {!r.modules.length && (
                          <span className="text-[11px] text-warn">no features ticked — users of this role can only see the dashboard</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="!text-bad" onClick={() => removeRole(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-8 text-center text-sm text-slate">
                No custom roles yet. Create one for a job the built-in roles don&apos;t cover.
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "switches" && (
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(FLAG_LABELS).map(([key, meta]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${flags[key] ? "border-ok/40 bg-ok/5" : "border-line"}`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!flags[key]}
                  onChange={(e) => {
                    setFlags({ ...flags, [key]: e.target.checked });
                    setDirty(true);
                  }}
                />
                <span>
                  <span className="block text-sm font-semibold text-ink">{meta.label}</span>
                  <span className="block text-xs text-slate">{meta.help}</span>
                </span>
              </label>
            ))}
          </div>
          <SectionTitle>Billing policy</SectionTitle>
          <p className="text-xs text-slate">
            Due days, late penalty, reminder schedule, anomaly thresholds and the water-loss target live under{" "}
            <a href={`/communities/${cid}`} className="font-semibold text-river">
              My community → Billing &amp; policy
            </a>
            . Tariffs are under{" "}
            <a href="/tariffs" className="font-semibold text-river">
              Tariffs
            </a>
            .
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate">
            <ShieldCheck className="h-4 w-4 text-ok" />
            Every change here is written to the audit trail with your name.
          </div>
        </Card>
      )}
    </div>
  );
}
