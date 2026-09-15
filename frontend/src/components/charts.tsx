"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
const C = { ink: "#10243A", river: "#1D6FA5", light: "#7FB6DC", ok: "#0F8B6E", warn: "#C77A14", bad: "#B3261E", slate: "#7A8A99" };
const fmt = (v: any) => Number(v).toLocaleString("en-GH", { maximumFractionDigits: 0 });

export function BilledVsCollected({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barGap={2}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} tickFormatter={fmt} width={48} />
        <Tooltip formatter={(v: any) => `GHS ${fmt(v)}`} contentStyle={{ fontSize: 12 }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="billed" name="Billed" fill={C.light} radius={[3, 3, 0, 0]} />
        <Bar dataKey="collected" name="Collected" fill={C.river} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
export function ConsumptionLine({ data, dataKey = "consumption", xKey = "month" }: { data: any[]; dataKey?: string; xKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid stroke="#EAF2F8" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.slate }} axisLine={false} tickLine={false} width={40} />
        <Tooltip formatter={(v: any) => `${fmt(v)} m³`} contentStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey={dataKey} name="Consumption" stroke={C.river} strokeWidth={2.5} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
export function Donut({ data, nameKey, valueKey }: { data: any[]; nameKey: string; valueKey: string }) {
  const cols = [C.river, C.ok, C.warn, C.ink, C.light, C.bad, C.slate];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={cols[i % cols.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ fontSize: 12 }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
export function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 44,
    c = 2 * Math.PI * r,
    off = c - (score / 100) * c;
  const col = score >= 85 ? C.ok : score >= 70 ? C.river : score >= 50 ? C.warn : C.bad;
  return (
    <div className="flex items-center gap-4">
      <svg width="110" height="110" viewBox="0 0 110 110" aria-label={`Score ${score}`}>
        <circle cx="55" cy="55" r={r} stroke="#EAF2F8" strokeWidth="10" fill="none" />
        <circle
          cx="55"
          cy="55"
          r={r}
          stroke={col}
          strokeWidth="10"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="60" textAnchor="middle" fontSize="24" fontWeight="800" fill={C.ink}>
          {score}
        </text>
      </svg>
      <div>
        <div className="text-xs font-semibold text-slate">Sustainability score</div>
        <div className="text-lg font-extrabold" style={{ color: col }}>
          {grade}
        </div>
      </div>
    </div>
  );
}
