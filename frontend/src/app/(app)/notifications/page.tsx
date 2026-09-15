"use client";
/** Notifications — outbox (all channels), send to one customer, broadcast. */
import { useState } from "react";
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Checkbox, Field, Modal, Textarea, useToast } from "@/components/ui";
import { LookupSelect } from "@/components/ResourcePage";
import { api } from "@/lib/api";
import { datetime, title } from "@/lib/format";
const CH = ["PORTAL", "SMS", "WHATSAPP", "EMAIL"].map((v) => ({ value: v, label: title(v) }));
const ST = ["QUEUED", "SENT", "FAILED"].map((v) => ({ value: v, label: title(v) }));
export default function NotificationsPage() {
  const { can } = useAuth();
  const { push } = useToast();
  const [mode, setMode] = useState<"send" | "broadcast" | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState<() => void>(() => () => {});
  const go = async () => {
    setBusy(true);
    try {
      const d =
        mode === "send"
          ? await api("/api/notifications/send/", {
              body: { customer: f.customer, message: f.message, ...(f.community ? { community: f.community } : {}) },
            })
          : await api("/api/notifications/broadcast/", {
              body: { message: f.message, staff_only: !!f.staff_only, ...(f.community ? { community: f.community } : {}) },
            });
      push(mode === "send" ? "Message sent" : `Broadcast queued to ${d.sent ?? d.count ?? "all"} recipients`);
      setMode(null);
      reload();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ResourcePage
        endpoint="/api/notifications/"
        title="Notifications"
        subtitle="Everything sent to customers and staff: bills, receipts, reminders, outages, tickets. Delivery status per channel."
        ordering="-created_at"
        filters={[
          { name: "channel", label: "Channel", options: CH },
          { name: "status", label: "Status", options: ST },
        ]}
        headerActions={(h) => {
          setReload(() => h.reload);
          return can("SEND_NOTIFICATIONS") ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setF({ community: h.community });
                  setMode("send");
                }}
              >
                Message a customer
              </Button>
              <Button
                onClick={() => {
                  setF({ community: h.community });
                  setMode("broadcast");
                }}
              >
                Broadcast
              </Button>
            </>
          ) : null;
        }}
        columns={[
          { key: "created_at", label: "When", render: (r) => datetime(r.created_at) },
          { key: "event", label: "Event", render: (r) => <Badge value={r.event} /> },
          { key: "channel", label: "Channel", render: (r) => title(r.channel) },
          {
            key: "recipient",
            label: "To",
            render: (r) => (
              <div>
                {r.customer_name || ""}
                <div className="text-xs text-slate">{r.recipient}</div>
              </div>
            ),
          },
          { key: "message", label: "Message", render: (r) => <span className="text-xs">{r.message}</span> },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <span>
                <Badge value={r.status} />
                {r.error && <div className="text-xs text-bad">{r.error}</div>}
              </span>
            ),
          },
        ]}
      />
      <Modal open={!!mode} onClose={() => setMode(null)} title={mode === "send" ? "Message a customer" : "Broadcast to the community"}>
        <div className="space-y-3">
          {mode === "send" && (
            <Field label="Customer *">
              <LookupSelect
                f={{
                  name: "customer",
                  label: "",
                  type: "lookup",
                  lookup: { endpoint: "/api/customers/", labelKey: (r: any) => `${r.household_name} · ${r.customer_id} · ${r.phone}` },
                }}
                value={f.customer}
                onChange={(v) => setF({ ...f, customer: v })}
                community={f.community || ""}
              />
            </Field>
          )}
          <Field label="Message *">
            <Textarea
              rows={4}
              value={f.message || ""}
              onChange={(e: any) => setF({ ...f, message: e.target.value })}
              placeholder="Keep SMS under 160 characters where possible."
            />
          </Field>
          {mode === "broadcast" && (
            <Checkbox
              label="Staff only (not customers)"
              checked={!!f.staff_only}
              onChange={(e: any) => setF({ ...f, staff_only: e.target.checked })}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={go} disabled={!f.message || (mode === "send" && !f.customer)}>
              Send
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
