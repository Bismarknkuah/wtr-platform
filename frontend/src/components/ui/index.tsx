"use client";
import { Fragment, ReactNode, forwardRef, useEffect, createContext, useContext, useState, useCallback } from "react";
import { X, Loader2, Inbox } from "lucide-react";

/* ----- Buttons & inputs -------------------------------------------------- */
export function Button({ children, variant = "primary", size = "md", loading, className = "", ...rest }: any) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-river disabled:opacity-50 disabled:cursor-not-allowed";
  const v: Record<string, string> = {
    primary: "bg-river text-white hover:bg-river-light",
    secondary: "bg-white text-ink border border-line hover:bg-wash",
    ghost: "text-ink hover:bg-wash",
    danger: "bg-bad text-white hover:opacity-90",
    ok: "bg-ok text-white hover:opacity-90",
    dark: "bg-ink text-white hover:bg-ink-2",
  };
  const s: Record<string, string> = { sm: "text-xs px-2.5 py-1.5", md: "text-sm px-3.5 py-2", lg: "text-base px-5 py-2.5" };
  return (
    <button className={`${base} ${v[variant]} ${s[size]} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
export const Input = forwardRef<HTMLInputElement, any>(function Input({ className = "", ...p }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-light focus:border-river focus:outline-none focus:ring-2 focus:ring-river/20 ${className}`}
      {...p}
    />
  );
});
export const Textarea = ({ className = "", ...p }: any) => (
  <textarea
    className={`w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-river focus:outline-none focus:ring-2 focus:ring-river/20 ${className}`}
    rows={3}
    {...p}
  />
);
export const Select = ({ className = "", children, ...p }: any) => (
  <select
    className={`w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-river focus:outline-none focus:ring-2 focus:ring-river/20 ${className}`}
    {...p}
  >
    {children}
  </select>
);
export const Field = ({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) => (
  <label className={`block ${className}`}>
    <span className="mb-1 block text-xs font-semibold text-slate">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-slate-light">{hint}</span>}
  </label>
);
export const Checkbox = ({ label, ...p }: any) => (
  <label className="inline-flex items-center gap-2 text-sm text-ink">
    <input type="checkbox" className="h-4 w-4 rounded border-line text-river focus:ring-river" {...p} />
    {label}
  </label>
);

/* ----- Layout primitives -------------------------------------------------- */
export const Card = ({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) => (
  <section className={`rounded-lg bg-white shadow-card ${className}`}>
    {(title || action) && (
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {action}
      </header>
    )}
    <div className="p-4">{children}</div>
  </section>
);
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export const Stat = ({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "ink" | "ok" | "warn" | "bad" | "river";
}) => {
  const t: Record<string, string> = { ink: "text-ink", ok: "text-ok", warn: "text-warn", bad: "text-bad", river: "text-river" };
  return (
    <div className="rounded-lg bg-white p-4 shadow-card">
      <div className="text-xs font-semibold text-slate">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${t[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-light">{sub}</div>}
    </div>
  );
};
export const Empty = ({ title = "Nothing here yet", hint, action }: { title?: string; hint?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
    <Inbox className="h-8 w-8 text-slate-light" />
    <div className="text-sm font-semibold text-ink">{title}</div>
    {hint && <div className="max-w-sm text-xs text-slate">{hint}</div>}
    {action}
  </div>
);
export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center gap-2 py-10 text-sm text-slate">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);

const TONES: Record<string, string> = {
  ACTIVE: "bg-ok/10 text-ok",
  PAID: "bg-ok/10 text-ok",
  CARRIED_FORWARD: "bg-wash text-slate",
  SUCCESSFUL: "bg-ok/10 text-ok",
  VALIDATED: "bg-ok/10 text-ok",
  COMPLIANT: "bg-ok/10 text-ok",
  OPERATIONAL: "bg-ok/10 text-ok",
  EXECUTED: "bg-ok/10 text-ok",
  APPROVED: "bg-ok/10 text-ok",
  RESTORED: "bg-ok/10 text-ok",
  CLOSED: "bg-ok/10 text-ok",
  RESOLVED: "bg-ok/10 text-ok",
  LOW: "bg-ok/10 text-ok",
  SENT: "bg-ok/10 text-ok",
  GOOD: "bg-ok/10 text-ok",
  EXCELLENT: "bg-ok/10 text-ok",
  BILLED: "bg-river-soft text-river",
  PENDING: "bg-warn/10 text-warn",
  PARTIALLY_PAID: "bg-warn/10 text-warn",
  ISSUED: "bg-river-soft text-river",
  OPEN: "bg-river-soft text-river",
  ASSIGNED: "bg-river-soft text-river",
  IN_PROGRESS: "bg-warn/10 text-warn",
  MEDIUM: "bg-warn/10 text-warn",
  ALERT: "bg-warn/10 text-warn",
  DEGRADED: "bg-warn/10 text-warn",
  UNDER_MAINTENANCE: "bg-warn/10 text-warn",
  SUSPENDED: "bg-warn/10 text-warn",
  FAIR: "bg-warn/10 text-warn",
  GENERATED: "bg-river-soft text-river",
  QUEUED: "bg-warn/10 text-warn",
  RESPONDING: "bg-warn/10 text-warn",
  INSTALLED: "bg-river-soft text-river",
  AVAILABLE: "bg-wash text-slate",
  OVERDUE: "bg-bad/10 text-bad",
  FAILED: "bg-bad/10 text-bad",
  REJECTED: "bg-bad/10 text-bad",
  HIGH: "bg-bad/10 text-bad",
  URGENT: "bg-bad/10 text-bad",
  CRITICAL: "bg-bad/10 text-bad",
  NON_COMPLIANT: "bg-bad/10 text-bad",
  FAULTY: "bg-bad/10 text-bad",
  BLOCKED: "bg-bad/10 text-bad",
  DISCONNECTED: "bg-bad/10 text-bad",
  CANCELLED: "bg-wash text-slate",
  REVERSED: "bg-bad/10 text-bad",
  REFUNDED: "bg-wash text-slate",
  "AT RISK": "bg-bad/10 text-bad",
  INACTIVE: "bg-wash text-slate",
  REMOVED: "bg-wash text-slate",
  REPLACED: "bg-wash text-slate",
  RETIRED: "bg-wash text-slate",
  DECOMMISSIONED: "bg-wash text-slate",
  DRAFT: "bg-wash text-slate",
};
export const Badge = ({ value, className = "" }: { value: any; className?: string }) => (
  <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${TONES[String(value)] || "bg-wash text-slate"} ${className}`}>
    {String(value ?? "—").replace(/_/g, " ")}
  </span>
);

/* ----- Modal -------------------------------------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-xl"} rounded-lg bg-white shadow-xl`} role="dialog" aria-modal="true">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate hover:bg-wash" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ----- Table -------------------------------------------------------------- */
export type Column<T = any> = { key: string; label: ReactNode; render?: (row: T) => ReactNode; className?: string };
export function Table<T = any>({
  columns,
  rows,
  onRowClick,
  empty,
  keyField = "id",
  expanded,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (r: T) => void;
  empty?: ReactNode;
  keyField?: string;
  /** Optional detail row rendered directly under a row (return null to render nothing). */
  expanded?: (r: T) => ReactNode;
}) {
  if (!rows?.length) return <>{empty || <Empty />}</>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold text-slate">
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 ${c.className || ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => {
            const detail = expanded ? expanded(r) : null;
            return (
              <Fragment key={r[keyField]}>
                <tr
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`border-b border-line/60 last:border-0 ${onRowClick ? "cursor-pointer hover:bg-wash/60" : ""}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 align-top text-ink ${c.className || ""}`}>
                      {c.render ? c.render(r) : (r[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
                {detail && (
                  <tr className="border-b border-line/60">
                    <td colSpan={columns.length} className="p-0">
                      {detail}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({
  page,
  count,
  pageSize = 25,
  onChange,
}: {
  page: number;
  count: number;
  pageSize?: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate">
      <span>
        {count} records · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="mb-4 flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${value === t.key ? "border-river text-river" : "border-transparent text-slate hover:text-ink"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
export const KV = ({ items }: { items: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
    {items.map(([k, v]) => (
      <div key={k} className="flex justify-between gap-3 border-b border-line/60 py-1.5">
        <dt className="text-slate">{k}</dt>
        <dd className="text-right font-semibold text-ink">{v ?? "—"}</dd>
      </div>
    ))}
  </dl>
);

/* ----- Toasts ------------------------------------------------------------- */
type Toast = { id: number; text: string; tone: "ok" | "bad" | "info" };
const ToastCtx = createContext<{ push: (text: string, tone?: Toast["tone"]) => void }>({ push: () => {} });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {list.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md px-4 py-3 text-sm font-semibold text-white shadow-lg ${t.tone === "ok" ? "bg-ok" : t.tone === "bad" ? "bg-bad" : "bg-ink"}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
