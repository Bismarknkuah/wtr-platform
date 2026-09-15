"""
Role definitions and the granular permission matrix.
Roles are the only thing stored on the user; permissions are derived here so
the matrix is a single source of truth shared with the frontend (see /api/auth/me/).
"""

class Role:
    PLATFORM_SUPER_ADMIN = "PLATFORM_SUPER_ADMIN"
    PLATFORM_OPERATIONS_ADMIN = "PLATFORM_OPERATIONS_ADMIN"
    COMMUNITY_ADMIN = "COMMUNITY_ADMIN"
    COMMUNITY_FINANCE_OFFICER = "COMMUNITY_FINANCE_OFFICER"
    COMMUNITY_WATER_MANAGER = "COMMUNITY_WATER_MANAGER"
    METER_READER = "METER_READER"
    TECHNICIAN = "TECHNICIAN"
    CUSTOMER = "CUSTOMER"
    AUDITOR = "AUDITOR"
    CUSTOMER_SUPPORT = "CUSTOMER_SUPPORT"
    FRONT_DESK_COLLECTOR = "FRONT_DESK_COLLECTOR"
    CUSTOM = "CUSTOM"                      # a role the community admin defined (see communities.CommunityRole)

    CHOICES = [
        (PLATFORM_SUPER_ADMIN, "Platform Super Admin"),
        (PLATFORM_OPERATIONS_ADMIN, "Platform Operations Admin"),
        (COMMUNITY_ADMIN, "Community Admin"),
        (COMMUNITY_FINANCE_OFFICER, "Community Finance Officer"),
        (COMMUNITY_WATER_MANAGER, "Community Water Manager"),
        (METER_READER, "Meter Reader"),
        (TECHNICIAN, "Technician"),
        (CUSTOMER, "Customer / Household"),
        (AUDITOR, "Community Auditor"),
        (CUSTOMER_SUPPORT, "Customer Support"),
        (FRONT_DESK_COLLECTOR, "Front Desk Collector"),
        (CUSTOM, "Custom role"),
    ]
    PLATFORM_ROLES = {PLATFORM_SUPER_ADMIN, PLATFORM_OPERATIONS_ADMIN}
    COMMUNITY_STAFF_ROLES = {COMMUNITY_ADMIN, COMMUNITY_FINANCE_OFFICER, COMMUNITY_WATER_MANAGER,
                             METER_READER, TECHNICIAN, CUSTOMER_SUPPORT, AUDITOR, FRONT_DESK_COLLECTOR, CUSTOM}


P = [
    "VIEW_PLATFORM_DASHBOARD", "MANAGE_COMMUNITIES", "APPROVE_COMMUNITIES", "MANAGE_PLANS", "VIEW_ALL_COMMUNITIES",
    "VIEW_COMMUNITY_DASHBOARD", "MANAGE_COMMUNITY_SETTINGS",
    "VIEW_USERS", "MANAGE_USERS",
    "VIEW_CUSTOMERS", "CREATE_CUSTOMER", "EDIT_CUSTOMER", "DELETE_CUSTOMER",
    "VIEW_METERS", "MANAGE_METERS",
    "VIEW_READINGS", "RECORD_READING", "VALIDATE_READING",
    "VIEW_TARIFFS", "MANAGE_TARIFFS",
    "VIEW_BILLS", "CREATE_BILL", "ADJUST_BILL",
    "VIEW_PAYMENTS", "RECORD_PAYMENT", "REFUND_PAYMENT",
    "VIEW_FINANCIAL_REPORT", "MANAGE_DEBT",
    "VIEW_INFRASTRUCTURE", "MANAGE_INFRASTRUCTURE", "RECORD_MAINTENANCE",
    "MANAGE_OUTAGES", "MANAGE_WATER_QUALITY", "MANAGE_EMERGENCIES",
    "VIEW_TICKETS", "MANAGE_TICKETS", "CREATE_TICKET",
    "VIEW_AUDIT_LOG", "VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_REQUESTS",
    "VIEW_DOCUMENTS", "MANAGE_DOCUMENTS", "VIEW_NOTIFICATIONS", "SEND_NOTIFICATIONS",
    "VIEW_ANALYTICS", "VIEW_OWN_ACCOUNT",
]
ALL = set(P)

