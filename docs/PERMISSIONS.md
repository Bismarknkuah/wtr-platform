# Permission matrix

Generated from `backend/core/roles.py`. These are the role *defaults*; a community admin can further remove modules per role under System settings, and can define CUSTOM roles whose permissions are the modules ticked on the role (`core/modules.py`).

| Permission | Platform Super Admin | Platform Operations Admin | Community Admin | Community Finance Officer | Community Water Manager | Meter Reader | Technician | Customer | Auditor | Customer Support | Front Desk Collector | Custom |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ADJUST_BILL` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `APPROVE_COMMUNITIES` | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |
| `APPROVE_REQUESTS` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `CREATE_BILL` |  |  | ✓ | ✓ |  |  |  |  |  |  |  |  |
| `CREATE_CUSTOMER` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `CREATE_TICKET` |  |  | ✓ |  |  | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |
| `DELETE_CUSTOMER` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `EDIT_CUSTOMER` |  |  | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |
| `MANAGE_COMMUNITIES` | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |
| `MANAGE_COMMUNITY_SETTINGS` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `MANAGE_DEBT` |  |  | ✓ | ✓ |  |  |  |  |  |  |  |  |
| `MANAGE_DOCUMENTS` |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `MANAGE_EMERGENCIES` |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `MANAGE_INFRASTRUCTURE` |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `MANAGE_METERS` |  |  | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |
| `MANAGE_OUTAGES` |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `MANAGE_PLANS` | ✓ |  |  |  |  |  |  |  |  |  |  |  |
| `MANAGE_TARIFFS` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `MANAGE_TICKETS` |  |  | ✓ |  | ✓ |  | ✓ |  |  | ✓ |  |  |
| `MANAGE_USERS` | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |  |  |
| `MANAGE_WATER_QUALITY` |  |  | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |
| `RECORD_MAINTENANCE` |  |  | ✓ |  | ✓ |  | ✓ |  |  |  |  |  |
| `RECORD_PAYMENT` |  |  | ✓ | ✓ |  |  |  |  |  |  | ✓ |  |
| `RECORD_READING` |  |  | ✓ |  | ✓ | ✓ | ✓ |  |  |  |  |  |
| `REFUND_PAYMENT` |  |  | ✓ |  |  |  |  |  |  |  |  |  |
| `REQUEST_APPROVAL` |  |  | ✓ | ✓ | ✓ |  |  |  |  |  |  |  |
| `SEND_NOTIFICATIONS` |  |  | ✓ | ✓ | ✓ |  |  |  |  | ✓ |  |  |
| `VALIDATE_READING` |  |  | ✓ |  | ✓ |  |  |  |  |  |  |  |
| `VIEW_ALL_COMMUNITIES` | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |
| `VIEW_ANALYTICS` |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ |  |  |  |
| `VIEW_APPROVALS` |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ |  |  |  |
| `VIEW_AUDIT_LOG` |  |  | ✓ |  |  |  |  |  | ✓ |  |  |  |
| `VIEW_BILLS` |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ | ✓ | ✓ |  |
| `VIEW_COMMUNITY_DASHBOARD` |  |  | ✓ | ✓ | ✓ |  |  |  | ✓ | ✓ |  | ✓ |
| `VIEW_CUSTOMERS` |  |  | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `VIEW_DOCUMENTS` |  |  | ✓ | ✓ | ✓ |  | ✓ |  | ✓ | ✓ |  |  |
| `VIEW_FINANCIAL_REPORT` |  |  | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |
| `VIEW_INFRASTRUCTURE` |  |  | ✓ |  | ✓ |  | ✓ |  | ✓ |  |  |  |
| `VIEW_METERS` |  |  | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ | ✓ |  |
| `VIEW_NOTIFICATIONS` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `VIEW_OWN_ACCOUNT` |  |  |  |  |  |  |  | ✓ |  |  |  |  |
| `VIEW_PAYMENTS` |  |  | ✓ | ✓ |  |  |  |  | ✓ | ✓ | ✓ |  |
| `VIEW_PLATFORM_DASHBOARD` | ✓ | ✓ |  |  |  |  |  |  |  |  |  |  |
| `VIEW_READINGS` |  |  | ✓ | ✓ | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |  |
| `VIEW_TARIFFS` |  |  | ✓ | ✓ |  |  |  |  | ✓ |  |  |  |
| `VIEW_TICKETS` |  |  | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| `VIEW_USERS` | ✓ | ✓ | ✓ |  |  |  |  |  | ✓ |  |  |  |

## Roles

### Platform Super Admin (`PLATFORM_SUPER_ADMIN`)

`APPROVE_COMMUNITIES`, `MANAGE_COMMUNITIES`, `MANAGE_PLANS`, `MANAGE_USERS`, `VIEW_ALL_COMMUNITIES`, `VIEW_NOTIFICATIONS`, `VIEW_PLATFORM_DASHBOARD`, `VIEW_USERS`

### Platform Operations Admin (`PLATFORM_OPERATIONS_ADMIN`)

`APPROVE_COMMUNITIES`, `MANAGE_COMMUNITIES`, `MANAGE_USERS`, `VIEW_ALL_COMMUNITIES`, `VIEW_NOTIFICATIONS`, `VIEW_PLATFORM_DASHBOARD`, `VIEW_USERS`

### Community Admin (`COMMUNITY_ADMIN`)

`ADJUST_BILL`, `APPROVE_REQUESTS`, `CREATE_BILL`, `CREATE_CUSTOMER`, `CREATE_TICKET`, `DELETE_CUSTOMER`, `EDIT_CUSTOMER`, `MANAGE_COMMUNITY_SETTINGS`, `MANAGE_DEBT`, `MANAGE_DOCUMENTS`, `MANAGE_EMERGENCIES`, `MANAGE_INFRASTRUCTURE`, `MANAGE_METERS`, `MANAGE_OUTAGES`, `MANAGE_TARIFFS`, `MANAGE_TICKETS`, `MANAGE_USERS`, `MANAGE_WATER_QUALITY`, `RECORD_MAINTENANCE`, `RECORD_PAYMENT`, `RECORD_READING`, `REFUND_PAYMENT`, `REQUEST_APPROVAL`, `SEND_NOTIFICATIONS`, `VALIDATE_READING`, `VIEW_ANALYTICS`, `VIEW_APPROVALS`, `VIEW_AUDIT_LOG`, `VIEW_BILLS`, `VIEW_COMMUNITY_DASHBOARD`, `VIEW_CUSTOMERS`, `VIEW_DOCUMENTS`, `VIEW_FINANCIAL_REPORT`, `VIEW_INFRASTRUCTURE`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_PAYMENTS`, `VIEW_READINGS`, `VIEW_TARIFFS`, `VIEW_TICKETS`, `VIEW_USERS`

