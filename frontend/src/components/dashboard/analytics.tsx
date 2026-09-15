"use client";
/**
 * Analytics blocks shared by the Finance Officer and Water Manager dashboards.
 *
 * Each is a small, self-contained chart that takes the `analytics` object returned by
 * /api/dashboard/finance/ or /api/dashboard/operations/ and answers one question:
 *
 *   EfficiencyTrend      – are we collecting a bigger share of what we bill, month by month?
 *   StackedByMonth       – how does revenue split by customer type / payment channel over time?
 *   WeekdayPattern       – which days of the week does money come in?
 *   ConsumptionByCategory– who uses the water, and how much per connection?
 *   CoverageTrend        – are we reading every meter every month?
 *   AnomalyTrend         – are readings getting cleaner or noisier?
 */
import { Bar, BarChart, CartesianGrid, Legend as RLegend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ghs, m3, num, title } from "@/lib/format";

const PALETTE = ["#1D6FA5", "#0F8B6E", "#C77A14", "#10243A", "#3B8ECB", "#B3261E", "#7A8A99", "#6C4AB6"];
const axis = { fontSize: 10, fill: "#4A5B6B" };

export function EfficiencyTrend({ trend }: { trend: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={trend}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={34} unit="%" domain={[0, 120]} />
        <Tooltip formatter={(v: any) => (v == null ? "no bills" : `${v}%`)} />
        <Line type="monotone" dataKey="efficiency" name="Collected ÷ billed" stroke="#0F8B6E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StackedByMonth({ data, keys, format = ghs }: { data: any[]; keys: string[]; format?: (v: any) => string }) {
  if (!keys.length) return <div className="py-8 text-center text-sm text-slate">Not enough history yet.</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(v: any) => format(v)} />
        <RLegend wrapperStyle={{ fontSize: 11 }} formatter={(v) => title(v)} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="a"
            fill={PALETTE[i % PALETTE.length]}
            radius={i === keys.length - 1 ? [3, 3, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeekdayPattern({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data}>
        <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: any) => ghs(v)} cursor={{ fill: "#EAF2F8" }} />
        <Bar dataKey="total" name="Collected" fill="#1D6FA5" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConsumptionByCategory({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="py-8 text-center text-sm text-slate">No validated readings this month yet.</div>;
  const total = rows.reduce((a, r) => a + r.m3, 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-wash">
        {rows.map((r, i) => (
          <div
            key={r.category}
            style={{ width: `${(r.m3 / total) * 100}%`, background: PALETTE[i % PALETTE.length] }}
            title={`${title(r.category)} ${m3(r.m3)}`}
          />
        ))}
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-[11px] font-bold text-slate">
            <th className="py-1 text-left">Category</th>
            <th className="py-1 text-right">Connections</th>
            <th className="py-1 text-right">Total</th>
            <th className="py-1 text-right">Per connection</th>
            <th className="py-1 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.category} className="border-t border-line/60">
              <td className="py-1.5">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                {title(r.category)}
              </td>
              <td className="py-1.5 text-right tabular-nums">{num(r.connections)}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{m3(r.m3)}</td>
              <td className="py-1.5 text-right tabular-nums">{m3(r.per_connection)}</td>
              <td className="py-1.5 text-right tabular-nums text-slate">{Math.round((r.m3 / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoverageTrend({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={34} unit="%" domain={[0, 100]} />
        <Tooltip formatter={(v: any, n: any, p: any) => [`${v}% (${p.payload.read}/${p.payload.total})`, "Meters read"]} />
        <Line type="monotone" dataKey="percent" name="Meters read" stroke="#1D6FA5" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AnomalyTrend({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip />
        <RLegend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="readings" name="Readings" fill="#DCE5EE" radius={[3, 3, 0, 0]} />
        <Bar dataKey="flagged" name="Flagged" fill="#C77A14" radius={[3, 3, 0, 0]} />
        <Bar dataKey="rejected" name="Rejected" fill="#B3261E" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