# ------------------------------------------------------------------------------------------
# Isolation model
#
# Platform staff run the *platform*: they register and approve communities, manage subscription
# plans, create the first Community Admin account, and see aggregate health indicators
# (counts, percentages, scores). They never see a community's customers, meters, readings,
# bills, payments, tickets, infrastructure or audit trail — each community's officers manage
# all of that themselves, including their own tariffs. The Auditor is therefore a *community*
# role (read-only within one community).
# ------------------------------------------------------------------------------------------
PLATFORM_ONLY = {"VIEW_PLATFORM_DASHBOARD", "MANAGE_COMMUNITIES", "APPROVE_COMMUNITIES", "MANAGE_PLANS", "VIEW_ALL_COMMUNITIES"}
COMMUNITY_DATA = ALL - PLATFORM_ONLY - {"VIEW_USERS", "MANAGE_USERS", "VIEW_OWN_ACCOUNT", "VIEW_NOTIFICATIONS"}

ROLE_PERMISSIONS = {
    Role.PLATFORM_SUPER_ADMIN: PLATFORM_ONLY | {"VIEW_USERS", "MANAGE_USERS", "VIEW_NOTIFICATIONS"},
    Role.PLATFORM_OPERATIONS_ADMIN: {"VIEW_PLATFORM_DASHBOARD", "VIEW_ALL_COMMUNITIES", "MANAGE_COMMUNITIES", "APPROVE_COMMUNITIES",
                                     "VIEW_USERS", "MANAGE_USERS", "VIEW_NOTIFICATIONS"},
    # VIEW_OWN_ACCOUNT is the household-portal permission and belongs to CUSTOMER only.
    Role.COMMUNITY_ADMIN: ALL - PLATFORM_ONLY - {"VIEW_OWN_ACCOUNT"},
    Role.COMMUNITY_FINANCE_OFFICER: {
        "VIEW_COMMUNITY_DASHBOARD", "VIEW_CUSTOMERS", "EDIT_CUSTOMER", "VIEW_METERS", "VIEW_READINGS", "VIEW_TARIFFS",
        "VIEW_BILLS", "CREATE_BILL", "VIEW_PAYMENTS", "RECORD_PAYMENT", "VIEW_FINANCIAL_REPORT", "MANAGE_DEBT",
        "VIEW_TICKETS", "VIEW_APPROVALS", "REQUEST_APPROVAL", "VIEW_DOCUMENTS", "VIEW_NOTIFICATIONS", "SEND_NOTIFICATIONS", "VIEW_ANALYTICS",
    },
    Role.COMMUNITY_WATER_MANAGER: {
        "VIEW_COMMUNITY_DASHBOARD", "VIEW_CUSTOMERS", "VIEW_METERS", "MANAGE_METERS", "VIEW_READINGS", "RECORD_READING",
        "VALIDATE_READING", "VIEW_INFRASTRUCTURE", "MANAGE_INFRASTRUCTURE", "RECORD_MAINTENANCE", "MANAGE_OUTAGES",
        "MANAGE_WATER_QUALITY", "MANAGE_EMERGENCIES", "VIEW_TICKETS", "MANAGE_TICKETS", "VIEW_APPROVALS", "REQUEST_APPROVAL",
        "VIEW_DOCUMENTS", "MANAGE_DOCUMENTS", "VIEW_NOTIFICATIONS", "SEND_NOTIFICATIONS", "VIEW_ANALYTICS", "VIEW_BILLS",
    },
    Role.METER_READER: {"VIEW_CUSTOMERS", "VIEW_METERS", "VIEW_READINGS", "RECORD_READING", "CREATE_TICKET", "VIEW_TICKETS", "VIEW_NOTIFICATIONS"},
    Role.TECHNICIAN: {"VIEW_CUSTOMERS", "VIEW_METERS", "MANAGE_METERS", "VIEW_READINGS", "RECORD_READING", "VIEW_INFRASTRUCTURE",
                      "RECORD_MAINTENANCE", "VIEW_TICKETS", "MANAGE_TICKETS", "CREATE_TICKET", "MANAGE_WATER_QUALITY", "VIEW_NOTIFICATIONS", "VIEW_DOCUMENTS"},
    Role.CUSTOMER: {"VIEW_OWN_ACCOUNT", "CREATE_TICKET", "VIEW_TICKETS", "VIEW_NOTIFICATIONS"},
    # Read-only, inside ONE community.
    Role.AUDITOR: {"VIEW_COMMUNITY_DASHBOARD", "VIEW_CUSTOMERS", "VIEW_METERS", "VIEW_READINGS", "VIEW_TARIFFS", "VIEW_BILLS", "VIEW_PAYMENTS",
                   "VIEW_FINANCIAL_REPORT", "VIEW_INFRASTRUCTURE", "VIEW_TICKETS", "VIEW_AUDIT_LOG", "VIEW_APPROVALS", "VIEW_DOCUMENTS",
                   "VIEW_ANALYTICS", "VIEW_USERS", "VIEW_NOTIFICATIONS"},
    # Takes cash / MoMo at the office window. Looks up an account by meter number, sees what is owed, records the payment, prints the receipt.
    Role.FRONT_DESK_COLLECTOR: {"VIEW_CUSTOMERS", "VIEW_METERS", "VIEW_BILLS", "VIEW_PAYMENTS", "RECORD_PAYMENT", "VIEW_NOTIFICATIONS", "CREATE_TICKET", "VIEW_TICKETS"},
    # Baseline for a community-defined role; the rest comes from the modules ticked on the role.
    Role.CUSTOM: {"VIEW_COMMUNITY_DASHBOARD", "VIEW_NOTIFICATIONS"},
    Role.CUSTOMER_SUPPORT: {"VIEW_COMMUNITY_DASHBOARD", "VIEW_CUSTOMERS", "EDIT_CUSTOMER", "VIEW_METERS", "VIEW_READINGS", "VIEW_BILLS",
                            "VIEW_PAYMENTS", "VIEW_TICKETS", "MANAGE_TICKETS", "CREATE_TICKET", "VIEW_NOTIFICATIONS", "SEND_NOTIFICATIONS", "VIEW_DOCUMENTS"},
}


