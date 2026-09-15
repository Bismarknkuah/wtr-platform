"""
Feature modules a community admin can switch on or off per role.

Each module bundles the permissions that make a feature usable. A community's admin can
disable a module for a role (e.g. take "Debt management" away from Customer Support), and the
effective permission set for every user in that community is the role's default minus the
permissions of every module disabled for that role. The admin's own role can never be
restricted, so a community can always be administered.

The same list drives the "System settings → Features" screen in the frontend.
"""

MODULES = [
    {"key": "customers", "label": "Customers & properties", "group": "Customers & meters",
     "perms": ["VIEW_CUSTOMERS", "CREATE_CUSTOMER", "EDIT_CUSTOMER", "DELETE_CUSTOMER"]},
    {"key": "meters", "label": "Meters & replacement", "group": "Customers & meters", "perms": ["VIEW_METERS", "MANAGE_METERS"]},
    {"key": "readings", "label": "Meter readings & routes", "group": "Customers & meters", "perms": ["VIEW_READINGS", "RECORD_READING"]},
    {"key": "validation", "label": "Reading validation", "group": "Customers & meters", "perms": ["VALIDATE_READING"]},
    {"key": "tariffs", "label": "Tariffs & levies", "group": "Billing & revenue", "perms": ["VIEW_TARIFFS", "MANAGE_TARIFFS"]},
    {"key": "billing", "label": "Billing periods & bills", "group": "Billing & revenue", "perms": ["VIEW_BILLS", "CREATE_BILL", "ADJUST_BILL"]},
    {"key": "payments", "label": "Payments & receipts", "group": "Billing & revenue", "perms": ["VIEW_PAYMENTS", "RECORD_PAYMENT", "REFUND_PAYMENT"]},
    {"key": "debt", "label": "Debt management & dunning", "group": "Billing & revenue", "perms": ["MANAGE_DEBT"]},
    {"key": "reports", "label": "Financial reports", "group": "Billing & revenue", "perms": ["VIEW_FINANCIAL_REPORT"]},
    {"key": "infrastructure", "label": "Assets & network", "group": "Infrastructure", "perms": ["VIEW_INFRASTRUCTURE", "MANAGE_INFRASTRUCTURE"]},
    {"key": "maintenance", "label": "Maintenance", "group": "Infrastructure", "perms": ["RECORD_MAINTENANCE"]},
    {"key": "outages", "label": "Outages", "group": "Infrastructure", "perms": ["MANAGE_OUTAGES"]},
    {"key": "quality", "label": "Water quality", "group": "Infrastructure", "perms": ["MANAGE_WATER_QUALITY"]},
    {"key": "emergencies", "label": "Emergencies", "group": "Infrastructure", "perms": ["MANAGE_EMERGENCIES"]},
    {"key": "tickets", "label": "Service requests", "group": "Service & governance", "perms": ["VIEW_TICKETS", "MANAGE_TICKETS", "CREATE_TICKET"]},
    {"key": "approvals", "label": "Approvals", "group": "Service & governance", "perms": ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_REQUESTS"]},
    {"key": "notifications", "label": "Notifications & broadcasts", "group": "Service & governance", "perms": ["SEND_NOTIFICATIONS"]},
    {"key": "documents", "label": "Documents", "group": "Service & governance", "perms": ["VIEW_DOCUMENTS", "MANAGE_DOCUMENTS"]},
    {"key": "audit", "label": "Audit trail", "group": "Service & governance", "perms": ["VIEW_AUDIT_LOG"]},
    {"key": "analytics", "label": "Analytics & water intelligence", "group": "Service & governance", "perms": ["VIEW_ANALYTICS"]},
    {"key": "users", "label": "Staff & roles", "group": "Service & governance", "perms": ["VIEW_USERS", "MANAGE_USERS"]},
]
MODULE_INDEX = {m["key"]: m for m in MODULES}


def disabled_permissions(disabled_modules):
    """Union of permissions for a list of module keys."""
    out = set()
    for key in disabled_modules or []:
        out.update(MODULE_INDEX.get(key, {}).get("perms", []))
    return out
