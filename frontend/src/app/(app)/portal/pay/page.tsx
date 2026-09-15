"use client";
/** Customer portal — pay online (Paystack when configured; sandbox confirm otherwise) or see MoMo/USSD instructions. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Smartphone, CreditCard, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, PageHeader, Select, Spinner, useToast } from "@/components/ui";
import { ghs } from "@/lib/format";
export default function PortalPay() {
  const { push } = useToast();
  const router = useRouter();
  const [d, setD] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("MOBILE_MONEY");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<any>(null);
  useEffect(() => {
    api("/api/dashboard/customer/")
      .then((x) => {
        setD(x);
        setAmount(x.summary.outstanding > 0 ? String(x.summary.outstanding.toFixed(2)) : "");
        setPhone(x.customer.phone || "");
      })
      .catch((e) => push(e.message, "bad"));
  }, []); // eslint-disable-line
  if (!d) return <Spinner />;
  const start = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api("/api/payments/initiate/", { body: { amount, method, phone } });
      setPending(r);
      if (r.gateway.configured) push("Redirecting to the payment gateway…", "info");
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      await api(`/api/payments/${pending.payment.id}/confirm/`, { body: { provider_reference: `SANDBOX-${Date.now()}` } });
      push("Payment received — receipt issued");
      router.push("/portal/payments");
    } catch (ex: any) {
      push(ex.message, "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader title="Pay a bill" subtitle={`Outstanding balance: ${ghs(d.summary.outstanding)}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pay now">
          {pending ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-ok">
                <CheckCircle2 className="h-5 w-5" />
                Payment {pending.payment.reference} created for {ghs(pending.payment.amount)}.
              </div>
              {pending.gateway.configured ? (
                <p>
                  Complete the payment on the gateway page. Your receipt will appear under <b>My payments</b> as soon as the gateway
                  confirms it.
                </p>
              ) : (
                <>
                  <p className="rounded-md bg-warn/10 p-3 text-xs">
                    The online gateway isn't connected yet on this server (sandbox mode). Tap below to simulate a successful payment.
                  </p>
                  <Button onClick={confirm} loading={busy}>
                    Simulate successful payment
                  </Button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={start} className="space-y-3">
              <Field label="Amount (GHS)">
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={amount}
                  onChange={(e: any) => setAmount(e.target.value)}
                  className="!text-2xl font-extrabold"
                />
              </Field>
              <Field label="Pay with">
                <Select value={method} onChange={(e: any) => setMethod(e.target.value)}>
                  <option value="MOBILE_MONEY">Mobile Money (MTN / Telecel / AirtelTigo)</option>
                  <option value="ONLINE">Card / online</option>
                </Select>
              </Field>
              {method === "MOBILE_MONEY" && (
                <Field label="MoMo number">
                  <Input value={phone} onChange={(e: any) => setPhone(e.target.value)} />
                </Field>
              )}
              <Button type="submit" size="lg" className="w-full" loading={busy}>
                <CreditCard className="h-4 w-4" />
                Pay {amount ? ghs(amount) : ""}
              </Button>
            </form>
          )}
        </Card>
        <Card title="Other ways to pay">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <Smartphone className="h-5 w-5 shrink-0 text-river" />
              <div>
                <b>Mobile Money / USSD</b>
                <p className="text-slate">
                  Send to your community's registered MoMo merchant and use <b>{d.customer.customer_id}</b> as the reference. Your community
                  office will confirm and a receipt is sent by SMS.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <CreditCard className="h-5 w-5 shrink-0 text-river" />
              <div>
                <b>Cash / agent</b>
                <p className="text-slate">
                  Pay at the community water office or to an authorised collection agent. Always ask for your receipt number (RCT-WTR-…).
                </p>
              </div>
            </div>
            <p className="text-xs text-slate">
              Payments are applied to your oldest unpaid bill first. Overpayments stay on your account as credit.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
