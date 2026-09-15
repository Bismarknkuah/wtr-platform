"use client";
/**
 * Generic, schema-driven CRUD page. Every module page is its own file that just declares its schema,
 * so a change to one module never touches another. Handles: list + search + filters + pagination,
 * create/edit modal, delete (with reason → audit trail), tenant scoping for platform users.
 */
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, RefreshCw } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Button,
  Card,
  Column,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  Pager,
  Select,
  Spinner,
  Table,
  Textarea,
  Checkbox,
  useToast,
} from "@/components/ui";
import { CommunityPicker, useCommunityScope } from "@/components/CommunityScope";

export type Option = { value: string | number; label: string };
export type FieldDef = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime" | "select" | "textarea" | "checkbox" | "lookup" | "email" | "json";
  options?: Option[];
  lookup?: { endpoint: string; labelKey: string | ((r: any) => string); valueKey?: string; params?: Record<string, any>; scoped?: boolean };
  required?: boolean;
  hint?: string;
  span?: 1 | 2;
  step?: string;
  readOnlyOnEdit?: boolean;
  defaultValue?: any;
  /** Optional: derive the form value from the row when editing (for virtual fields the API doesn't return as-is). */
  fromRow?: (row: any) => any;
};
export type ResourceConfig = {
  endpoint: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  fields?: FieldDef[];
  filters?: FieldDef[];
  search?: boolean;
  createPerm?: string | string[];
  editPerm?: string | string[];
  deletePerm?: string | string[];
  createLabel?: string;
  ordering?: string;
  rowHref?: (row: any) => string;
  rowActions?: (row: any, h: Helpers) => ReactNode;
  headerActions?: (h: Helpers) => ReactNode;
  transform?: (data: Record<string, any>, editing: any | null) => Record<string, any>;
  hideCommunityPicker?: boolean;
  scoped?: boolean;
  extraParams?: Record<string, any>;
  afterList?: (rows: any[], h: Helpers) => ReactNode;
};
export type Helpers = {
  reload: () => void;
  edit: (row: any) => void;
  toast: (t: string, tone?: "ok" | "bad" | "info") => void;
  community: string;
  api: typeof api;
};

export function LookupSelect({
  f,
  value,
  onChange,
  community,
}: {
  f: FieldDef;
  value: any;
  onChange: (v: any) => void;
  community: string;
}) {
  const [opts, setOpts] = useState<Option[]>([]);
  useEffect(() => {
    const l = f.lookup!;
    const params: any = { page_size: 200, ...(l.params || {}) };
    if (l.scoped !== false && community) params.community = community;
    api(l.endpoint, { params })
      .then((d) => {
        const rows = d.results || d;
        setOpts(
          rows.map((r: any) => ({ value: r[l.valueKey || "id"], label: typeof l.labelKey === "function" ? l.labelKey(r) : r[l.labelKey] })),
        );
      })
      .catch(() => setOpts([]));
  }, [f, community]);
  return (
    <Select value={value ?? ""} onChange={(e: any) => onChange(e.target.value === "" ? null : e.target.value)}>
      <option value="">— none —</option>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function FormFields({
  fields,
  data,
  setData,
  editing,
  community,
}: {
  fields: FieldDef[];
  data: any;
  setData: (d: any) => void;
  editing: any;
  community: string;
}) {
  const set = (n: string, v: any) => setData({ ...data, [n]: v });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f) => {
        const v = data[f.name];
        const ro = !!(editing && f.readOnlyOnEdit);
        let ctl: ReactNode;
        if (f.type === "select")
          ctl = (
            <Select value={v ?? ""} disabled={ro} onChange={(e: any) => set(f.name, e.target.value)}>
              <option value="">— select —</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          );
        else if (f.type === "lookup") ctl = <LookupSelect f={f} value={v} onChange={(x) => set(f.name, x)} community={community} />;
        else if (f.type === "textarea" || f.type === "json")
          ctl = <Textarea value={v ?? ""} disabled={ro} onChange={(e: any) => set(f.name, e.target.value)} />;
        else if (f.type === "checkbox")
          return (
            <div key={f.name} className={f.span === 2 ? "sm:col-span-2" : ""}>
              <Checkbox label={f.label} checked={!!v} onChange={(e: any) => set(f.name, e.target.checked)} />
            </div>
          );
        else
          ctl = (
            <Input
              type={f.type === "datetime" ? "datetime-local" : f.type || "text"}
              step={f.step}
              value={v ?? ""}
              disabled={ro}
              required={f.required}
              onChange={(e: any) => set(f.name, e.target.value)}
            />
          );
        return (
          <Field key={f.name} label={f.label + (f.required ? " *" : "")} hint={f.hint} className={f.span === 2 ? "sm:col-span-2" : ""}>
            {ctl}
          </Field>
        );
      })}
    </div>
  );
}

