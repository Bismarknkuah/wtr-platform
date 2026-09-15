import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CircleDollarSign,
  ClipboardList,
  Droplets,
  FileText,
  Gauge,
  Home,
  LifeBuoy,
  ListChecks,
  Map,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Users,
  Wallet,
  Wrench,
  Beaker,
  Sparkles,
  Route,
  AlertTriangle,
  CreditCard,
  UserCog,
  Layers,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: any; perm?: string | string[]; roles?: string[]; flag?: string };
export type NavGroup = { title: string; items: NavItem[] };

const CUSTOMER = ["CUSTOMER"];

export const NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Home },
      { label: "Communities", href: "/communities", icon: Building2, perm: "VIEW_ALL_COMMUNITIES" },
      { label: "Community health", href: "/benchmark", icon: BarChart3, perm: "VIEW_ALL_COMMUNITIES" },
      { label: "Subscription plans", href: "/plans", icon: Layers, perm: "MANAGE_PLANS" },
      { label: "My community", href: "/communities", icon: Building2, perm: "MANAGE_COMMUNITY_SETTINGS" },
    ],
  },
  {
    title: "Customers & meters",
    items: [
      { label: "Customers", href: "/customers", icon: Users, perm: "VIEW_CUSTOMERS" },
      { label: "Meters", href: "/meters", icon: Gauge, perm: "VIEW_METERS" },
      { label: "Meter readings", href: "/readings", icon: ClipboardList, perm: "VIEW_READINGS" },
      { label: "Reading routes", href: "/routes", icon: Route, perm: "VIEW_READINGS" },
    ],
  },
  {
    title: "Billing & revenue",
    items: [
      { label: "Tariffs", href: "/tariffs", icon: SlidersHorizontal, perm: "VIEW_TARIFFS" },
      { label: "Billing periods", href: "/billing", icon: ListChecks, perm: "VIEW_BILLS" },
      { label: "Bills", href: "/bills", icon: FileText, perm: "VIEW_BILLS" },
      { label: "Payments", href: "/payments", icon: Wallet, perm: "VIEW_PAYMENTS" },
      { label: "Debt management", href: "/debt", icon: AlertTriangle, perm: "MANAGE_DEBT" },
      { label: "Financial reports", href: "/reports", icon: CircleDollarSign, perm: "VIEW_FINANCIAL_REPORT" },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { label: "Assets & network", href: "/infrastructure", icon: Map, perm: "VIEW_INFRASTRUCTURE" },
      { label: "Maintenance", href: "/maintenance", icon: Wrench, perm: "VIEW_INFRASTRUCTURE" },
      { label: "Water production", href: "/production", icon: Droplets, perm: "VIEW_INFRASTRUCTURE" },
      { label: "Outages", href: "/outages", icon: Siren, perm: ["MANAGE_OUTAGES", "VIEW_INFRASTRUCTURE"] },
      { label: "Water quality", href: "/water-quality", icon: Beaker, perm: ["MANAGE_WATER_QUALITY", "VIEW_INFRASTRUCTURE"] },
      { label: "Emergencies", href: "/emergencies", icon: AlertTriangle, perm: ["MANAGE_EMERGENCIES", "VIEW_INFRASTRUCTURE"] },
    ],
  },
  {
    title: "Service & governance",
    items: [
      { label: "Service requests", href: "/tickets", icon: LifeBuoy, perm: "VIEW_TICKETS", roles: ["!CUSTOMER"] },
      {
        label: "Public reporting QR",
        href: "/public-reporting",
        icon: ScrollText,
        perm: ["MANAGE_TICKETS", "MANAGE_OUTAGES"],
        roles: ["!CUSTOMER"],
      },
      { label: "Approvals", href: "/approvals", icon: ShieldCheck, perm: "VIEW_APPROVALS" },
      { label: "Notifications", href: "/notifications", icon: Bell, perm: "VIEW_NOTIFICATIONS", roles: ["!CUSTOMER"] },
      { label: "Documents", href: "/documents", icon: BookOpen, perm: "VIEW_DOCUMENTS" },
      { label: "Audit trail", href: "/audit", icon: ScrollText, perm: "VIEW_AUDIT_LOG" },
      { label: "Water intelligence", href: "/intelligence", icon: Sparkles, perm: "VIEW_ANALYTICS" },
      { label: "Users & roles", href: "/users", icon: UserCog, perm: "VIEW_USERS" },
    ],
  },
  {
    title: "My account",
    items: [
      { label: "My bills", href: "/portal/bills", icon: Receipt, roles: CUSTOMER },
      { label: "Pay now", href: "/portal/pay", icon: CreditCard, roles: CUSTOMER, flag: "online_payments_enabled" },
      { label: "My payments", href: "/portal/payments", icon: Wallet, roles: CUSTOMER },
      { label: "My requests", href: "/portal/requests", icon: LifeBuoy, roles: CUSTOMER, flag: "customer_requests_enabled" },
      { label: "Notifications", href: "/portal/notifications", icon: Bell, roles: CUSTOMER },
      { label: "System settings", href: "/system-settings", icon: SlidersHorizontal, perm: "MANAGE_COMMUNITY_SETTINGS" },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function visibleNav(user: { role: string; permissions: string[]; community_flags?: Record<string, boolean> } | null): NavGroup[] {
  if (!user) return [];
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (i.flag && user.community_flags && user.community_flags[i.flag] === false) return false;
      if (i.roles) {
        const neg = i.roles.filter((r) => r.startsWith("!")).map((r) => r.slice(1));
        const pos = i.roles.filter((r) => !r.startsWith("!"));
        if (neg.includes(user.role)) return false;
        if (pos.length && !pos.includes(user.role)) return false;
      }
      if (!i.perm) return true;
      const list = Array.isArray(i.perm) ? i.perm : [i.perm];
      return list.some((p) => user.permissions.includes(p));
    }),
  }))
    .filter((g) => g.items.length)
    .map((g) => {
      // de-duplicate "communities" link for platform vs community admin
      const seen = new Set<string>();
      return { ...g, items: g.items.filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true))) };
    });
}

export const DASHBOARD_BY_ROLE: Record<string, string> = {
  PLATFORM_SUPER_ADMIN: "/dashboard/platform",
  PLATFORM_OPERATIONS_ADMIN: "/dashboard/platform-ops",
  AUDITOR: "/dashboard/auditor",
  FRONT_DESK_COLLECTOR: "/dashboard/front-desk",
  CUSTOM: "/dashboard/community",
  COMMUNITY_ADMIN: "/dashboard/community",
  COMMUNITY_FINANCE_OFFICER: "/dashboard/finance",
  COMMUNITY_WATER_MANAGER: "/dashboard/water-manager",
  METER_READER: "/dashboard/meter-reader",
  TECHNICIAN: "/dashboard/technician",
  CUSTOMER_SUPPORT: "/dashboard/support",
  CUSTOMER: "/dashboard/customer",
};
