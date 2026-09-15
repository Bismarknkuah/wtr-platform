# Role dashboards — what each screen shows and why

All nine dashboards compose the same widget library (`frontend/src/components/dashboard/widgets.tsx`)
but each answers a different set of questions. The numbers come from one place — the aggregation
helpers in `apps/analytics/services.py` and `apps/analytics/role_dashboards.py` — so a figure on the
finance screen always matches the same figure on the community admin screen.

## Platform Super Admin (`/dashboard/platform`)
*Registry, approvals, subscription plans, community admins.* Pending registrations with one-click approve, live communities without an admin, plans table with recurring revenue, recent changes, platform staff, platform-level activity.

## Platform Operations Admin (`/dashboard/platform-ops`)
*Register & approve communities, create first admins.* Pending registrations with approval checklist, next steps, registry by region and water-system type, recently approved.

## (former shared platform view)
*Question: how many communities are live, and which ones are unhealthy?*
Platform staff never see a community's data — only health indicators (counts, percentages, scores).
- KPIs: communities (live / pending / suspended), households served, average collection efficiency, average water loss, average sustainability score, communities at risk.
- Grade mix bar (Excellent / Good / Fair / At risk), by region, by water-system type, communities approved per month.
- Attention grid: registrations awaiting approval, communities at risk, communities with outages, suspended communities; lowest scores.
- Benchmark table sortable by households, metered %, collection %, water loss, outages, open requests, score.
- Highest water loss ranking, platform-level activity feed (registrations, approvals, plans, accounts), quick actions.

## Community Admin
*Question: is my community healthy this month and what needs a decision?*
- The "engine strip": active meters → readings to validate → consumption → billed → collected → outstanding, each linking to its module.
- KPIs with deltas, needs-attention grid (readings, approvals, overdue, tickets, maintenance, outages, quality, high-risk customers).
- Billed-vs-collected, consumption trend, payments by channel, sustainability score with component bars.
- Customers by category with debt, quick actions, activity feed of what staff have done.

## Finance Officer
*Question: how much did we bill, how much came in, what is owed and how old is it?*
- KPIs: billed, collected (with deltas), collection efficiency, today's takings, outstanding, overdue.
- Month-progress strip with adjustments, refunds, reversals, write-offs and customer credit.
- Daily collections sparkline, debt aging (not due / 1–30 / 31–60 / 61–90 / 90+), dunning ladder, bill status mix.
- Payment channels donut, largest debtors, billed by customer type, collected by staff member.
- Tabs: recent payments, approvals waiting (approve / reject inline — approval executes the change), billing periods.
- Analytics: collection efficiency by month, average bill and days-to-pay, collections by weekday, revenue by customer type (6 months), collections by channel (6 months), links to reports and water intelligence.

## Water Manager
*Question: where is the water going, and are the meters and network in good shape?*
- KPIs: produced, billed, non-revenue water vs target, reading coverage, flagged readings, faulty meters.
- 30-day production vs billed consumption chart; NRW by month against the community target.
- Flagged readings table with the reason for each flag and inline validate / reject.
- Route progress, meters by status, maintenance due list, assets by status.
- Water-quality tests with compliance history and the exact parameters that breached.
- Outage timeline, largest consumers, sustainability score, quick actions.
- Analytics: consumption by customer category with per-connection averages and litres-per-person-per-day, reading coverage trend, 6-month consumption, flagged/rejected readings trend, links to reports and water intelligence.

## Meter Reader
*Question: which households are left on my route, and did my readings go through?*
- Hero banner with route progress; KPIs for queued, captured, validated, pending and rejected readings.
- **Key in a meter number** box: type the number printed on any meter in the community (on or off the route) and the capture sheet opens for it.
- Route list with each household's previous reading, date, usual consumption and status, searchable, with a "still to read" filter.
- Capture sheet: large numeric input, live consumption preview with plain-language warnings (reverse, spike, unusually low, zero), GPS capture, an **optional** photo of the dial (taken with the phone camera, compressed on-device, uploaded with the reading), notes.
- Offline queue in `localStorage`; auto-sync when back online; results (synced / flagged / failed) shown per household.
- Recent readings tab with a 14-day activity sparkline.

## Technician
*Question: what needs my hands today?*
- KPIs: my open jobs, unassigned field jobs, maintenance overdue, resolved in 30 days, jobs and cost this month, outages.
- Emergency / outage banners when something is live.
- Tabs: assigned to me (start / resolve inline), unassigned field jobs (take a job), recent maintenance work.
- Maintenance calendar (overdue first), faulty & blocked meters, outage history, quick actions.

## Customer Support
*Question: who is calling, and what is happening with their request?*
- Live customer lookup (name, ID, phone, meter, address) showing status and balance.
- KPIs: open, unassigned, SLA breached (urgent > 4 h, high > 24 h, other > 72 h), resolved, CSAT, messages sent / failed.
- Active outage banner (customers will call about it) with a link to broadcast an update.
- Tabs: queue, SLA breached, recently resolved with ratings.
- Attention grid, 14-day new-request sparkline, requests by category / priority, staff workload, message delivery by channel, newest customers.

## Front Desk Collector (`/dashboard/front-desk`)
*Question: what does the person at my window owe, and how do I take the money?*
- Big lookup box: meter number, customer ID or phone (several matches → pick one).
- Account card: household, contact, town, meter and current reading, amount owed (or credit), overdue portion, disconnection warning, every unpaid bill with days late, last payments.
- Take-payment form: amount defaults to the full balance with one-tap shortcuts (full / overdue only / latest bill), channel (cash, MoMo to office number, bank slip, other), reference, payer name. Records the payment, shows the receipt, prints a 80 mm receipt, SMS goes out automatically.
- My day: taken today, cash in drawer, MoMo today, this week, whole-office today, customers owing; my receipts by channel; 14-day sparkline; my last receipts with "open account".

## Community Auditor (read-only)
*Question: is anything unusual happening in my community, and is every sensitive action justified?*
- KPIs: events, sign-ins, deletions, after-hours activity, approvals pending, self-reviewed approvals (should be zero).
- Financial corrections summary (adjustments, refunds, reversals, write-offs) and 30-day event volume.
- Watch-list: failed approvals, self-approvals, deletions, reversals.
- Activity by action, most active people, most touched records, approvals by type.
- Sensitive financial actions table (every adjustment / refund / reversal / write-off with who and why) and a live feed.

## Customer / Household
*Question: what do I owe, and how do I pay?*
- Hero banner: amount due (red if overdue) with a pay button, latest bill status, meter card.
- KPIs: last consumption vs personal average (leak hint if far above), last payment, next billing date, open requests.
- Usage chart, quick actions, account summary, recent bills, my requests, notices from the community.
