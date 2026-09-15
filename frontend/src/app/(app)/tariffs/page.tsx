"use client";
/** Tariffs — tiered / slab / flat plans with a live simulator, plus fixed service charges & levies. */
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useList } from "@/components/ResourcePage";
import ResourcePage from "@/components/ResourcePage";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { CATEGORIES, CHARGE_TYPE, TARIFF_MODE } from "@/lib/options";
import { ghs, title } from "@/lib/format";

const blankTier = () => ({ from_m3: "", to_m3: "", rate_per_m3: "", slab_amount: "0" });

function TariffPlans() {
  const { can } = useAuth();
  const { push } = useToast();
  const params: any = {};
  const { rows, loading, reload } = useList("/api/tariffs/", params);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [f, setF] = useState<any>({});
  const [tiers, setTiers] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [sim, setSim] = useState<any>(null);
  const [simVal, setSimVal] = useState("12");
  const [simRes, setSimRes] = useState<any>(null);
  const open = (row: any | null) => {
    setEditing(row);
    setF(
      row
        ? { ...row }
        : {
            name: "",
            category: "RESIDENTIAL",
            billing_mode: "TIERED",
            flat_rate: "0",
            minimum_charge: "0",
            is_active: true,
            description: "",
          },
    );
    setTiers(
      row?.tiers?.length
        ? row.tiers.map((t: any) => ({ ...t, to_m3: t.to_m3 ?? "" }))
        : [
            { from_m3: "0", to_m3: "5", rate_per_m3: "", slab_amount: "0" },
            { from_m3: "5", to_m3: "", rate_per_m3: "", slab_amount: "0" },
          ],
    );
    setErr("");
    setModal(true);
  };
  const save = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const body: any = {
        name: f.name,
        category: f.category,
        billing_mode: f.billing_mode,
        flat_rate: f.flat_rate || 0,
        minimum_charge: f.minimum_charge || 0,
        is_active: !!f.is_active,
        effective_from: f.effective_from || null,
        description: f.description || "",
        tiers:
          f.billing_mode === "FLAT"
            ? []
            : tiers.map((t, i) => ({
                order: i + 1,
                from_m3: t.from_m3,
                to_m3: t.to_m3 === "" ? null : t.to_m3,
                rate_per_m3: t.rate_per_m3 || 0,
                slab_amount: t.slab_amount || 0,
              })),
      };
      if (editing) await api(`/api/tariffs/${editing.id}/`, { method: "PATCH", body });
      else await api("/api/tariffs/", { body });
      push(editing ? "Tariff updated" : "Tariff created");
      setModal(false);
      reload();
    } catch (ex: any) {
      setErr(ex instanceof ApiError ? ex.message : ex.message);
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!sim) return;
    const t = setTimeout(
      () =>
        api(`/api/tariffs/${sim.id}/simulate/`, { params: { consumption: simVal || 0 } })
          .then(setSimRes)
          .catch(() => setSimRes(null)),
      250,
    );
    return () => clearTimeout(t);
  }, [sim, simVal]);
  const setTier = (i: number, k: string, v: any) => setTiers(tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  return (
    <>
      <div className="mb-3 flex flex-wrap justify-between gap-2">
        <span />
        {can("MANAGE_TARIFFS") && (
          <Button onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            New tariff plan
          </Button>
        )}
      </div>
      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <Table
            rows={rows}
            columns={[
              {
                key: "name",
                label: "Plan",
                render: (r) => (
                  <div>
                    <b>{r.name}</b> <span className="text-xs text-slate">#{r.id}</span>
                    <div className="text-xs text-slate">
                      {r.scope}
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                  </div>
                ),
              },
              { key: "category", label: "Category", render: (r) => title(r.category) },
              { key: "billing_mode", label: "Mode", render: (r) => <Badge value={r.billing_mode} /> },
              {
                key: "tiers",
                label: "Structure",
                render: (r) =>
                  r.billing_mode === "FLAT" ? (
                    `${ghs(r.flat_rate)} / m³`
                  ) : (
                    <div className="text-xs">
                      {r.tiers.map((t: any) => (
                        <div key={t.id}>
                          {t.from_m3}–{t.to_m3 ?? "∞"} m³: {r.billing_mode === "SLAB" ? ghs(t.slab_amount) : `${ghs(t.rate_per_m3)}/m³`}
                        </div>
                      ))}
                    </div>
                  ),
              },
              { key: "minimum_charge", label: "Minimum", render: (r) => ghs(r.minimum_charge) },
              { key: "customers_count", label: "Customers" },
              { key: "is_active", label: "", render: (r) => <Badge value={r.is_active ? "ACTIVE" : "INACTIVE"} /> },
              {
                key: "__a",
                label: "",
                className: "text-right",
                render: (r) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSim(r);
                        setSimRes(null);
                      }}
                    >
                      Simulate
                    </Button>
                    {can("MANAGE_TARIFFS") && (
                      <Button size="sm" variant="ghost" onClick={() => open(r)}>
                        Edit
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit tariff plan" : "New tariff plan"} wide>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Plan name *">
              <Input required value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Customer category">
              <Select value={f.category} onChange={(e: any) => setF({ ...f, category: e.target.value })}>
                {CATEGORIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Billing mode">
              <Select value={f.billing_mode} onChange={(e: any) => setF({ ...f, billing_mode: e.target.value })}>
                {TARIFF_MODE.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            {f.billing_mode === "FLAT" && (
              <Field label="Flat rate per m³ (GHS)">
                <Input type="number" step="0.0001" value={f.flat_rate} onChange={(e: any) => setF({ ...f, flat_rate: e.target.value })} />
              </Field>
            )}
            <Field label="Minimum charge (GHS)">
              <Input
                type="number"
                step="0.01"
                value={f.minimum_charge}
                onChange={(e: any) => setF({ ...f, minimum_charge: e.target.value })}
              />
            </Field>
            <Field label="Effective from">
              <Input type="date" value={f.effective_from || ""} onChange={(e: any) => setF({ ...f, effective_from: e.target.value })} />
            </Field>
          </div>
          {f.billing_mode !== "FLAT" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold text-slate">
                  {f.billing_mode === "SLAB"
                    ? "Slabs — a fixed amount if consumption falls in the band"
                    : "Tiers — each band is charged at its own rate (progressive)"}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setTiers([...tiers, { ...blankTier(), from_m3: tiers[tiers.length - 1]?.to_m3 || "" }])}
                >
                  <Plus className="h-3 w-3" />
                  Add band
                </Button>
              </div>
              <div className="space-y-2">
                {tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                    <Field label="From (m³)">
                      <Input
                        type="number"
                        step="0.001"
                        required
                        value={t.from_m3}
                        onChange={(e: any) => setTier(i, "from_m3", e.target.value)}
                      />
                    </Field>
                    <Field label="To (m³) — blank = no limit">
                      <Input type="number" step="0.001" value={t.to_m3} onChange={(e: any) => setTier(i, "to_m3", e.target.value)} />
                    </Field>
                    {f.billing_mode === "SLAB" ? (
                      <Field label="Slab amount (GHS)">
                        <Input
                          type="number"
                          step="0.01"
                          required
                          value={t.slab_amount}
                          onChange={(e: any) => setTier(i, "slab_amount", e.target.value)}
                        />
                      </Field>
                    ) : (
                      <Field label="Rate per m³ (GHS)">
                        <Input
                          type="number"
                          step="0.0001"
                          required
                          value={t.rate_per_m3}
                          onChange={(e: any) => setTier(i, "rate_per_m3", e.target.value)}
                        />
                      </Field>
                    )}
                    <button
                      type="button"
                      className="mb-2 rounded p-2 text-slate hover:bg-wash hover:text-bad"
                      onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Field label="Description">
            <Textarea value={f.description} onChange={(e: any) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Checkbox label="Active" checked={!!f.is_active} onChange={(e: any) => setF({ ...f, is_active: e.target.checked })} />
          {err && <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{err}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? "Save changes" : "Create plan"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!sim} onClose={() => setSim(null)} title={`Simulate · ${sim?.name}`}>
        <Field label="Consumption (m³)">
          <Input type="number" step="0.001" value={simVal} onChange={(e: any) => setSimVal(e.target.value)} autoFocus />
        </Field>
        {simRes && (
          <div className="mt-3">
            <div className="text-3xl font-extrabold">{ghs(simRes.water_charge)}</div>
            <div className="text-xs text-slate">water charge before levies/penalties</div>
            <ul className="mt-2 divide-y divide-line/60 text-sm">
              {simRes.lines.map((l: any, i: number) => (
                <li key={i} className="flex justify-between py-1">
                  <span className="text-slate">{l.label || l.description}</span>
                  <span className="font-semibold">{ghs(l.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}

function ServiceCharges() {
  return (
    <ResourcePage
      endpoint="/api/service-charges/"
      title=""
      search={false}
      createPerm="MANAGE_TARIFFS"
      editPerm="MANAGE_TARIFFS"
      createLabel="New charge"
      columns={[
        { key: "name", label: "Charge", render: (r) => <b>{r.name}</b> },
        { key: "charge_type", label: "Type", render: (r) => <Badge value={r.charge_type} /> },
        { key: "amount", label: "Amount per bill", render: (r) => ghs(r.amount) },
        {
          key: "applies_to",
          label: "Applies to",
          render: (r) => (r.applies_to?.length ? r.applies_to.map(title).join(", ") : "All categories"),
        },
        { key: "is_active", label: "", render: (r) => <Badge value={r.is_active ? "ACTIVE" : "INACTIVE"} /> },
      ]}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "charge_type", label: "Type", type: "select", options: CHARGE_TYPE, defaultValue: "SERVICE" },
        { name: "amount", label: "Amount (GHS)", type: "number", step: "0.01", required: true },
        { name: "applies_to", label: "Applies to categories (JSON list, empty = all)", type: "json", hint: '["RESIDENTIAL","COMMERCIAL"]' },
        { name: "is_active", label: "Active", type: "checkbox", defaultValue: true },
      ]}
    />
  );
}

export default function TariffsPage() {
  const [tab, setTab] = useState("plans");
  return (
    <div>
      <PageHeader
        title="Tariffs & charges"
        subtitle="How consumption becomes money: block tariffs, slabs or flat rates, plus fixed service and infrastructure levies."
      />
      <Tabs
        tabs={[
          { key: "plans", label: "Tariff plans" },
          { key: "charges", label: "Service charges & levies" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "plans" ? <TariffPlans /> : <ServiceCharges />}
    </div>
  );
}
