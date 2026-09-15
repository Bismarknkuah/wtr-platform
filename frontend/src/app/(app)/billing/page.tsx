"use client";
/** Billing periods — create, generate bills for every active customer with a validated reading, close. */
import ResourcePage from "@/components/ResourcePage";
import { useAuth } from "@/lib/auth";
import { Badge, Button } from "@/components/ui";
import { FREQUENCY, PERIOD_STATUS } from "@/lib/options";
import { date, datetime, ghs, num } from "@/lib/format";
export default function BillingPeriodsPage() {
  const { can } = useAuth();
  const gen = async (h: any, r: any) => {
    if (!window.confirm(`Generate bills for "${r.name}"? Customers already billed for this period are skipped.`)) return;
    try {
      const d = await h.api(`/api/billing-periods/${r.id}/generate/`, { body: {} });
      const s = d.summary;
      h.toast(
        `Created ${s.created} bills · ${s.already_billed} already billed · ${s.no_reading} without a validated reading · ${s.errors?.length || 0} errors`,
        s.errors?.length ? "bad" : "ok",
      );
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  const close = async (h: any, r: any) => {
    if (!window.confirm("Close this period? No more bills can be generated for it.")) return;
    try {
      await h.api(`/api/billing-periods/${r.id}/close/`, { body: {} });
      h.toast("Period closed");
      h.reload();
    } catch (e: any) {
      h.toast(e.message, "bad");
    }
  };
  return (
    <ResourcePage
      endpoint="/api/billing-periods/"
      title="Billing periods"
      subtitle="Monthly, bimonthly, quarterly or custom. Generating a period bills every active customer whose latest validated reading falls inside it."
      createPerm="CREATE_BILL"
      editPerm="CREATE_BILL"
      createLabel="New period"
      ordering="-start_date"
      filters={[
        { name: "status", label: "Status", options: PERIOD_STATUS },
        { name: "frequency", label: "Frequency", options: FREQUENCY },
      ]}
      columns={[
        { key: "name", label: "Period", render: (r) => <b>{r.name}</b> },
        { key: "frequency", label: "Frequency", render: (r) => <Badge value={r.frequency} /> },
        { key: "start_date", label: "Covers", render: (r) => `${date(r.start_date)} – ${date(r.end_date)}` },
        { key: "due_date", label: "Due", render: (r) => date(r.due_date) },
        { key: "bills_count", label: "Bills", render: (r) => num(r.bills_count) },
        { key: "total_billed", label: "Total billed", render: (r) => ghs(r.total_billed) },
        { key: "generated_at", label: "Generated", render: (r) => datetime(r.generated_at) },
        { key: "status", label: "Status", render: (r) => <Badge value={r.status} /> },
      ]}
      rowActions={(r, h) =>
        can("CREATE_BILL") ? (
          <>
            {r.status !== "CLOSED" && (
              <Button size="sm" onClick={() => gen(h, r)}>
                {r.status === "GENERATED" ? "Re-run" : "Generate bills"}
              </Button>
            )}
            {r.status === "GENERATED" && (
              <Button size="sm" variant="ghost" onClick={() => close(h, r)}>
                Close
              </Button>
            )}
          </>
        ) : null
      }
      fields={[
        { name: "name", label: "Name", required: true, hint: "e.g. September 2026" },
        { name: "frequency", label: "Frequency", type: "select", options: FREQUENCY, defaultValue: "MONTHLY" },
        { name: "start_date", label: "Start date", type: "date", required: true },
        { name: "end_date", label: "End date", type: "date", required: true },
        { name: "due_date", label: "Payment due date", type: "date", required: true },
      ]}
    />
  );
}
