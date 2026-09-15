"use client";
/**
 * Meter Reader dashboard.
 *
 * This is a field tool, designed for a phone in one hand:
 *   - the route list shows every household, what was read last time, and what to expect;
 *   - tapping "Read meter" opens a capture sheet with a large numeric input, live consumption
 *     preview, GPS capture, an optional photo of the dial (compressed on the phone) and notes;
 *   - a reader can also key in the number printed on any meter to read it directly (lookup);
 *   - readings are queued in localStorage first ("offline-first") and pushed to
 *     /api/readings/bulk_sync/ (idempotent by client_reading_id) when the device is online;
 *   - the reader can see which readings were validated, rejected or flagged by the office.
 *
 * Data: GET /api/dashboard/meter-reader/ (backend role_dashboards.py::meter_reader_dashboard)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, CloudUpload, ListChecks, MapPin, RefreshCw, Save, Search, WifiOff, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, Tabs, useToast } from "@/components/ui";
import { HeroBanner, KpiCard, KpiGrid, MiniBars, ProgressBar } from "@/components/dashboard/widgets";
import { date, m3, num, title } from "@/lib/format";

/* ------------------------------------------------------------------------------------------ */
/* Offline queue                                                                              */
/* ------------------------------------------------------------------------------------------ */

type Queued = {
  client_reading_id: string;
  meter: number;
  meter_id: string;
  household: string;
  previous_reading: string;
  reading_value: string;
  reading_date: string;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string;
  /** Optional dial photo, compressed to a JPEG data-URL on the phone. */
  photo_base64?: string;
  notes?: string;
  device_id: string;
  captured_at: string;
};

const QUEUE_KEY = "wtr_reading_queue_v1";