def permissions_for(role: str) -> set:
    """Default permissions for a role (the matrix). See `effective_permissions` for the per-community version."""
    return set(ROLE_PERMISSIONS.get(role, set()))


def effective_permissions(user) -> set:
    """
    What this user can actually do: the role's default permissions minus any module the
    community admin has switched off for that role (CommunitySettings.module_access).
    Platform staff and community admins are never restricted.
    """
    perms = permissions_for(user.role)
    if user.role in Role.PLATFORM_ROLES or user.role == Role.COMMUNITY_ADMIN or not user.community_id:
        return perms
    cached = getattr(user, "_effective_perms", None)
    if cached is not None:
        return cached
    from core.modules import disabled_permissions as module_permissions
    access_key = user.role
    if user.role == Role.CUSTOM:
        cr = getattr(user, "custom_role", None)
        if cr is None or not cr.is_active or cr.community_id != user.community_id:
            perms = set()                                   # role deleted or deactivated → nothing until reassigned
        else:
            perms = perms | module_permissions(cr.modules)  # the modules ticked on the custom role
            access_key = f"custom:{cr.id}"
    try:
        access = user.community.settings.module_access or {}
    except Exception:
        access = {}
    perms = perms - module_permissions(access.get(access_key, []))
    user._effective_perms = perms
    return perms
