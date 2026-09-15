"use client";
/** Ticket detail — timeline, comments (internal/customer), assign, transition, rate. Shared by staff and customer portal. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Checkbox, Field, Input, KV, PageHeader, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { LookupSelect } from "@/components/ResourcePage";
import { PRIORITY } from "@/lib/options";
import { datetime, title } from "@/lib/format";

const NEXT: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
};
export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const { push } = useToast();
  const [t, setT] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [assign, setAssign] = useState<any>({});
  const [resolution, setResolution] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api(`/api/tickets/${id}/`)
      .then(setT)
      .catch((e) => push(e.message, "bad"));
    api(`/api/tickets/${id}/comments/`)
      .then((d) => setComments(d.results || d))
      .catch(() => {});
  }, [id]); // eslint-disable-line
  useEffect(() => {
    load();
  }, [load]);
  if (!t) return <Spinner />;
  const isCustomer = user?.role === "CUSTOMER";
  const go = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      push(ok);
      load();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader
        title={`${t.ticket_number} · ${t.title}`}
        subtitle={
          <span>
            {title(t.category)} · <Badge value={t.priority} /> · <Badge value={t.status} /> · raised {datetime(t.created_at)} by{" "}
            {t.raised_by_name || "customer"}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Description">
            <p className="whitespace-pre-wrap text-sm">{t.description}</p>
            {t.location && <p className="mt-2 text-xs text-slate">Location: {t.location}</p>}
            {t.resolution && (
              <div className="mt-3 rounded-md bg-ok/10 p-3 text-sm">
                <b>Resolution:</b> {t.resolution}
              </div>
            )}
            {t.satisfaction_rating && (
              <div className="mt-2 text-sm">
                Customer rating: {"★".repeat(t.satisfaction_rating)}
                {"☆".repeat(5 - t.satisfaction_rating)} {t.satisfaction_comment}
              </div>
            )}
          </Card>
          <Card title={`Updates (${comments.length})`}>
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className={`rounded-md p-3 text-sm ${c.is_internal ? "bg-warn/10" : "bg-wash"}`}>
                  <div className="mb-1 flex justify-between text-xs text-slate">
                    <span>
                      <b>{c.author_name || "Customer"}</b>
                      {c.is_internal && " · internal note"}
                    </span>
                    <span>{datetime(c.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
            {!["CLOSED", "CANCELLED"].includes(t.status) && (
              <form
                className="mt-4 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!body.trim()) return;
                  go(async () => {
                    await api(`/api/tickets/${id}/add_comment/`, { body: { body, is_internal: internal } });
                    setBody("");
                  }, "Update posted");
                }}
              >
                <Textarea
                  placeholder={isCustomer ? "Add more details…" : "Update the customer or leave an internal note…"}
                  value={body}
                  onChange={(e: any) => setBody(e.target.value)}
                />
                <div className="flex items-center justify-between">
                  {!isCustomer ? (
                    <Checkbox
                      label="Internal note (hidden from customer)"
                      checked={internal}
                      onChange={(e: any) => setInternal(e.target.checked)}
                    />
                  ) : (
                    <span />
                  )}
                  <Button type="submit" loading={busy}>
                    Post
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Details">
            <KV
              items={[
                [
                  "Customer",
                  t.customer_name ? (
                    <Link href={isCustomer ? "/dashboard" : `/customers/${t.customer}`} className="text-river">
                      {t.customer_name}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ["Phone", t.customer_phone || "—"],
                ["Assigned to", t.assigned_to_name || "unassigned"],
                ["Resolved", datetime(t.resolved_at)],
                ["Closed", datetime(t.closed_at)],
              ]}
            />
          </Card>
          {can("MANAGE_TICKETS") && !["CLOSED", "CANCELLED"].includes(t.status) && (
            <Card title="Assign">
              <div className="space-y-2">
                <LookupSelect
                  f={{
                    name: "assigned_to",
                    label: "",
                    type: "lookup",
                    lookup: {
                      endpoint: "/api/auth/users/",
                      labelKey: (r: any) => `${r.full_name} · ${title(r.role)}`,
                      params: { is_active: true },
                    },
                  }}
                  value={assign.assigned_to ?? t.assigned_to}
                  onChange={(v) => setAssign({ ...assign, assigned_to: v })}
                  community={String(t.community)}
                />
                <Select value={assign.priority ?? t.priority} onChange={(e: any) => setAssign({ ...assign, priority: e.target.value })}>
                  {PRIORITY.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button
                  className="w-full"
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    go(
                      () =>
                        api(`/api/tickets/${id}/assign/`, {
                          body: { assigned_to: assign.assigned_to ?? t.assigned_to, priority: assign.priority ?? t.priority },
                        }),
                      "Assigned",
                    )
                  }
                >
                  Save assignment
                </Button>
              </div>
            </Card>
          )}
          {(can("MANAGE_TICKETS") || t.assigned_to === user?.id) && NEXT[t.status] && (
            <Card title="Move forward">
              {NEXT[t.status].includes("RESOLVED") && (
                <Field label="Resolution note">
                  <Input value={resolution} onChange={(e: any) => setResolution(e.target.value)} placeholder="What was done" />
                </Field>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {NEXT[t.status].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={s === "CANCELLED" ? "ghost" : s === "RESOLVED" || s === "CLOSED" ? "ok" : "secondary"}
                    loading={busy}
                    onClick={() =>
                      go(() => api(`/api/tickets/${id}/transition/`, { body: { status: s, resolution } }), `Marked ${title(s)}`)
                    }
                  >
                    {title(s)}
                  </Button>
                ))}
              </div>
            </Card>
          )}
          {isCustomer && t.status === "RESOLVED" && (
            <Card title="Was this resolved to your satisfaction?">
              <div className="mb-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={`text-2xl ${n <= rating ? "text-warn" : "text-line"}`}
                    aria-label={`${n} stars`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <Input placeholder="Optional comment" value={resolution} onChange={(e: any) => setResolution(e.target.value)} />
              <Button
                className="mt-2 w-full"
                loading={busy}
                onClick={() =>
                  go(() => api(`/api/tickets/${id}/rate/`, { body: { rating, comment: resolution } }), "Thank you for your feedback")
                }
              >
                Submit & close
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
