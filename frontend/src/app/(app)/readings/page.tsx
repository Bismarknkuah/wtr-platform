"use client";
/** Meter readings — record, validate/reject, anomaly review. Consumption is computed server-side (current − previous). */
import { useSearchParams } from "next/navigation";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { READING_SOURCE, READING_STATUS } from "@/lib/options";
import { date, m3, title, today } from "@/lib/format";

export default function ReadingsPage() {
  const { can } = useAuth();
  const sp = useSearchParams();
  const extra: Record<string, any> = {};
  ["status", "is_anomalous", "meter", "customer"].forEach((k) => {
    const v = sp.get(k);
    if (v) extra[k] = v;
  });
  const act = async (h: any, r: any, a: string) => {
    const note = a === "reject" ? window.prompt("Reason for rejecting this reading:") : "";
    if (a === "reject" && note === null) return;
    try {
      await h.api(`/api/readings/${r.id}/${a}/`, { body: { note } });
      h.toast(a === "validate" ? "Reading validated" : "Reading rejected");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/readings/"
      title="Meter readings"
      subtitle="Anomalies are flagged automatically: reverse, duplicate, impossible, spikes, unusually low, repeated zero, GPS mismatch."
      createPerm="RECORD_READING"
      createLabel="Record reading"
      ordering="-reading_date"
      extraParams={extra}
      filters={[
        { name: "status", label: "Status", options: READING_STATUS },
        { name: "source", label: "Source", options: READING_SOURCE },
        {
          name: "is_anomalous",
          label: "Anomaly",
          options: [
            { value: "true", label: "Flagged" },
            { value: "false", label: "Clean" },
          ],
        },
      ]}
      columns={[
        { key: "reading_date", label: "Date", render: (r) => date(r.reading_date) },
        {
          key: "meter_code",
          label: "Meter",
          render: (r) => (
            <div>
              <b>{r.meter_code}</b>
              <div className="text-xs text-slate">{r.customer_name}</div>
            </div>
          ),
        },
        { key: "previous_reading", label: "Previous" },
        { key: "reading_value", label: "Current" },
        { key: "consumption", label: "Consumption", render: (r) => <b>{m3(r.consumption)}</b> },
        {
          key: "source",
          label: "Source",
          render: (r) => (
            <span>
              {title(r.source)}
              {r.gps_distance_m != null && <span className="ml-1 text-xs text-slate">GPS {r.gps_distance_m}m</span>}
            </span>
          ),
        },
        { key: "read_by_name", label: "Read by" },
        {
          key: "anomaly_flags",
          label: "Flags",
          render: (r) =>
            r.anomaly_flags?.length ? (
              <div className="flex flex-wrap gap-1">
                {r.anomaly_flags.map((f: string) => (
                  <Badge key={f} value={f} className="!bg-warn/10 !text-warn" />
                ))}
              </div>
            ) : (
              ""
            ),
        },
        {
          key: "photo",
          label: "Photo",
          render: (r) =>
            r.photo || r.photo_url ? (
              <a href={r.photo || r.photo_url} target="_blank" rel="noreferrer" title="Open dial photo">
                <img src={r.photo || r.photo_url} alt="dial" className="h-8 w-12 rounded object-cover ring-1 ring-line" />
              </a>
            ) : (
              <span className="text-xs text-slate-light">—</span>
            ),
        },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      rowActions={(r, h) =>
        can("VALIDATE_READING") && r.status === "PENDING" ? (
          <>
            <Button size="sm" variant="ok" onClick={() => act(h, r, "validate")}>
              Validate
            </Button>
            <Button size="sm" variant="ghost" className="!text-bad" onClick={() => act(h, r, "reject")}>
              Reject
            </Button>
          </>
        ) : null
      }
      fields={[
        {
          name: "meter",
          label: "Meter",
          type: "lookup",
          required: true,
          lookup: {
            endpoint: "/api/meters/",
            labelKey: (r: any) => `${r.meter_id} · ${r.customer_name || "unassigned"} · last ${r.current_reading}`,
            params: { status: "ACTIVE" },
          },
        },
        { name: "reading_value", label: "Current dial reading (m³)", type: "number", step: "0.001", required: true },
        { name: "reading_date", label: "Reading date", type: "date", defaultValue: today, required: true },
        { name: "source", label: "Source", type: "select", options: READING_SOURCE, defaultValue: "MANUAL" },
        {
          name: "photo_url",
          label: "Photo URL (optional)",
          hint: "Field readers attach photos from the phone; office entries can link one here.",
        },
        { name: "latitude", label: "Latitude", type: "number", step: "0.000001" },
        { name: "longitude", label: "Longitude", type: "number", step: "0.000001" },
        { name: "notes", label: "Notes", type: "textarea", span: 2 },
      ]}
    />
  );
}
