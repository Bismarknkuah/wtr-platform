export const ghs = (v: any) => {
  const n = Number(v || 0);
  return `GHS ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const m3 = (v: any) => `${Number(v || 0).toLocaleString("en-GH", { maximumFractionDigits: 1 })} m³`;
export const num = (v: any) => Number(v || 0).toLocaleString("en-GH");
export const pct = (v: any) => (v === null || v === undefined ? "—" : `${Number(v).toFixed(1)}%`);
export const date = (v: any) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const datetime = (v: any) =>
  v ? new Date(v).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const title = (s: any) =>
  String(s || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
export const today = () => new Date().toISOString().slice(0, 10);