export function useList(endpoint: string, params: Record<string, any>, deps: any[] = []) {
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    setLoading(true);
    api(endpoint, { params })
      .then((d) => {
        setRows(d.results || d);
        setCount(d.count ?? (d.results || d).length);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(params), ...deps]); // eslint-disable-line
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, count, loading, error, reload, setRows };
}

export default function ResourcePage(cfg: ResourceConfig) {
  const { can } = useAuth();
  const router = useRouter();
  const { push } = useToast();
  const { community, setCommunity, isPlatform } = useCommunityScope();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [lookupOptions, setLookupOptions] = useState<Record<string, Option[]>>({});
  useEffect(() => {
    cfg.filters?.forEach((f) => {
      if (!f.lookup) return;
      const l = f.lookup;
      api(l.endpoint, { params: { page_size: 200, ...(l.params || {}) } })
        .then((d) => {
          const rows = d.results || d;
          setLookupOptions((o) => ({
            ...o,
            [f.name]: rows.map((r: any) => ({
              value: r[l.valueKey || "id"],
              label: typeof l.labelKey === "function" ? l.labelKey(r) : r[l.labelKey],
            })),
          }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.endpoint]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [data, setData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const scoped = cfg.scoped !== false;
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);
  const params = useMemo(
    () => ({
      page,
      search: qDebounced || undefined,
      ordering: cfg.ordering,
      ...(scoped && isPlatform && community ? { community } : {}),
      ...filters,
      ...(cfg.extraParams || {}),
    }),
    [page, qDebounced, filters, community, isPlatform, scoped, cfg.ordering, cfg.extraParams],
  );
  const { rows, count, loading, error, reload } = useList(cfg.endpoint, params);
  const helpers: Helpers = { reload, edit: (row) => openEdit(row), toast: push, community, api };
  const canCreate = cfg.fields && (!cfg.createPerm || can(cfg.createPerm));
  const canEdit = cfg.fields && (!cfg.editPerm || can(cfg.editPerm));
  const canDelete = cfg.deletePerm ? can(cfg.deletePerm) : false;

  const openCreate = () => {
    const d: any = {};
    cfg.fields?.forEach((f) => {
      if (f.defaultValue !== undefined) d[f.name] = typeof f.defaultValue === "function" ? f.defaultValue() : f.defaultValue;
    });
    setEditing(null);
    setData(d);
    setErr("");
    setModal(true);
  };
  const openEdit = (row: any) => {
    const d: any = {};
    cfg.fields?.forEach((f) => {
      d[f.name] = f.fromRow
        ? f.fromRow(row)
        : f.type === "json" && row[f.name] && typeof row[f.name] !== "string"
          ? JSON.stringify(row[f.name], null, 2)
          : row[f.name];
    });
    setEditing(row);
    setData(d);
    setErr("");
    setModal(true);
  };
  const save = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      let payload: any = { ...data };
      cfg.fields?.forEach((f) => {
        if (f.type === "json" && typeof payload[f.name] === "string") {
          try {
            payload[f.name] = payload[f.name] ? JSON.parse(payload[f.name]) : null;
          } catch {
            throw new Error(`${f.label} must be valid JSON`);
          }
        }
        if (payload[f.name] === "") payload[f.name] = null;
      });
      if (cfg.transform) payload = cfg.transform(payload, editing);
      if (scoped && isPlatform && !editing) {
        if (!community) throw new Error("Select a community first.");
        payload.community = community;
      }
      if (editing) await api(`${cfg.endpoint}${editing.id}/`, { method: "PATCH", body: payload });
      else await api(cfg.endpoint, { body: payload });
      push(editing ? "Saved changes" : "Created");
      setModal(false);
      reload();
    } catch (ex: any) {
      setErr(ex instanceof ApiError ? ex.message : ex.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row: any) => {
    const reason = window.prompt("Reason for deletion (recorded in the audit trail):");
    if (reason === null) return;
    try {
      await api(`${cfg.endpoint}${row.id}/`, { method: "DELETE", body: { reason } });
      push("Deleted");
      reload();
    } catch (ex: any) {
      push(ex.message, "bad");
    }
  };
  const columns: Column[] = useMemo(() => {
    const cols = [...cfg.columns];
    if (canEdit || canDelete || cfg.rowActions)
      cols.push({
        key: "__actions",
        label: "",
        className: "text-right whitespace-nowrap",
        render: (r) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {cfg.rowActions?.(r, helpers)}
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                Edit
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="ghost" className="!text-bad" onClick={() => remove(r)}>
                Delete
              </Button>
            )}
          </div>
        ),
      });
    return cols;
  }, [cfg.columns, canEdit, canDelete, community]); // eslint-disable-line

  return (
    <div>
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        actions={
          <>
            {scoped && isPlatform && !cfg.hideCommunityPicker && (
              <CommunityPicker
                value={community}
                onChange={(v) => {
                  setCommunity(v);
                  setPage(1);
                }}
                allowAll
              />
            )}
            {cfg.headerActions?.(helpers)}
            <Button variant="secondary" onClick={reload} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canCreate && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {cfg.createLabel || "New"}
              </Button>
            )}
          </>
        }
      />
      <Card>
        {(cfg.search !== false || cfg.filters?.length) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {cfg.search !== false && (
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-light" />
                <Input
                  className="!pl-8"
                  placeholder="Search…"
                  value={q}
                  onChange={(e: any) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}
            {cfg.filters?.map((f) => (
              <Select
                key={f.name}
                className="!w-auto"
                value={filters[f.name] ?? ""}
                onChange={(e: any) => {
                  setFilters({ ...filters, [f.name]: e.target.value });
                  setPage(1);
                }}
              >
                <option value="">{f.label}: all</option>
                {(f.lookup ? lookupOptions[f.name] || [] : f.options || []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ))}
          </div>
        )}
        {error && <div className="mb-3 rounded bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}
        {loading && !rows.length ? (
          <Spinner />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            onRowClick={cfg.rowHref ? (r) => router.push(cfg.rowHref!(r)) : undefined}
            empty={
              <Empty
                title={`No ${cfg.title.toLowerCase()} yet`}
                hint={
                  scoped && isPlatform && !community
                    ? "Pick a community above, or leave it on all communities."
                    : canCreate
                      ? `Create the first one with “${cfg.createLabel || "New"}”.`
                      : undefined
                }
              />
            }
          />
        )}
        <Pager page={page} count={count} onChange={setPage} />
      </Card>
      {cfg.afterList?.(rows, helpers)}
      {cfg.fields && (
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title={editing ? `Edit ${cfg.title.replace(/s$/, "").toLowerCase()}` : cfg.createLabel || `New ${cfg.title.toLowerCase()}`}
          wide={cfg.fields.length > 8}
        >
          <form onSubmit={save} className="space-y-4">
            <FormFields fields={cfg.fields} data={data} setData={setData} editing={editing} community={community} />
            {editing && (
              <Field label="Reason for change (audit trail)">
                <Input
                  value={data.reason ?? ""}
                  onChange={(e: any) => setData({ ...data, reason: e.target.value })}
                  placeholder="Optional but recommended for financial or tariff changes"
                />
              </Field>
            )}
            {err && <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Save changes" : "Create"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
