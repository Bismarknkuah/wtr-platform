/** Demo accounts created by `python manage.py seed_demo` (+ the platform super admin from seed_platform). Shown as quick-access buttons on the login page. */
export type DemoAccount = {
  label: string;
  role: string;
  email: string;
  password: string;
  blurb: string;
  group: "Platform" | "Community staff" | "Household";
};
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    group: "Platform",
    label: "Platform Super Admin",
    role: "PLATFORM_SUPER_ADMIN",
    email: "admin@wtr.gh",
    password: "ChangeMe123!",
    blurb: "Registry, approvals, plans, community admins",
  },
  {
    group: "Platform",
    label: "Platform Operations Admin",
    role: "PLATFORM_OPERATIONS_ADMIN",
    email: "ops.platform@wtr.gh",
    password: "Demo1234!",
    blurb: "Register & approve communities, first admins",
  },
  {
    group: "Community staff",
    label: "Community Admin",
    role: "COMMUNITY_ADMIN",
    email: "admin.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Runs Abokobi end to end",
  },
  {
    group: "Community staff",
    label: "Finance Officer",
    role: "COMMUNITY_FINANCE_OFFICER",
    email: "finance.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Bills, payments, debt",
  },
  {
    group: "Community staff",
    label: "Water Manager",
    role: "COMMUNITY_WATER_MANAGER",
    email: "water.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Meters, readings, supply, quality",
  },
  {
    group: "Community staff",
    label: "Meter Reader",
    role: "METER_READER",
    email: "reader.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Route + offline reading capture",
  },
  {
    group: "Community staff",
    label: "Technician",
    role: "TECHNICIAN",
    email: "tech.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Tickets, maintenance, outages",
  },
  {
    group: "Community staff",
    label: "Customer Support",
    role: "CUSTOMER_SUPPORT",
    email: "support.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Lookup, requests, broadcasts",
  },
  {
    group: "Community staff",
    label: "Community Auditor",
    role: "AUDITOR",
    email: "auditor.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Read-only audit trail & approvals",
  },
  {
    group: "Community staff",
    label: "Front Desk Collector",
    role: "FRONT_DESK_COLLECTOR",
    email: "desk.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "Enter a meter number, see what's owed, take payment",
  },
  {
    group: "Community staff",
    label: "Zone supervisor (custom role)",
    role: "CUSTOM",
    email: "zone.abokobi@wtr.gh",
    password: "Demo1234!",
    blurb: "A role the community admin defined",
  },
  {
    group: "Household",
    label: "Customer portal",
    role: "CUSTOMER",
    email: "mensah@demo.gh",
    password: "Demo1234!",
    blurb: "Mensah Family — bills, pay, requests",
  },
];
