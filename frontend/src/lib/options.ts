import { title } from "./format";
export const opts = (list: string[]) => list.map((v) => ({ value: v, label: title(v) }));
export const CATEGORIES = opts([
  "RESIDENTIAL",
  "COMMERCIAL",
  "INSTITUTIONAL",
  "INDUSTRIAL",
  "SCHOOL",
  "CHURCH",
  "MOSQUE",
  "PUBLIC",
  "GOVERNMENT",
]);
export const CUSTOMER_STATUS = opts(["PENDING", "ACTIVE", "SUSPENDED", "DISCONNECTED", "INACTIVE"]);
export const METER_STATUS = opts(["AVAILABLE", "INSTALLED", "ACTIVE", "FAULTY", "BLOCKED", "REMOVED", "REPLACED", "RETIRED"]);
export const METER_CONDITION = opts(["GOOD", "FAIR", "POOR", "DAMAGED"]);
export const READING_STATUS = opts(["PENDING", "VALIDATED", "REJECTED", "BILLED"]);
export const READING_SOURCE = opts(["MANUAL", "MOBILE", "OCR", "IOT", "ESTIMATED"]);
export const BILL_STATUS = opts(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "CARRIED_FORWARD", "CANCELLED"]);
export const PERIOD_STATUS = opts(["OPEN", "GENERATED", "CLOSED"]);
export const FREQUENCY = opts(["MONTHLY", "BIMONTHLY", "QUARTERLY", "CUSTOM"]);
export const PAY_METHOD = opts(["MOBILE_MONEY", "BANK", "ONLINE", "CASH", "MANUAL", "AGENT", "USSD"]);
export const PAY_STATUS = opts(["PENDING", "SUCCESSFUL", "FAILED", "REVERSED", "REFUNDED"]);
export const ASSET_TYPE = opts([
  "BOREHOLE",
  "WELL",
  "TREATMENT_PLANT",
  "RESERVOIR",
  "TANK",
  "PIPELINE",
  "PUMP",
  "GENERATOR",
  "SOLAR",
  "CONTROL_PANEL",
  "VALVE",
  "FILTER",
  "CHLORINATION",
  "OTHER",
]);
export const ASSET_STATUS = opts(["OPERATIONAL", "DEGRADED", "UNDER_MAINTENANCE", "FAILED", "DECOMMISSIONED"]);
export const MAINT_TYPE = opts(["PREVENTIVE", "CORRECTIVE", "INSPECTION"]);
export const OUTAGE_STATUS = opts(["ACTIVE", "RESTORED", "CANCELLED"]);
export const COMPLIANCE = opts(["COMPLIANT", "ALERT", "NON_COMPLIANT"]);
export const EMERGENCY_TYPE = opts([
  "PIPELINE_BURST",
  "PUMP_FAILURE",
  "CONTAMINATION",
  "SHORTAGE",
  "FLOODING",
  "INFRASTRUCTURE_DAMAGE",
  "OTHER",
]);
export const SEVERITY = opts(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const EMERGENCY_STATUS = opts(["OPEN", "RESPONDING", "RESOLVED"]);
export const TICKET_CATEGORY = opts([
  "NO_WATER",
  "METER_FAULT",
  "LEAK",
  "LOW_PRESSURE",
  "WATER_QUALITY",
  "ILLEGAL_CONNECTION",
  "BILL_DISPUTE",
  "NEW_CONNECTION",
  "DISCONNECTION",
  "METER_REPLACEMENT",
  "CONTACT_UPDATE",
  "OTHER",
]);
export const PRIORITY = opts(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const TICKET_STATUS = opts(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]);
export const APPROVAL_TYPE = opts([
  "BILL_ADJUSTMENT",
  "REFUND",
  "TARIFF_CHANGE",
  "METER_REPLACEMENT",
  "CUSTOMER_DEACTIVATION",
  "DEBT_WRITE_OFF",
  "DISCONNECTION",
  "RECONNECTION",
  "PAYMENT_CORRECTION",
]);
export const APPROVAL_STATUS = opts(["PENDING", "APPROVED", "REJECTED", "EXECUTED", "FAILED"]);
export const DOC_CATEGORY = opts([
  "CUSTOMER_AGREEMENT",
  "CONNECTION_FORM",
  "METER_INSTALLATION",
  "MAINTENANCE_REPORT",
  "WATER_QUALITY_REPORT",
  "RECEIPT",
  "OFFICIAL_NOTICE",
  "POLICY",
  "OTHER",
]);
export const TARIFF_MODE = opts(["FLAT", "TIERED", "SLAB"]);
export const CHARGE_TYPE = opts(["SERVICE", "MAINTENANCE_LEVY", "INFRASTRUCTURE_LEVY", "OTHER"]);
export const SYSTEM_TYPE = opts(["PIPED", "BOREHOLE", "SMALL_TOWN", "HANDPUMP", "MIXED"]);
export const COMMUNITY_STATUS = opts(["PENDING", "ACTIVE", "SUSPENDED", "INACTIVE"]);
export const ROLES = opts([
  "PLATFORM_SUPER_ADMIN",
  "PLATFORM_OPERATIONS_ADMIN",
  "COMMUNITY_ADMIN",
  "COMMUNITY_FINANCE_OFFICER",
  "COMMUNITY_WATER_MANAGER",
  "METER_READER",
  "TECHNICIAN",
  "CUSTOMER_SUPPORT",
  "FRONT_DESK_COLLECTOR",
  "AUDITOR",
]);
/** Roles a community admin can create for their own community (everything except platform roles). */
export const COMMUNITY_ROLES = ROLES.filter((r) => !String(r.value).startsWith("PLATFORM"));
/** Roles platform staff can create: platform accounts, plus the first admin of a community (who then hires the rest). */
export const PLATFORM_CREATABLE_ROLES = ROLES.filter((r) => String(r.value).startsWith("PLATFORM") || r.value === "COMMUNITY_ADMIN");
export const REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Western North",
  "Central",
  "Eastern",
  "Volta",
  "Oti",
  "Northern",
  "North East",
  "Savannah",
  "Upper East",
  "Upper West",
  "Bono",
  "Bono East",
  "Ahafo",
].map((r) => ({ value: r, label: r }));
