"use client";
/** Customer account 360: profile, meter, bills, payments, ledger statement, readings, portal access, actions. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  KV,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { ConsumptionLine } from "@/components/charts";
import { PAY_METHOD } from "@/lib/options";
import { date, datetime, ghs, m3, title } from "@/lib/format";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [stmt, setStmt] = useState<any[]>([]);
  const [tab, setTab] = useState("bills");
  const [pay, setPay] = useState(false);
  const [payForm, setPayForm] = useState<any>({ method: "MOBILE_MONEY" });
  const [portal, setPortal] = useState(false);
  const [portalForm, setPortalForm] = useState<any>({});
  const [req, setReq] = useState<string | null>(null);
  const [reqForm, setReqForm] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api(`/api/customers/${id}/summary/`)
      .then(setD)
      .catch((e) => push(e.message, "bad"));
    api(`/api/customers/${id}/statement/`)
      .then((s) => setStmt(s.entries))
      .catch(() => {});
  }, [id]); // eslint-disable-line
  useEffect(() => {
    load();
  }, [load]);
  if (!d) return <Spinner />;
  const c = d.customer;
  const submit = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      push(ok);
      setPay(false);
      setPortal(false);
      setReq(null);
      load();
    } catch (e: any) {
      push(e.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const openReq = (type: string) => {
    setReq(type);
    setReqForm({ reason: "", amount: "" });
  };
  return (
    <div>
      <PageHeader
        title={c.household_name}
        subtitle={
          <span>
            {c.customer_id} · {title(c.category)} · {c.contact_person} · {c.phone} · <Badge value={c.account_status} /> · risk{" "}
            <Badge value={c.risk_level} /> ({c.risk_score})
          </span>
        }
        actions={
          <>
            {can("RECORD_PAYMENT") && (
              <Button
                onClick={() => {
                  setPayForm({ method: "MOBILE_MONEY", amount: Number(c.outstanding_balance) > 0 ? c.outstanding_balance : "" });
                  setPay(true);
                }}
              >
                Record payment
              </Button>
            )}
            {can("EDIT_CUSTOMER") && !c.portal_email && (
              <Button
                variant="secondary"
                onClick={() => {
                  setPortalForm({ email: c.email || "", password: "" });
                  setPortal(true);
                }}
              >
                Create portal login
              </Button>
            )}
            {can("REQUEST_APPROVAL") && (
              <Select className="!w-auto" value="" onChange={(e: any) => e.target.value && openReq(e.target.value)}>
                <option value="">Request approval…</option>
                <option value="DEBT_WRITE_OFF">Debt write-off</option>
                <option value="DISCONNECTION">Disconnection</option>
                <option value="RECONNECTION">Reconnection</option>
                <option value="CUSTOMER_DEACTIVATION">Deactivate account</option>
                <option value="TARIFF_CHANGE">Change tariff</option>
              </Select>
            )}
          </>
        }
      />
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card title="Account">
          <div className={`mb-3 rounded-md p-3 ${Number(c.outstanding_balance) > 0 ? "bg-bad/10" : "bg-ok/10"}`}>
            <div className="text-xs font-semibold text-slate">Outstanding balance</div>
            <div className={`text-2xl font-extrabold tabular-nums ${Number(c.outstanding_balance) > 0 ? "text-bad" : "text-ok"}`}>
              {ghs(c.outstanding_balance)}
            </div>
          </div>
          <KV
            items={[
              ["Tariff", c.tariff_plan_name || "Default for category"],
              ["Property", c.property_label || "—"],
              ["Address", c.address || "—"],
              ["Occupants", c.occupants],
              ["Connected", date(c.connection_date)],
              ["Email", c.email || "—"],
              ["Portal login", c.portal_email || "not created"],
            ]}
          />
        </Card>
        <Card title="Meter">
          {c.meter ? (
            <KV
              items={[
                [
                  "Meter ID",
                  <Link href={`/meters?search=${c.meter.meter_id}`} className="text-river">
                    {c.meter.meter_id}
                  </Link>,
                ],
                ["Serial", c.meter.serial_number],
                ["Status", <Badge value={c.meter.status} />],
                ["Current reading", `${c.meter.current_reading} m³`],
                ["Installed", date(c.meter.installation_date)],
              ]}
            />
          ) : (
            <div className="py-6 text-center text-sm text-slate">
              No meter installed.{" "}
              <Link href="/meters" className="text-river">
                Install one →
              </Link>
            </div>
          )}
        </Card>
        <Card title="Consumption (last readings)">
          {d.readings.length ? (
            <ConsumptionLine
              data={[...d.readings].reverse().map((r: any) => ({ month: date(r.reading_date), consumption: Number(r.consumption) }))}
            />
          ) : (
            <div className="py-6 text-center text-sm text-slate">No readings yet.</div>
          )}
        </Card>
      </div>
      <Tabs
        tabs={[
          { key: "bills", label: "Bills" },
          { key: "payments", label: "Payments" },
          { key: "statement", label: "Statement (ledger)" },
          { key: "readings", label: "Readings" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Card>
        {tab === "bills" && (
          <Table
            rows={d.recent_bills}
            columns={[
              {
                key: "invoice_number",
                label: "Invoice",
                render: (r) => (
                  <Link href={`/bills/${r.id}`} className="font-semibold text-river">
                    {r.invoice_number}
                  </Link>
                ),
              },
              { key: "period_name", label: "Period" },
              { key: "consumption", label: "Usage", render: (r) => m3(r.consumption) },
              { key: "total_amount", label: "Total", render: (r) => ghs(r.total_amount) },
              { key: "outstanding_amount", label: "Owing", render: (r) => ghs(r.outstanding_amount) },
              { key: "due_date", label: "Due", render: (r) => date(r.due_date) },
              { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
            ]}
          />
        )}
        {tab === "payments" && (
          <Table
            rows={d.recent_payments}
            columns={[
              { key: "reference", label: "Reference", render: (r) => <b>{r.reference}</b> },
              { key: "paid_at", label: "Paid", render: (r) => datetime(r.paid_at) },
              { key: "amount", label: "Amount", render: (r) => ghs(r.amount) },
              { key: "method", label: "Method", render: (r) => title(r.method) },
              { key: "receipt_number", label: "Receipt" },
              { key: "status", label: "", render: (r) => <Badge value={r.status} /> },
            ]}
          />
        )}
        {tab === "statement" && (
          <Table
            rows={stmt}
            columns={[
              { key: "created_at", label: "Date", render: (r) => datetime(r.created_at) },
              { key: "entry_type", label: "Type", render: (r) => <Badge value={r.entry_type} /> },
              {
                key: "description",
                label: "Description",
                render: (r) => (
                  <span>
                    {r.description}
                    <span className="ml-1 text-xs text-slate">{r.reference}</span>
                  </span>
                ),
              },
              { key: "debit", label: "Debit", className: "text-right", render: (r) => (Number(r.debit) ? ghs(r.debit) : "") },
              { key: "credit", label: "Credit", className: "text-right", render: (r) => (Number(r.credit) ? ghs(r.credit) : "") },
              { key: "balance_after", label: "Balance", className: "text-right font-bold", render: (r) => ghs(r.balance_after) },
            ]}
          />
        )}
        {tab === "readings" && (
          <Table
            rows={d.readings}
            columns={[
              { key: "reading_date", label: "Date", render: (r) => date(r.reading_date) },
              { key: "meter_code", label: "Meter" },
              { key: "previous_reading", label: "Previous" },
              { key: "reading_value", label: "Current" },
              { key: "consumption", label: "m³", render: (r) => m3(r.consumption) },
              { key: "source", label: "Source", render: (r) => title(r.source) },
              { key: "read_by_name", label: "By" },
              {
                key: "status",
                label: "",
                render: (r) => (
                  <span>
                    <Badge value={r.status} />
                    {r.is_anomalous && <Badge value="FLAGGED" className="ml-1 !bg-warn/10 !text-warn" />}
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>
      <Modal open={pay} onClose={() => setPay(false)} title={`Record payment · ${c.household_name}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => api("/api/payments/", { body: { ...payForm, customer: c.id } }), "Payment recorded and receipt issued");
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount (GHS) *">
              <Input
                type="number"
                step="0.01"
                required
                value={payForm.amount || ""}
                onChange={(e: any) => setPayForm({ ...payForm, amount: e.target.value })}
              />
            </Field>
            <Field label="Method">
              <Select value={payForm.method} onChange={(e: any) => setPayForm({ ...payForm, method: e.target.value })}>
                {PAY_METHOD.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Provider">
              <Input
                placeholder="MTN MoMo, GCB, Paystack…"
                value={payForm.provider || ""}
                onChange={(e: any) => setPayForm({ ...payForm, provider: e.target.value })}
              />
            </Field>
            <Field label="Provider reference / transaction ID">
              <Input
                value={payForm.provider_reference || ""}
                onChange={(e: any) => setPayForm({ ...payForm, provider_reference: e.target.value })}
              />
            </Field>
            <Field label="Payer phone">
              <Input value={payForm.payer_phone || ""} onChange={(e: any) => setPayForm({ ...payForm, payer_phone: e.target.value })} />
            </Field>
            <Field label="Paid at">
              <Input
                type="datetime-local"
                value={payForm.paid_at || ""}
                onChange={(e: any) => setPayForm({ ...payForm, paid_at: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Input value={payForm.notes || ""} onChange={(e: any) => setPayForm({ ...payForm, notes: e.target.value })} />
          </Field>
          <p className="text-xs text-slate">
            The amount is applied to the oldest unpaid bills first. A receipt is generated and sent via the community's enabled channels.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPay(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Record payment
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={portal} onClose={() => setPortal(false)} title="Create customer portal login">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => api(`/api/customers/${c.id}/create_portal_login/`, { body: portalForm }), "Portal login created");
          }}
        >
          <Field label="Login email *">
            <Input
              type="email"
              required
              value={portalForm.email}
              onChange={(e: any) => setPortalForm({ ...portalForm, email: e.target.value })}
            />
          </Field>
          <Field label="Temporary password *">
            <Input required value={portalForm.password} onChange={(e: any) => setPortalForm({ ...portalForm, password: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPortal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create login
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={!!req} onClose={() => setReq(null)} title={`Request ${title(req || "")}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const payload: any = { customer: c.id };
            if (req === "DEBT_WRITE_OFF") payload.amount = reqForm.amount;
            if (req === "TARIFF_CHANGE") payload.tariff_plan = reqForm.tariff_plan;
            submit(
              () =>
                api("/api/approvals/", {
                  body: {
                    request_type: req,
                    payload,
                    reason: reqForm.reason,
                    target_label: `${c.household_name} (${c.customer_id})`,
                    target_model: "Customer",
                    target_id: c.id,
                  },
                }),
              "Approval request submitted",
            );
          }}
        >
          {req === "DEBT_WRITE_OFF" && (
            <Field label="Amount to write off (GHS) *">
              <Input
                type="number"
                step="0.01"
                required
                value={reqForm.amount}
                onChange={(e: any) => setReqForm({ ...reqForm, amount: e.target.value })}
              />
            </Field>
          )}
          {req === "TARIFF_CHANGE" && (
            <Field label="New tariff plan ID *" hint="Find the ID on the Tariffs page">
              <Input
                type="number"
                required
                value={reqForm.tariff_plan || ""}
                onChange={(e: any) => setReqForm({ ...reqForm, tariff_plan: e.target.value })}
              />
            </Field>
          )}
          <Field label="Reason *">
            <Textarea required value={reqForm.reason} onChange={(e: any) => setReqForm({ ...reqForm, reason: e.target.value })} />
          </Field>
          <p className="text-xs text-slate">
            Nothing changes until someone with approval rights approves this request; approval executes it automatically and is logged.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReq(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Submit request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