function loadQueue(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(q: Queued[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

/* ------------------------------------------------------------------------------------------ */
/* Capture sheet                                                                              */
/* ------------------------------------------------------------------------------------------ */

function CaptureSheet({
  stop,
  onClose,
  onSave,
}: {
  stop: any;
  onClose: () => void;
  onSave: (item: Omit<Queued, "client_reading_id" | "device_id" | "captured_at">) => void;
}) {
  const [value, setValue] = useState("");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [photo, setPhoto] = useState<string>(""); // data-URL preview (optional)
  const [photoBusy, setPhotoBusy] = useState(false);

  /** Shrink the picture on-device (max 1024 px, JPEG 0.7) so the offline queue and upload stay small. */
  const onPickPhoto = (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL("image/jpeg", 0.7));
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setPhotoBusy(false);
    };
    img.src = url;
  };
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsError, setGpsError] = useState("");

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      () => setGpsError("Could not get a GPS fix — the reading will still be saved"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  const prev = Number(stop.previous_reading);
  const consumption = value === "" ? null : Number(value) - prev;
  const avg = Number(stop.avg_consumption) || 0;
  const warning =
    consumption === null
      ? null
      : consumption < 0
        ? "Lower than the previous reading — it will be flagged as a reverse reading."
        : avg > 0 && consumption > avg * 2
          ? `More than double this household's average (${avg.toFixed(1)} m³) — possible leak; it will be flagged.`
          : avg > 0 && consumption < avg * 0.3 && consumption > 0
            ? `Well below the usual ${avg.toFixed(1)} m³ — it will be flagged as unusually low.`
            : consumption === 0
              ? "Zero consumption. Repeated zeros are flagged."
              : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-ink">{stop.household}</h2>
            <p className="text-xs text-slate">
              {stop.customer_id} · {stop.meter_id} · {stop.address || "no address on file"}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate hover:bg-wash" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-wash p-2">
            <div className="text-slate">Previous reading</div>
            <div className="text-lg font-extrabold text-ink">{stop.previous_reading}</div>
            <div className="text-[11px] text-slate-light">{stop.previous_date ? date(stop.previous_date) : "initial"}</div>
          </div>
          <div className="rounded-md bg-wash p-2">
            <div className="text-slate">Usual consumption</div>
            <div className="text-lg font-extrabold text-ink">{avg ? `${avg.toFixed(1)} m³` : "—"}</div>
            <div className="text-[11px] text-slate-light">per reading period</div>
          </div>
        </div>

        <Field label="Current dial reading (m³) *">
          <Input
            type="number"
            step="0.001"
            inputMode="decimal"
            autoFocus
            className="!h-14 !text-3xl font-extrabold tabular-nums"
            value={value}
            onChange={(e: any) => setValue(e.target.value)}
            placeholder={stop.previous_reading}
          />
        </Field>

        {consumption !== null && (
          <div className={`mt-2 rounded-md px-3 py-2 text-sm ${warning ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"}`}>
            Consumption <b>{consumption.toFixed(3)} m³</b>
            {warning && <div className="mt-0.5 text-xs">{warning}</div>}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Reading date">
            <Input type="date" value={readingDate} onChange={(e: any) => setReadingDate(e.target.value)} />
          </Field>
          <Field label="Photo of the dial (optional)">
            {photo ? (
              <div className="flex items-center gap-2">
                <img src={photo} alt="Meter dial" className="h-10 w-14 rounded object-cover" />
                <button type="button" className="text-xs font-semibold text-bad" onClick={() => setPhoto("")}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-line px-3 text-sm text-slate hover:border-river hover:text-river">
                <Camera className="h-4 w-4" />
                {photoBusy ? "Preparing…" : "Take / choose photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPickPhoto(e.target.files?.[0])}
                />
              </label>
            )}
          </Field>
        </div>
        <Field label="Notes">
          <Input
            value={notes}
            onChange={(e: any) => setNotes(e.target.value)}
            placeholder="Meter condition, access problems, customer remarks…"
          />
        </Field>

        <div className="mt-2 flex items-center gap-1 text-xs text-slate">
          <MapPin className="h-3.5 w-3.5" />
          {gps ? `GPS ${gps.lat}, ${gps.lng} (±${gps.acc} m)` : gpsError || "Getting GPS fix…"}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="lg"
            disabled={value === ""}
            onClick={() =>
              onSave({
                meter: stop.meter,
                meter_id: stop.meter_id,
                household: stop.household,
                previous_reading: stop.previous_reading,
                reading_value: value,
                reading_date: readingDate,
                latitude: gps?.lat ?? null,
                longitude: gps?.lng ?? null,
                photo_base64: photo || undefined,
                notes,
              })
            }
          >
            <Save className="h-4 w-4" />
            Save reading
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Page                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export default function MeterReaderDashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<Queued[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<Record<number, { status: string; flags?: string[]; error?: string }>>({});
  const [active, setActive] = useState<any>(null);
  const [tab, setTab] = useState<"route" | "recent">("route");
  const [filter, setFilter] = useState("");
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");

  /** Key in the number printed on the meter → open the capture sheet for that meter. */
  const lookupMeter = async (e?: any) => {
    e?.preventDefault();
    const number = lookupNumber.trim();
    if (!number) return;
    setLookupBusy(true);
    setLookupError("");
    try {
      const stop = await api("/api/meters/lookup/", { params: { number } });
      if (!stop.meter) throw new Error("No meter found");
      if (stop.meter_status !== "ACTIVE") {
        setLookupError(
          `Meter ${stop.serial_number} is ${title(stop.meter_status)} — a reading on it will be flagged. Continue if you are sure.`,
        );
      }
      setActive({ ...stop, route_name: "Keyed in" });
      setLookupNumber("");
    } catch (ex: any) {
      setLookupError(
        ex.status === 404 ? `No meter numbered "${number}" in your community. Check the digits on the meter face.` : ex.message,
      );
    } finally {
      setLookupBusy(false);
    }
  };
  const [onlyRemaining, setOnlyRemaining] = useState(false);

  const load = useCallback(() => {
    api("/api/dashboard/meter-reader/")
      .then(setD)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setQueue(loadQueue());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    load();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [load]);

  /** Push the offline queue. Items that error stay queued; everything else is dropped. */
  const sync = useCallback(async () => {
    const q = loadQueue();
    if (!q.length || syncing) return;
    setSyncing(true);
    try {
      const r = await api("/api/readings/bulk_sync/", {
        body: { readings: q.map(({ meter_id, household, previous_reading, captured_at, ...rest }) => rest) },
      });
      const next: typeof results = { ...results };
      const remaining: Queued[] = [];
      r.results.forEach((res: any, i: number) => {
        const item = q[i];
        if (res.status === "error") {
          next[item.meter] = { status: "error", error: res.error };
          remaining.push(item);
        } else {
          next[item.meter] = { status: res.flags?.length ? "flagged" : "synced", flags: res.flags };
        }
      });
      setResults(next);
      saveQueue(remaining);
      setQueue(remaining);
      const flagged = r.results.filter((x: any) => x.flags?.length).length;
      const errors = r.results.filter((x: any) => x.status === "error").length;
      push(
        `Synced ${r.results.length - errors} readings${flagged ? ` · ${flagged} flagged for the office to check` : ""}${errors ? ` · ${errors} failed and stay queued` : ""}`,
        errors ? "bad" : "ok",
      );
      load();
    } catch (e: any) {
      push(`Sync failed: ${e.message}. Your readings are still saved on this device.`, "bad");
    } finally {
      setSyncing(false);
    }
  }, [syncing, results, push, load]);

  // Auto-sync when connectivity returns.
  useEffect(() => {
    if (online && queue.length && !syncing) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const enqueue = (item: Omit<Queued, "client_reading_id" | "device_id" | "captured_at">) => {
    const q = loadQueue();
    const entry: Queued = {
      ...item,
      client_reading_id: crypto.randomUUID(),
      device_id: `web-${user?.id}`,
      captured_at: new Date().toISOString(),
    };
    // Replace an earlier unsynced capture for the same meter instead of duplicating it.
    const next = [...q.filter((x) => x.meter !== item.meter), entry];
    saveQueue(next);
    setQueue(next);
    setResults((r) => ({ ...r, [item.meter]: { status: "queued" } }));
    setActive(null);
    push(online ? "Saved — will upload with the next sync" : "Saved offline. It uploads automatically when you're back online.", "info");
  };

  const removeQueued = (meter: number) => {
    const next = loadQueue().filter((x) => x.meter !== meter);
    saveQueue(next);
    setQueue(next);
    setResults((r) => {
      const c = { ...r };
      delete c[meter];
      return c;
    });
  };

  const stops = useMemo(() => {
    const all = d?.routes.flatMap((r: any) => r.stops.map((s: any) => ({ ...s, route_name: r.name }))) || [];
    const q = filter.trim().toLowerCase();
    return all.filter((s: any) => {
      if (onlyRemaining && (s.read_this_month || results[s.meter])) return false;
      if (!q) return true;
      return `${s.household} ${s.customer_id} ${s.meter_id} ${s.address}`.toLowerCase().includes(q);
    });
  }, [d, filter, onlyRemaining, results]);

  if (error) return <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>;
  if (!d) return <Spinner />;

  const k = d.kpis;
  const capturedLocal = Object.keys(results).length;
  const statusBadge = (s: any) => {
    const r = results[s.meter];
    if (r) {
      if (r.status === "queued") return <Badge value="QUEUED" className="!bg-warn/10 !text-warn" />;
      if (r.status === "synced") return <Badge value="SYNCED" className="!bg-ok/10 !text-ok" />;
      if (r.status === "flagged") return <Badge value="FLAGGED" className="!bg-warn/10 !text-warn" />;
      if (r.status === "error") return <Badge value="FAILED" className="!bg-bad/10 !text-bad" />;
    }
    if (s.read_this_month) return <Badge value={s.last_status || "READ"} />;
    return <Badge value="TO READ" className="!bg-wash !text-slate" />;
  };

  return (
    <div>
      <PageHeader
        title={`Good day, ${user?.full_name?.split(" ")[0] || "reader"}`}
        subtitle={`${d.reader.community} · ${k.days_left_in_month} days left in the month`}
        actions={
          <div className="flex items-center gap-2">
            {!online && (
              <span className="inline-flex items-center gap-1 rounded bg-warn/10 px-2 py-1 text-xs font-bold text-warn">
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </span>
            )}
            <Button variant="secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={sync} loading={syncing} disabled={!queue.length || !online}>
              <CloudUpload className="h-4 w-4" />
              Sync {queue.length ? `(${queue.length})` : ""}
            </Button>
          </div>
        }
      />

      <HeroBanner
        eyebrow="Route progress this month"
        headline={`${k.read_this_month} / ${k.households_on_route}`}
        detail={
          k.remaining === 0
            ? "Every household on your route has been read this month. Great work."
            : `${k.remaining} households still to read · ${k.today} read today`
        }
        tone={k.progress >= 100 ? "ok" : "ink"}
        aside={
          <div className="w-48">
            <ProgressBar value={k.read_this_month} max={k.households_on_route} tone="ok" trackClass="bg-white/25" />
            <div className="mt-1 text-right text-xs text-white/70">{k.progress}%</div>
          </div>
        }
      />

      {/* ---------------------------------------------------------------- Key in a meter number */}
      <Card className="mb-4">
        <form onSubmit={lookupMeter} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1 text-xs font-semibold text-slate">Meter number (as printed on the meter)</div>
            <Input
              className="!h-12 !text-lg font-bold uppercase tracking-wide"
              placeholder="e.g. ABO-1004"
              value={lookupNumber}
              onChange={(e: any) => setLookupNumber(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </div>
          <Button type="submit" size="lg" loading={lookupBusy} disabled={!lookupNumber.trim()}>
            <Search className="h-4 w-4" />
            Find & read
          </Button>
        </form>
        {lookupError && <div className="mt-2 rounded bg-warn/10 px-3 py-2 text-sm text-warn">{lookupError}</div>}
        <p className="mt-2 text-xs text-slate">
          Works for any meter in your community, on or off your route. The photo of the dial is optional; GPS is captured automatically if
          the phone allows it.
        </p>
      </Card>

      <KpiGrid cols={5}>
        <KpiCard
          label="Waiting to sync"
          value={num(queue.length)}
          tone={queue.length ? "warn" : "ok"}
          sub={online ? "device online" : "will upload when online"}
          icon={<CloudUpload className="h-4 w-4" />}
        />
        <KpiCard label="Captured this session" value={num(capturedLocal)} tone="river" icon={<ListChecks className="h-4 w-4" />} />
        <KpiCard
          label="Validated this month"
          value={num(k.validated_month)}
          tone="ok"
          sub="accepted by the office"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <KpiCard
          label="Pending validation"
          value={num(k.pending_validation)}
          sub={`${k.flagged} flagged`}
          tone={k.flagged ? "warn" : "ink"}
        />
        <KpiCard label="Rejected this month" value={num(k.rejected_month)} tone={k.rejected_month ? "bad" : "ok"} sub="need re-reading" />
      </KpiGrid>

      <Tabs
        tabs={[
          { key: "route", label: `My route (${stops.length})` },
          { key: "recent", label: "My recent readings" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as any)}
      />

      {tab === "route" && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-light" />
              <Input
                className="!pl-8"
                placeholder="Find a household, ID, meter or address…"
                value={filter}
                onChange={(e: any) => setFilter(e.target.value)}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate">
              <input type="checkbox" checked={onlyRemaining} onChange={(e) => setOnlyRemaining(e.target.checked)} />
              Only households still to read
            </label>
          </div>

          {!d.routes.length ? (
            <Card>
              <div className="py-10 text-center text-sm text-slate">
                No active route is assigned to you yet. Ask your water manager to add you to a reading route.
              </div>
            </Card>
          ) : (
            <Card>
              <ul className="divide-y divide-line/60">
                {stops.map((s: any) => {
                  const res = results[s.meter];
                  return (
                    <li key={s.customer} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{s.household}</span>
                          <span className="text-xs text-slate">{s.customer_id}</span>
                          {statusBadge(s)}
                        </div>
                        <div className="mt-0.5 text-xs text-slate">
                          {s.address || "No address"} · {s.route_name}
                          {s.meter_id ? (
                            <>
                              {" "}
                              · <b className="text-ink">{s.meter_id}</b> last <b className="text-ink">{s.previous_reading}</b>
                              {s.previous_date ? ` on ${date(s.previous_date)}` : ""} · usual {Number(s.avg_consumption).toFixed(1)} m³
                            </>
                          ) : (
                            <span className="text-warn"> · no active meter</span>
                          )}
                        </div>
                        {res?.error && <div className="mt-0.5 text-xs text-bad">Upload failed: {res.error}</div>}
                        {res?.flags?.length ? (
                          <div className="mt-0.5 text-xs text-warn">Flagged: {res.flags.map((f) => title(f)).join(", ")}</div>
                        ) : null}
                        {s.last_flags?.length && !res ? (
                          <div className="mt-0.5 text-xs text-warn">
                            Last reading flagged: {s.last_flags.map((f: string) => title(f)).join(", ")}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {res?.status === "queued" && (
                          <Button size="sm" variant="ghost" onClick={() => removeQueued(s.meter)}>
                            Discard
                          </Button>
                        )}
                        {s.meter && (
                          <Button size="sm" variant={s.read_this_month || res ? "secondary" : "primary"} onClick={() => setActive(s)}>
                            {s.read_this_month || res ? "Re-read" : "Read meter"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
                {!stops.length && <li className="py-8 text-center text-sm text-slate">Nothing matches.</li>}
              </ul>
            </Card>
          )}
        </>
      )}

      {tab === "recent" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Readings submitted — last 14 days">
            <MiniBars data={d.daily_activity} dataKey="count" height={110} />
            <p className="mt-2 text-xs text-slate">Readings uploaded per day, including offline batches.</p>
          </Card>
          <Card title="Latest readings" className="lg:col-span-2">
            <ul className="divide-y divide-line/60">
              {d.recent.map((r: any) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className="font-semibold text-ink">{r.household}</span>{" "}
                    <span className="text-xs text-slate">
                      {r.meter_code} · {date(r.reading_date)}
                    </span>
                    <div className="text-xs text-slate">
                      {r.previous_reading} → {r.reading_value} = <b className="text-ink">{m3(r.consumption)}</b>
                      {r.anomaly_note && <span className="text-warn"> · {r.anomaly_note}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.anomaly_flags?.map((f: string) => (
                      <Badge key={f} value={f} className="!bg-warn/10 !text-warn" />
                    ))}
                    <Badge value={r.status} />
                  </div>
                </li>
              ))}
              {!d.recent.length && <li className="py-8 text-center text-sm text-slate">You haven't submitted any readings yet.</li>}
            </ul>
          </Card>
        </div>
      )}

      {active && <CaptureSheet stop={active} onClose={() => setActive(null)} onSave={enqueue} />}
    </div>
  );
}
