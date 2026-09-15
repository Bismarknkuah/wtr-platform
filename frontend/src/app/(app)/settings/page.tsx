"use client";
/** My account — profile & password (all roles). */
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, Field, Input, KV, PageHeader, useToast } from "@/components/ui";
import { title } from "@/lib/format";
export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [p, setP] = useState({ full_name: user?.full_name || "", phone: (user as any)?.phone || "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const saveProfile = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/me/", { method: "PATCH", body: p });
      await refresh();
      push("Profile updated");
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const savePw = async (e: any) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) return push("Passwords do not match", "bad");
    setBusy(true);
    try {
      await api("/api/auth/change-password/", { body: { current_password: pw.current_password, new_password: pw.new_password } });
      push("Password changed");
      setPw({ current_password: "", new_password: "", confirm: "" });
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader title="My account" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Profile">
          <form onSubmit={saveProfile} className="space-y-3">
            <KV
              items={[
                ["Email", user.email],
                ["Role", user.role_label || title(user.role)],
                ["Community", user.community_name || "Platform"],
              ]}
            />
            <Field label="Full name">
              <Input value={p.full_name} onChange={(e: any) => setP({ ...p, full_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={p.phone} onChange={(e: any) => setP({ ...p, phone: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                Save
              </Button>
            </div>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={savePw} className="space-y-3">
            <Field label="Current password">
              <Input
                type="password"
                required
                value={pw.current_password}
                onChange={(e: any) => setPw({ ...pw, current_password: e.target.value })}
              />
            </Field>
            <Field label="New password">
              <Input
                type="password"
                required
                minLength={8}
                value={pw.new_password}
                onChange={(e: any) => setPw({ ...pw, new_password: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" required value={pw.confirm} onChange={(e: any) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                Change password
              </Button>
            </div>
          </form>
        </Card>
        <Card title="Permissions" className="lg:col-span-2">
          <div className="flex flex-wrap gap-1">
            {user.permissions.map((x) => (
              <span key={x} className="rounded bg-wash px-2 py-0.5 text-[11px] font-semibold text-slate">
                {title(x)}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
