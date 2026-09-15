"use client";
/**
 * Public problem-reporting page — reached by scanning the community's QR code or opening its
 * public link. No account, no login: anyone can tell the water office about a leak, dry taps,
 * dirty water or an illegal connection. The report becomes a service request tagged
 * source=PUBLIC in the community's queue and staff are notified.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Droplets, MapPin, Send } from "lucide-react";
import { API_URL } from "@/lib/api";

type Info = {
  community: string;
  region: string;
  district: string;
  contact_phone: string;
  towns: { id: number; name: string }[];
  categories: { value: string; label: string }[];
};

const ICONS: Record<string, string> = {
  NO_WATER: "🚱",
  LEAK: "💧",
  LOW_PRESSURE: "🔻",
  WATER_QUALITY: "🧪",
  METER_FAULT: "🔧",
  ILLEGAL_CONNECTION: "⚠️",
  OTHER: "💬",
};

export default function PublicReportPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category: "", town: "", location: "", description: "", reporter_name: "", reporter_phone: "" });
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ticket_number: string; message: string } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/public/report/${token}/`)
      .then(async (r) => {
        if (!r.ok) throw new Error("This reporting link is not valid or the community is not active.");
        return r.json();
      })
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [token]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setGps({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/api/public/report/${token}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, town: form.town || null, latitude: gps?.lat, longitude: gps?.lng }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.description?.[0] || d.detail || "Could not send the report. Please try again.");
      setDone(d);
    } catch (ex: any) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-ink px-5 py-4 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-river">
            <Droplets className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/60">Report a water problem</div>
            <div className="text-lg font-extrabold">{info?.community || "…"}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {error && !info && (
          <div className="rounded-lg bg-white p-6 text-center shadow-card">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-bad" />
            <div className="font-bold text-ink">{error}</div>
            <p className="mt-1 text-sm text-slate">Ask the water office for the current link or QR code.</p>
          </div>
        )}

        {done && (
          <div className="rounded-lg bg-white p-6 text-center shadow-card">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-ok" />
            <div className="text-xl font-extrabold text-ink">Report received</div>
            <p className="mt-1 text-sm text-slate">{done.message}</p>
            <div className="mt-4 rounded-md bg-wash p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate">Your reference</div>
              <div className="text-2xl font-extrabold tabular-nums text-ink">{done.ticket_number}</div>
            </div>
            {info?.contact_phone && <p className="mt-4 text-xs text-slate">Urgent? Call the water office on {info.contact_phone}.</p>}
            <button
              className="mt-4 text-sm font-semibold text-river"
              onClick={() => {
                setDone(null);
                setForm({ category: "", town: "", location: "", description: "", reporter_name: "", reporter_phone: "" });
              }}
            >
              Report another problem
            </button>
          </div>
        )}

        {info && !done && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-white p-4 shadow-card">
              <div className="mb-2 text-sm font-bold text-ink">What is the problem?</div>
              <div className="grid grid-cols-2 gap-2">
                {info.categories.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.value })}
                    className={`rounded-md border px-3 py-3 text-left text-sm transition ${form.category === c.value ? "border-river bg-river-soft font-bold text-ink" : "border-line bg-white text-slate"}`}
                  >
                    <span className="mr-2">{ICONS[c.value] || "•"}</span>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-card">
              <div className="mb-2 text-sm font-bold text-ink">Where?</div>
              {info.towns.length > 0 && (
                <select
                  className="mb-2 h-11 w-full rounded-md border border-line px-3 text-sm"
                  value={form.town}
                  onChange={(e) => setForm({ ...form, town: e.target.value })}
                >
                  <option value="">Choose the town…</option>
                  {info.towns.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                className="h-11 w-full rounded-md border border-line px-3 text-sm"
                placeholder="Landmark or street, e.g. near the JHS, opposite the chemist"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <button
                type="button"
                onClick={useMyLocation}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-river"
              >
                <MapPin className="h-3.5 w-3.5" />
                {gps ? `Location attached (${gps.lat}, ${gps.lng})` : "Use my phone's location"}
              </button>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-card">
              <div className="mb-2 text-sm font-bold text-ink">Tell us more *</div>
              <textarea
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                rows={3}
                required
                minLength={5}
                placeholder="Since when? How bad is it? Anything the team should know."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="rounded-lg bg-white p-4 shadow-card">
              <div className="mb-2 text-sm font-bold text-ink">Your details (optional)</div>
              <p className="mb-2 text-xs text-slate">
                If you give a phone number the office can call you back, and we can link the report to your water account.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className="h-11 rounded-md border border-line px-3 text-sm"
                  placeholder="Name"
                  value={form.reporter_name}
                  onChange={(e) => setForm({ ...form, reporter_name: e.target.value })}
                />
                <input
                  className="h-11 rounded-md border border-line px-3 text-sm"
                  placeholder="Phone number"
                  inputMode="tel"
                  value={form.reporter_phone}
                  onChange={(e) => setForm({ ...form, reporter_phone: e.target.value })}
                />
              </div>
            </div>

            {error && <div className="rounded bg-bad/10 px-3 py-2 text-sm text-bad">{error}</div>}
            <button
              type="submit"
              disabled={busy || !form.category || form.description.trim().length < 5}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-river text-base font-bold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy ? "Sending…" : "Send report"}
            </button>
            <p className="text-center text-[11px] text-slate">
              {info.community} · {info.district}, {info.region} · powered by WTR Ghana
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
