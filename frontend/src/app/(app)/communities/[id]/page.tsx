"use client";
/** Single community: profile, billing policy & settings, staff summary. */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Checkbox, Field, Input, KV, PageHeader, Select, Spinner, Tabs, useToast } from "@/components/ui";
import { FREQUENCY } from "@/lib/options";
import { TownsPanel } from "@/components/TownsPanel";
import { date, num, title } from "@/lib/format";

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const { can, isPlatform } = useAuth();
  const { push } = useToast();
  const [c, setC] = useState<any>(null);
  const [s, setS] = useState<any>(null);
  const [tab, setTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  useEffect(() => {
    api(`/api/communities/${id}/`)
      .then(setC)
      .catch((e) => push(e.message, "bad"));
    if (!isPlatform) {
      // Billing policy belongs to the community; platform staff are not shown it at all.
      api(`/api/communities/${id}/settings/`)
        .then((d) => setS({ ...d, reminder_days: (d.reminder_days || []).join(", ") }))
        .catch(() => {});
    }
    api("/api/auth/users/", { params: { community: id, page_size: 50 } })
      .then((d) => setStaff(d.results))
      .catch(() => {});
  }, [id]); // eslint-disable-line
  if (!c) return <Spinner />;
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  const saveSettings = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...s,
        reminder_days: String(s.reminder_days)
          .split(",")
          .map((x) => parseInt(x.trim()))
          .filter((x) => !isNaN(x)),
      };
      delete body.id;
      delete body.community;
      const d = await api(`/api/communities/${id}/settings/`, { method: "PATCH", body });
      setS({ ...d, reminder_days: (d.reminder_days || []).join(", ") });
      push("Settings saved");
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setSaving(false);
    }
  };
  const editable = can("MANAGE_COMMUNITY_SETTINGS");
  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={
          <span>
            {c.code} · {c.region}, {c.district} · <Badge value={c.service_status} />
          </span>
        }
      />
      <Tabs
        tabs={[
          { key: "profile", label: "Profile" },
          ...(isPlatform
            ? []
            : [
                { key: "towns", label: "Towns" },
                { key: "settings", label: "Billing & policy" },
              ]),
          { key: "staff", label: isPlatform ? `Community admin (${staff.length})` : `Staff (${staff.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "profile" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Community">
            <KV
              items={[
                ["Code", c.code],
                ["Water system", title(c.water_system_type)],
                ["Water source", c.water_source || "—"],
                ["Town / municipality", [c.town, c.municipality].filter(Boolean).join(", ") || "—"],
                ["Households (est.)", num(c.households_count)],
                ["Customers", num(c.customers_total)],
                ["Active meters", num(c.active_meters)],
                ["Registered", date(c.registration_date)],
                ["Approved", date(c.approved_at)],
                ["Plan", c.plan_name || "—"],
              ]}
            />
          </Card>
          <Card title="Contacts">
            <KV
              items={[
                ["Community admin", c.admin_name || "not yet assigned"],
                ["Admin email", c.admin_email || "—"],
                ["Contact person", c.contact_name || "—"],
                ["Phone", c.contact_phone || "—"],
                ["Email", c.contact_email || "—"],
                ["Coordinates", c.latitude ? `${c.latitude}, ${c.longitude}` : "—"],
              ]}
            />
            {c.notes && <p className="mt-3 text-sm text-slate">{c.notes}</p>}
          </Card>
        </div>
      )}
      {tab === "settings" &&
        (!s ? (
          <Spinner />
        ) : (
          <form onSubmit={saveSettings}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Billing cycle">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Billing cycle">
                    <Select value={s.billing_cycle} disabled={!editable} onChange={(e: any) => set("billing_cycle", e.target.value)}>
                      {FREQUENCY.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Due days after issue">
                    <Input type="number" value={s.due_days} disabled={!editable} onChange={(e: any) => set("due_days", e.target.value)} />
                  </Field>
                  <Field label="Late penalty (%)">
                    <Input
                      type="number"
                      step="0.01"
                      value={s.late_penalty_percent}
                      disabled={!editable}
                      onChange={(e: any) => set("late_penalty_percent", e.target.value)}
                    />
                  </Field>
                  <Field label="Water loss target (%)">
                    <Input
                      type="number"
                      step="0.01"
                      value={s.water_loss_target_percent}
                      disabled={!editable}
                      onChange={(e: any) => set("water_loss_target_percent", e.target.value)}
                    />
                  </Field>
                </div>
              </Card>
              <Card title="Debt & disconnection ladder">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Reminder days overdue" hint="Comma separated, e.g. 7, 14, 21">
                    <Input value={s.reminder_days} disabled={!editable} onChange={(e: any) => set("reminder_days", e.target.value)} />
                  </Field>
                  <Field label="Disconnection warning after (days)">
                    <Input
                      type="number"
                      value={s.disconnection_after_days}
                      disabled={!editable}
                      onChange={(e: any) => set("disconnection_after_days", e.target.value)}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Checkbox
                      label="Disconnection always requires approval"
                      checked={s.disconnection_requires_approval}
                      disabled={!editable}
                      onChange={(e: any) => set("disconnection_requires_approval", e.target.checked)}
                    />
                  </div>
                </div>
              </Card>
              <Card title="Anomaly detection">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Spike threshold (% of average)">
                    <Input
                      type="number"
                      value={s.anomaly_spike_percent}
                      disabled={!editable}
                      onChange={(e: any) => set("anomaly_spike_percent", e.target.value)}
                    />
                  </Field>
                  <Field label="Low threshold (% of average)">
                    <Input
                      type="number"
                      value={s.anomaly_low_percent}
                      disabled={!editable}
                      onChange={(e: any) => set("anomaly_low_percent", e.target.value)}
                    />
                  </Field>
                  <Field label="Zero-consumption streak">
                    <Input
                      type="number"
                      value={s.zero_consumption_streak}
                      disabled={!editable}
                      onChange={(e: any) => set("zero_consumption_streak", e.target.value)}
                    />
                  </Field>
                </div>
              </Card>
              <Card title="Notification channels">
                <div className="flex flex-wrap gap-4">
                  <Checkbox
                    label="SMS"
                    checked={s.notify_sms}
                    disabled={!editable}
                    onChange={(e: any) => set("notify_sms", e.target.checked)}
                  />
                  <Checkbox
                    label="WhatsApp"
                    checked={s.notify_whatsapp}
                    disabled={!editable}
                    onChange={(e: any) => set("notify_whatsapp", e.target.checked)}
                  />
                  <Checkbox
                    label="Email"
                    checked={s.notify_email}
                    disabled={!editable}
                    onChange={(e: any) => set("notify_email", e.target.checked)}
                  />
                </div>
                <p className="mt-3 text-xs text-slate">
                  Portal notifications are always on. SMS/WhatsApp delivery depends on the gateway configured on the server (SMS_PROVIDER).
                </p>
              </Card>
            </div>
            {editable && (
              <div className="mt-4 flex justify-end">
                <Button type="submit" loading={saving}>
                  Save settings
                </Button>
              </div>
            )}
          </form>
        ))}
      {tab === "towns" && <TownsPanel />}
      {tab === "staff" && (
        <Card>
          <ul className="divide-y divide-line/60 text-sm">
            {staff.map((u) => (
              <li key={u.id} className="flex justify-between py-2">
                <span>
                  <b>{u.full_name}</b> <span className="text-xs text-slate">{u.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge value={u.is_active ? "ACTIVE" : "INACTIVE"} />
                  <span className="text-xs text-slate">{title(u.role)}</span>
                </span>
              </li>
            ))}
          </ul>
          {!staff.length && <div className="py-6 text-center text-sm text-slate">No staff accounts yet.</div>}
        </Card>
      )}
    </div>
  );
}
