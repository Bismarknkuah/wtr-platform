"use client";
/**
 * Towns served by the community (a community = the district-level utility; it can serve many
 * towns/villages/zones). Community admin adds and edits; everyone else in the community sees the list.
 */
import { useEffect, useState } from "react";
import { MapPin, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Field, Input, useToast } from "@/components/ui";
import { num } from "@/lib/format";

const EMPTY = { name: "", code: "", households_estimate: "", latitude: "", longitude: "", notes: "" };

export function TownsPanel() {
  const { can } = useAuth();
  const { push } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = can("MANAGE_COMMUNITY_SETTINGS");

  const load = () =>
    api("/api/towns/", { params: { page_size: 200 } })
      .then((d) => setRows(d.results || d))
      .catch((e) => push(e.message, "bad"));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const save = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...form,
        households_estimate: Number(form.households_estimate) || 0,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
      };
      if (editing) await api(`/api/towns/${editing}/`, { method: "PATCH", body });
      else await api("/api/towns/", { body });
      push(editing ? "Town updated" : "Town added");
      setForm(EMPTY);
      setEditing(null);
      load();
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (t: any) => {
    if (!window.confirm(`Remove ${t.name}? Customers stay, but lose the town tag.`)) return;
    try {
      await api(`/api/towns/${t.id}/`, { method: "DELETE" });
      load();
    } catch (ex: any) {
      push(ex.message, "bad");
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold text-slate">
              <th className="px-3 py-2 text-left">Town</th>
              <th className="px-3 py-2 text-right">Est. households</th>
              <th className="px-3 py-2 text-right">Customers</th>
              <th className="px-3 py-2 text-right">Open requests</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((t) => (
              <tr key={t.id} className="border-b border-line/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    <MapPin className="h-4 w-4 text-river" />
                    {t.name} {t.code && <Badge value={t.code} />} {!t.is_active && <Badge value="INACTIVE" />}
                  </div>
                  {t.notes && <div className="text-xs text-slate">{t.notes}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{num(t.households_estimate)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(t.customers_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{t.tickets_open ? <b className="text-warn">{t.tickets_open}</b> : 0}</td>
                <td className="px-3 py-2 text-right">
                  {editable && (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(t.id);
                          setForm({
                            name: t.name,
                            code: t.code,
                            households_estimate: t.households_estimate,
                            latitude: t.latitude || "",
                            longitude: t.longitude || "",
                            notes: t.notes,
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" className="!text-bad" onClick={() => remove(t)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows && !rows.length && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate">
                  No towns yet. Add the towns, villages or zones this water system serves.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editable && (
        <form onSubmit={save} className="rounded-lg bg-white p-4 shadow-card">
          <div className="mb-2 text-sm font-bold text-ink">{editing ? "Edit town" : "Add a town"}</div>
          <Field label="Name *">
            <Input required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sesemi" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Short code">
              <Input
                value={form.code}
                onChange={(e: any) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SES"
                maxLength={20}
              />
            </Field>
            <Field label="Est. households">
              <Input
                type="number"
                value={form.households_estimate}
                onChange={(e: any) => setForm({ ...form, households_estimate: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude">
              <Input value={form.latitude} onChange={(e: any) => setForm({ ...form, latitude: e.target.value })} placeholder="5.7167" />
            </Field>
            <Field label="Longitude">
              <Input value={form.longitude} onChange={(e: any) => setForm({ ...form, longitude: e.target.value })} placeholder="-0.2000" />
            </Field>
          </div>
          <Field label="Notes">
            <Input value={form.notes} onChange={(e: any) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="mt-2 flex gap-2">
            <Button type="submit" loading={busy}>
              {editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editing ? "Save" : "Add town"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
