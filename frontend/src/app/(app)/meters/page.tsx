"use client";
/** Meters — lifecycle, installation, replacement with audit trail, history drawer. */
import { useState } from "react";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Field, Input, Modal, Table, Textarea, useToast, KV } from "@/components/ui";
import { api } from "@/lib/api";
import { LookupSelect } from "@/components/ResourcePage";
import { METER_CONDITION, METER_STATUS } from "@/lib/options";
import { date, m3, title } from "@/lib/format";

export default function MetersPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const [rep, setRep] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [hist, setHist] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reloadFn, setReloadFn] = useState<() => void>(() => () => {});
  const doReplace = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/meters/${rep.id}/replace/`, { body: form });
      push("Meter replaced — customer moved to the new meter");
      setRep(null);
      reloadFn();
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ResourcePage
        endpoint="/api/meters/"
        title="Meters"
        subtitle="Available → Installed → Active → Faulty/Blocked → Removed/Replaced/Retired. Replacement keeps the full history."
        createPerm="MANAGE_METERS"
        editPerm="MANAGE_METERS"
        createLabel="Add meter"
        ordering="-created_at"
        filters={[
          { name: "status", label: "Status", options: METER_STATUS },
          { name: "condition", label: "Condition", options: METER_CONDITION },
          {
            name: "is_smart",
            label: "Smart",
            options: [
              { value: "true", label: "Smart / IoT" },
              { value: "false", label: "Conventional" },
            ],
          },
        ]}
        columns={[
          {
            key: "meter_id",
            label: "Meter",
            render: (r) => (
              <div>
                <b>{r.meter_id}</b>
                <div className="text-xs text-slate">
                  SN {r.serial_number} · {r.meter_type}
                  {r.meter_size ? ` · ${r.meter_size}` : ""}
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
              ) : (
                <span className="text-slate">unassigned</span>
              ),
          },
          { key: "current_reading", label: "Reading", render: (r) => m3(r.current_reading) },
          { key: "installation_date", label: "Installed", render: (r) => date(r.installation_date) },
          { key: "condition", label: "Condition", render: (r) => <Badge value={r.condition} /> },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <span>
                <Badge value={r.status} />
                {r.replaced_by_id && <span className="ml-1 text-xs text-slate">→ {r.replaced_by_id}</span>}
              </span>
            ),
          },
        ]}
        rowActions={(r, h) => {
          setReloadFn(() => h.reload);
          return (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    setHist(await api(`/api/meters/${r.id}/history/`));
                  } catch (e: any) {
                    push(e.message, "bad");
                  }
                }}
              >
                History
              </Button>
              {can("MANAGE_METERS") && ["ACTIVE", "INSTALLED", "FAULTY", "BLOCKED"].includes(r.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="!text-warn"
                  onClick={() => {
                    setRep(r);
                    setForm({
                      final_reading: r.current_reading,
                      initial_reading: "0",
                      reason: "",
                      performed_on: new Date().toISOString().slice(0, 10),
                    });
                  }}
                >
                  Replace
                </Button>
              )}
            </>
          );
        }}
        fields={[
          {
            name: "serial_number",
            label: "Meter number (printed on the meter)",
            required: true,
            hint: "Required. This is what readers key in on the field app.",
          },
          { name: "meter_type", label: "Meter type", defaultValue: "Mechanical" },
          { name: "manufacturer", label: "Manufacturer" },
          { name: "meter_size", label: "Size", hint: '15mm, 1/2"…' },
          {
            name: "customer",
            label: "Customer",
            type: "lookup",
            lookup: { endpoint: "/api/customers/", labelKey: (r: any) => `${r.household_name} · ${r.customer_id}` },
            hint: "Assigning a customer installs and activates the meter",
          },
          {
            name: "property",
            label: "Property",
            type: "lookup",
            lookup: { endpoint: "/api/properties/", labelKey: (r: any) => `${r.property_id} · ${r.address}` },
          },
          { name: "installation_date", label: "Installation date", type: "date" },
          { name: "installation_location", label: "Installation location" },
          {
            name: "initial_reading",
            label: "Initial reading (m³)",
            type: "number",
            step: "0.001",
            defaultValue: "0",
            readOnlyOnEdit: true,
          },
          { name: "status", label: "Status", type: "select", options: METER_STATUS },
          { name: "condition", label: "Condition", type: "select", options: METER_CONDITION, defaultValue: "GOOD" },
          { name: "last_inspection", label: "Last inspection", type: "date" },
          { name: "is_smart", label: "Smart / IoT meter", type: "checkbox" },
          { name: "iot_device_id", label: "IoT device ID" },
          { name: "notes", label: "Notes", type: "textarea", span: 2 },
        ]}
      />
      <Modal open={!!rep} onClose={() => setRep(null)} title={`Replace meter ${rep?.meter_id}`}>
        <form className="space-y-3" onSubmit={doReplace}>
          <Field label="New meter (must be Available) *">
            <LookupSelect
              f={{
                name: "new_meter",
                label: "",
                type: "lookup",
                lookup: {
                  endpoint: "/api/meters/",
                  labelKey: (r: any) => `${r.meter_id} · SN ${r.serial_number}`,
                  params: { status: "AVAILABLE" },
                },
              }}
              value={form.new_meter}
              onChange={(v) => setForm({ ...form, new_meter: v })}
              community=""
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Final reading on old meter *">
              <Input
                type="number"
                step="0.001"
                required
                value={form.final_reading}
                onChange={(e: any) => setForm({ ...form, final_reading: e.target.value })}
              />
            </Field>
            <Field label="Initial reading on new meter *">
              <Input
                type="number"
                step="0.001"
                required
                value={form.initial_reading}
                onChange={(e: any) => setForm({ ...form, initial_reading: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Performed on">
            <Input type="date" value={form.performed_on} onChange={(e: any) => setForm({ ...form, performed_on: e.target.value })} />
          </Field>
          <Field label="Reason *">
            <Textarea required value={form.reason} onChange={(e: any) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRep(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} variant="dark">
              Replace meter
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title={`History · ${hist?.meter?.meter_id}`} wide>
        {hist && (
          <div className="space-y-4">
            <KV
              items={[
                ["Serial", hist.meter.serial_number],
                ["Status", <Badge value={hist.meter.status} />],
                ["Customer", hist.meter.customer_name || "—"],
                ["Current reading", m3(hist.meter.current_reading)],
              ]}
            />
            {hist.replacements.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-bold text-slate">Replacements</div>
                <Table
                  rows={hist.replacements}
                  columns={[
                    { key: "performed_on", label: "Date", render: (r) => date(r.performed_on) },
                    { key: "old_meter_code", label: "Old" },
                    { key: "final_reading", label: "Final" },
                    { key: "new_meter_code", label: "New" },
                    { key: "initial_reading", label: "Initial" },
                    { key: "reason", label: "Reason" },
                  ]}
                />
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-bold text-slate">Readings</div>
              <Table
                rows={hist.readings}
                columns={[
                  { key: "reading_date", label: "Date", render: (r) => date(r.reading_date) },
                  { key: "previous_reading", label: "Prev" },
                  { key: "reading_value", label: "Current" },
                  { key: "consumption", label: "m³" },
                  { key: "source", label: "Source", render: (r) => title(r.source) },
                  { key: "read_by_name", label: "By" },
                  { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