### Community Finance Officer (`COMMUNITY_FINANCE_OFFICER`)

`CREATE_BILL`, `EDIT_CUSTOMER`, `MANAGE_DEBT`, `RECORD_PAYMENT`, `REQUEST_APPROVAL`, `SEND_NOTIFICATIONS`, `VIEW_ANALYTICS`, `VIEW_APPROVALS`, `VIEW_BILLS`, `VIEW_COMMUNITY_DASHBOARD`, `VIEW_CUSTOMERS`, `VIEW_DOCUMENTS`, `VIEW_FINANCIAL_REPORT`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_PAYMENTS`, `VIEW_READINGS`, `VIEW_TARIFFS`, `VIEW_TICKETS`

### Community Water Manager (`COMMUNITY_WATER_MANAGER`)

`MANAGE_DOCUMENTS`, `MANAGE_EMERGENCIES`, `MANAGE_INFRASTRUCTURE`, `MANAGE_METERS`, `MANAGE_OUTAGES`, `MANAGE_TICKETS`, `MANAGE_WATER_QUALITY`, `RECORD_MAINTENANCE`, `RECORD_READING`, `REQUEST_APPROVAL`, `SEND_NOTIFICATIONS`, `VALIDATE_READING`, `VIEW_ANALYTICS`, `VIEW_APPROVALS`, `VIEW_BILLS`, `VIEW_COMMUNITY_DASHBOARD`, `VIEW_CUSTOMERS`, `VIEW_DOCUMENTS`, `VIEW_INFRASTRUCTURE`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_READINGS`, `VIEW_TICKETS`

### Meter Reader (`METER_READER`)

`CREATE_TICKET`, `RECORD_READING`, `VIEW_CUSTOMERS`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_READINGS`, `VIEW_TICKETS`

### Technician (`TECHNICIAN`)

`CREATE_TICKET`, `MANAGE_METERS`, `MANAGE_TICKETS`, `MANAGE_WATER_QUALITY`, `RECORD_MAINTENANCE`, `RECORD_READING`, `VIEW_CUSTOMERS`, `VIEW_DOCUMENTS`, `VIEW_INFRASTRUCTURE`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_READINGS`, `VIEW_TICKETS`

### Customer (`CUSTOMER`)

`CREATE_TICKET`, `VIEW_NOTIFICATIONS`, `VIEW_OWN_ACCOUNT`, `VIEW_TICKETS`

### Auditor (`AUDITOR`)

`VIEW_ANALYTICS`, `VIEW_APPROVALS`, `VIEW_AUDIT_LOG`, `VIEW_BILLS`, `VIEW_COMMUNITY_DASHBOARD`, `VIEW_CUSTOMERS`, `VIEW_DOCUMENTS`, `VIEW_FINANCIAL_REPORT`, `VIEW_INFRASTRUCTURE`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_PAYMENTS`, `VIEW_READINGS`, `VIEW_TARIFFS`, `VIEW_TICKETS`, `VIEW_USERS`

### Customer Support (`CUSTOMER_SUPPORT`)

`CREATE_TICKET`, `EDIT_CUSTOMER`, `MANAGE_TICKETS`, `SEND_NOTIFICATIONS`, `VIEW_BILLS`, `VIEW_COMMUNITY_DASHBOARD`, `VIEW_CUSTOMERS`, `VIEW_DOCUMENTS`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_PAYMENTS`, `VIEW_READINGS`, `VIEW_TICKETS`

### Front Desk Collector (`FRONT_DESK_COLLECTOR`)

`CREATE_TICKET`, `RECORD_PAYMENT`, `VIEW_BILLS`, `VIEW_CUSTOMERS`, `VIEW_METERS`, `VIEW_NOTIFICATIONS`, `VIEW_PAYMENTS`, `VIEW_TICKETS`

### Custom (`CUSTOM`)

`VIEW_COMMUNITY_DASHBOARD`, `VIEW_NOTIFICATIONS`
