# Data model reference

Generated from the Django models. `TenantModel` rows always carry a `community` foreign key and are filtered by it on every request (see `core/tenancy.py`).

## Accounts (`apps.accounts`)

### `User`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `password` | CharField |  |
| `last_login` | DateTimeField | nullable |
| `is_superuser` | BooleanField | Designates that this user has all permissions without explicitly assigning them. |
| `first_name` | CharField |  |
| `last_name` | CharField |  |
| `is_staff` | BooleanField | Designates whether the user can log into this admin site. |
| `date_joined` | DateTimeField |  |
| `email` | CharField | unique |
| `full_name` | CharField |  |
| `phone` | CharField |  |
| `role` | CharField | choices: PLATFORM_SUPER_ADMIN, PLATFORM_FINANCE_ADMIN, PLATFORM_OPERATIONS_ADMIN, COMMUNITY_ADMIN, COMMUNITY_FINANCE_OFFICER, COMMUNITY_WATER_MANAGER, METER_READER, TECHNICIAN, CUSTOMER, AUDITOR, CUSTOMER_SUPPORT |
| `community` | ForeignKey | → `Community`; nullable |
| `is_active` | BooleanField |  |
| `last_login_ip` | GenericIPAddressField | nullable |

## Communities (`apps.communities`)

### `SubscriptionPlan`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `name` | CharField | unique |
| `description` | TextField |  |
| `monthly_price` | DecimalField |  |
| `max_customers` | PositiveIntegerField |  |
| `max_staff` | PositiveIntegerField |  |
| `features` | JSONField |  |
| `is_active` | BooleanField |  |

### `Community`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `code` | CharField | unique |
| `name` | CharField |  |
| `region` | CharField |  |
| `district` | CharField |  |
| `municipality` | CharField |  |
| `town` | CharField |  |
| `latitude` | DecimalField | nullable |
| `longitude` | DecimalField | nullable |
| `boundary` | JSONField | nullable; GeoJSON polygon of the community boundary |
| `contact_name` | CharField |  |
| `contact_phone` | CharField |  |
| `contact_email` | CharField |  |
| `admin` | ForeignKey | → `User`; nullable |
| `water_source` | CharField |  |
| `water_system_type` | CharField | choices: PIPED, BOREHOLE, SMALL_TOWN, HANDPUMP, MIXED |
| `households_count` | PositiveIntegerField |  |
| `meters_count` | PositiveIntegerField |  |
| `service_status` | CharField | choices: PENDING, ACTIVE, SUSPENDED, INACTIVE |
| `approved_at` | DateTimeField | nullable |
| `approved_by` | ForeignKey | → `User`; nullable |
| `registration_date` | DateField |  |
| `subscription_plan` | ForeignKey | → `SubscriptionPlan`; nullable |
| `notes` | TextField |  |

### `CommunitySettings`

Per-community business policy. Created automatically with the community.

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | OneToOneField | → `Community`; unique |
| `currency` | CharField |  |
| `billing_cycle` | CharField | choices: MONTHLY, BIMONTHLY, QUARTERLY, CUSTOM |
| `due_days` | PositiveIntegerField | Days after bill issue before it is due |
| `late_penalty_percent` | DecimalField |  |
| `reminder_days` | JSONField | Days overdue at which reminders are sent, e.g. [7, 14, 21] |
| `disconnection_after_days` | PositiveIntegerField |  |
| `disconnection_requires_approval` | BooleanField |  |
| `anomaly_spike_percent` | PositiveIntegerField | Flag when consumption exceeds this % of the running average |
| `anomaly_low_percent` | PositiveIntegerField |  |
| `zero_consumption_streak` | PositiveIntegerField |  |
| `notify_sms` | BooleanField |  |
| `notify_whatsapp` | BooleanField |  |
| `notify_email` | BooleanField |  |
| `water_loss_target_percent` | DecimalField |  |

## Customers (`apps.customers`)

### `Property`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `property_id` | CharField | unique |
| `address` | CharField |  |
| `landmark` | CharField |  |
| `latitude` | DecimalField | nullable |
| `longitude` | DecimalField | nullable |
| `property_type` | CharField | choices: RESIDENTIAL, COMMERCIAL, INSTITUTIONAL, INDUSTRIAL, SCHOOL, CHURCH, MOSQUE, PUBLIC_FACILITY, GOVERNMENT |
| `notes` | TextField |  |

### `Customer`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `customer_id` | CharField | unique |
| `household_name` | CharField |  |
| `contact_person` | CharField |  |
| `phone` | CharField |  |
| `alternative_phone` | CharField |  |
| `email` | CharField |  |
| `address` | CharField |  |
| `latitude` | DecimalField | nullable |
| `longitude` | DecimalField | nullable |
| `property` | ForeignKey | → `Property`; nullable |
| `category` | CharField | choices: RESIDENTIAL, COMMERCIAL, INSTITUTIONAL, INDUSTRIAL, SCHOOL, CHURCH, MOSQUE, PUBLIC_FACILITY, GOVERNMENT |
| `tariff_plan` | ForeignKey | → `TariffPlan`; nullable |
| `occupants` | PositiveIntegerField |  |
| `connection_date` | DateField | nullable |
| `account_status` | CharField | choices: PENDING, ACTIVE, SUSPENDED, DISCONNECTED, INACTIVE |
| `outstanding_balance` | DecimalField |  |
| `risk_score` | PositiveSmallIntegerField |  |
| `risk_level` | CharField |  |
| `user` | OneToOneField | → `User`; unique; nullable |
| `notes` | TextField |  |

## Meters (`apps.meters`)

### `Meter`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `meter_id` | CharField | unique |
| `serial_number` | CharField | unique |
| `meter_type` | CharField |  |
| `meter_size` | CharField | e.g. 15mm, 1/2" |
| `manufacturer` | CharField |  |
| `installation_date` | DateField | nullable |
| `installation_location` | CharField |  |
| `initial_reading` | DecimalField |  |
| `current_reading` | DecimalField |  |
| `status` | CharField | choices: AVAILABLE, INSTALLED, ACTIVE, FAULTY, BLOCKED, REMOVED, REPLACED, RETIRED |
| `condition` | CharField | choices: GOOD, FAIR, POOR, DAMAGED |
| `customer` | ForeignKey | → `Customer`; nullable |
| `property` | ForeignKey | → `Property`; nullable |
| `last_inspection` | DateField | nullable |
| `last_maintenance` | DateField | nullable |
| `replaced_by` | OneToOneField | → `Meter`; unique; nullable |
| `is_smart` | BooleanField |  |
| `iot_device_id` | CharField |  |
| `notes` | TextField |  |

### `MeterReplacement`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `old_meter` | ForeignKey | → `Meter` |
| `new_meter` | ForeignKey | → `Meter` |
| `customer` | ForeignKey | → `Customer`; nullable |
| `final_reading` | DecimalField |  |
| `initial_reading` | DecimalField |  |
| `reason` | TextField |  |
| `performed_by` | ForeignKey | → `User`; nullable |
| `performed_on` | DateField |  |

### `ReadingRoute`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `name` | CharField |  |
| `reader` | ForeignKey | → `User`; nullable |
| `schedule_note` | CharField |  |
| `is_active` | BooleanField |  |

### `MeterReading`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `meter` | ForeignKey | → `Meter` |
| `customer` | ForeignKey | → `Customer`; nullable |
| `reading_value` | DecimalField |  |
| `previous_reading` | DecimalField |  |
| `consumption` | DecimalField |  |
| `reading_date` | DateField |  |
| `read_by` | ForeignKey | → `User`; nullable |
| `latitude` | DecimalField | nullable |
| `longitude` | DecimalField | nullable |
| `gps_distance_m` | PositiveIntegerField | nullable; Distance between reader GPS and customer GPS |
| `photo` | FileField | nullable |
| `photo_url` | CharField |  |
| `device_id` | CharField |  |
| `client_reading_id` | CharField | unique; nullable; Client-generated UUID for offline sync idempotency |
| `source` | CharField | choices: MANUAL, MOBILE, OCR, IOT, ESTIMATED |
| `status` | CharField | choices: PENDING, VALIDATED, REJECTED, BILLED |
| `is_anomalous` | BooleanField |  |
| `anomaly_flags` | JSONField |  |
| `anomaly_note` | CharField |  |
| `ocr_detected_value` | DecimalField | nullable |
| `validated_by` | ForeignKey | → `User`; nullable |
| `validated_at` | DateTimeField | nullable |
| `notes` | TextField |  |

## Tariffs (`apps.tariffs`)

### `TariffPlan`

A pricing plan. community=NULL means a platform-wide default plan available to every community.

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community`; nullable |
| `name` | CharField |  |
| `category` | CharField | choices: RESIDENTIAL, COMMERCIAL, INSTITUTIONAL, INDUSTRIAL, SCHOOL, CHURCH, MOSQUE, PUBLIC_FACILITY, GOVERNMENT |
| `billing_mode` | CharField | choices: FLAT, TIERED, SLAB |
| `flat_rate` | DecimalField | Used when billing_mode = FLAT |
| `minimum_charge` | DecimalField |  |
| `is_active` | BooleanField |  |
| `effective_from` | DateField | nullable |
| `description` | TextField |  |

### `TariffTier`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `plan` | ForeignKey | → `TariffPlan` |
| `order` | PositiveSmallIntegerField |  |
| `from_m3` | DecimalField |  |
| `to_m3` | DecimalField | nullable; Blank = no upper limit |
| `rate_per_m3` | DecimalField | TIERED: price per m³ in this block |
| `slab_amount` | DecimalField | SLAB: fixed price if consumption falls in this band |

### `ServiceCharge`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `name` | CharField |  |
| `charge_type` | CharField | choices: SERVICE, MAINTENANCE_LEVY, INFRASTRUCTURE_LEVY, OTHER |
| `amount` | DecimalField |  |
| `applies_to` | JSONField | Customer categories; empty = all |
| `is_active` | BooleanField |  |

## Billing (`apps.billing`)

### `BillingPeriod`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `name` | CharField |  |
| `frequency` | CharField | choices: MONTHLY, BIMONTHLY, QUARTERLY, CUSTOM |
| `start_date` | DateField |  |
| `end_date` | DateField |  |
| `due_date` | DateField |  |
| `status` | CharField | choices: OPEN, GENERATED, CLOSED |
| `generated_at` | DateTimeField | nullable |
| `generated_by` | ForeignKey | → `User`; nullable |
| `bills_count` | PositiveIntegerField |  |
| `total_billed` | DecimalField |  |

### `Bill`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `invoice_number` | CharField | unique |
| `customer` | ForeignKey | → `Customer` |
| `meter` | ForeignKey | → `Meter`; nullable |
| `period` | ForeignKey | → `BillingPeriod`; nullable |
| `reading` | OneToOneField | → `MeterReading`; unique; nullable |
| `tariff_plan` | ForeignKey | → `TariffPlan`; nullable |
| `tariff_name` | CharField |  |
| `previous_reading` | DecimalField |  |
| `current_reading` | DecimalField |  |
| `consumption` | DecimalField |  |
| `water_charge` | DecimalField |  |
| `service_charge` | DecimalField |  |
| `maintenance_levy` | DecimalField |  |
| `infrastructure_levy` | DecimalField |  |
| `other_charges` | DecimalField |  |
| `penalty` | DecimalField |  |
| `discount` | DecimalField |  |
| `adjustment` | DecimalField |  |
| `previous_balance` | DecimalField |  |
| `current_charges` | DecimalField |  |
| `total_amount` | DecimalField |  |
| `amount_paid` | DecimalField |  |
| `outstanding_amount` | DecimalField |  |
| `issued_at` | DateTimeField | nullable |
| `due_date` | DateField |  |
| `status` | CharField | choices: DRAFT, ISSUED, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED |
| `lines` | JSONField |  |
| `notes` | TextField |  |

### `BillAdjustment`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `bill` | ForeignKey | → `Bill` |
| `amount` | DecimalField | Negative reduces the bill, positive increases it |
| `reason` | TextField |  |
| `approved_by` | ForeignKey | → `User`; nullable |
| `approval` | ForeignKey | → `ApprovalRequest`; nullable |

### `DunningAction`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `customer` | ForeignKey | → `Customer` |
| `stage` | CharField | choices: REMINDER, SECOND_REMINDER, FINAL_NOTICE, DISCONNECTION_WARNING, DISCONNECTION |
| `outstanding` | DecimalField |  |
| `days_overdue` | PositiveIntegerField |  |
| `approval` | ForeignKey | → `ApprovalRequest`; nullable |

## Payments (`apps.payments`)

### `Payment`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `reference` | CharField | unique |
| `customer` | ForeignKey | → `Customer` |
| `bill` | ForeignKey | → `Bill`; nullable |
| `amount` | DecimalField |  |
| `method` | CharField | choices: MOBILE_MONEY, BANK, ONLINE, CASH, MANUAL, AGENT, USSD |
| `status` | CharField | choices: PENDING, SUCCESSFUL, FAILED, REVERSED, REFUNDED |
| `provider` | CharField | MTN MoMo, Vodafone Cash, Paystack, GCB ... |
| `provider_reference` | CharField |  |
| `payer_phone` | CharField |  |
| `payer_name` | CharField |  |
| `paid_at` | DateTimeField |  |
| `recorded_by` | ForeignKey | → `User`; nullable |
| `allocations` | JSONField | [{invoice, amount}] how the payment was applied |
| `notes` | TextField |  |

### `Receipt`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `receipt_number` | CharField | unique |
| `payment` | OneToOneField | → `Payment`; unique |
| `customer` | ForeignKey | → `Customer` |
| `issued_at` | DateTimeField |  |
| `delivered_via` | JSONField |  |
| `snapshot` | JSONField | Immutable copy of the receipt content at issue time |

### `LedgerEntry`

Append-only customer ledger. Debits increase what the customer owes; credits reduce it.

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `customer` | ForeignKey | → `Customer` |
| `entry_type` | CharField | choices: BILL, PAYMENT, ADJUSTMENT, REFUND, REVERSAL, WRITE_OFF, OPENING |
| `debit` | DecimalField |  |
| `credit` | DecimalField |  |
| `balance_after` | DecimalField |  |
| `reference` | CharField |  |
| `description` | CharField |  |
| `bill` | ForeignKey | → `Bill`; nullable |
| `payment` | ForeignKey | → `Payment`; nullable |

### `Refund`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `payment` | ForeignKey | → `Payment` |
| `customer` | ForeignKey | → `Customer` |
| `amount` | DecimalField |  |
| `reason` | TextField |  |
| `approved_by` | ForeignKey | → `User`; nullable |
| `approval` | ForeignKey | → `ApprovalRequest`; nullable |

## Infrastructure (`apps.infrastructure`)

### `Asset`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `asset_id` | CharField | unique |
| `name` | CharField |  |
| `asset_type` | CharField | choices: BOREHOLE, WELL, TREATMENT_PLANT, RESERVOIR, TANK, PIPELINE, PUMP, GENERATOR, SOLAR, CONTROL_PANEL, VALVE, FILTER, CHLORINATION, OTHER |
| `status` | CharField | choices: OPERATIONAL, DEGRADED, UNDER_MAINTENANCE, FAILED, DECOMMISSIONED |
| `parent` | ForeignKey | → `Asset`; nullable; Upstream asset in the network (source → treatment → reservoir → pipeline) |
| `latitude` | DecimalField | nullable |
| `longitude` | DecimalField | nullable |
| `capacity` | CharField | e.g. 50 m³, 5 kW, 3 L/s |
| `manufacturer` | CharField |  |
| `serial_number` | CharField |  |
| `installed_on` | DateField | nullable |
| `warranty_expiry` | DateField | nullable |
| `maintenance_interval_days` | PositiveIntegerField |  |
| `last_maintenance` | DateField | nullable |
| `next_maintenance` | DateField | nullable |
| `notes` | TextField |  |

### `MaintenanceRecord`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `asset` | ForeignKey | → `Asset` |
| `maintenance_type` | CharField | choices: PREVENTIVE, CORRECTIVE, INSPECTION |
| `performed_on` | DateField |  |
| `technician` | ForeignKey | → `User`; nullable |
| `technician_name` | CharField |  |
| `description` | TextField |  |
| `cost` | DecimalField |  |
| `parts_used` | TextField |  |
| `downtime_hours` | DecimalField |  |
| `was_failure` | BooleanField |  |
| `failure_cause` | CharField |  |

### `Outage`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `cause` | CharField |  |
| `affected_area` | CharField |  |
| `asset` | ForeignKey | → `Asset`; nullable |
| `started_at` | DateTimeField |  |
| `expected_restoration` | DateTimeField | nullable |
| `restored_at` | DateTimeField | nullable |
| `status` | CharField | choices: ACTIVE, RESTORED, CANCELLED |
| `declared_by` | ForeignKey | → `User`; nullable |
| `notify_customers` | BooleanField |  |
| `customers_notified` | PositiveIntegerField |  |
| `notes` | TextField |  |

### `WaterQualityTest`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `asset` | ForeignKey | → `Asset`; nullable |
| `testing_location` | CharField |  |
| `tested_on` | DateField |  |
| `laboratory` | CharField |  |
| `ph` | DecimalField | nullable |
| `turbidity_ntu` | DecimalField | nullable |
| `chlorine_mg_l` | DecimalField | nullable |
| `tds_mg_l` | DecimalField | nullable |
| `temperature_c` | DecimalField | nullable |
| `ecoli_cfu` | IntegerField | nullable; E. coli CFU/100 ml (0 = absent) |
| `coliform_cfu` | IntegerField | nullable |
| `result_summary` | TextField |  |
| `compliance_status` | CharField | choices: COMPLIANT, ALERT, NON_COMPLIANT |
| `tested_by` | ForeignKey | → `User`; nullable |

### `Emergency`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `emergency_type` | CharField | choices: PIPELINE_BURST, PUMP_FAILURE, CONTAMINATION, SHORTAGE, FLOODING, INFRASTRUCTURE_DAMAGE, OTHER |
| `severity` | CharField | choices: LOW, MEDIUM, HIGH, CRITICAL |
| `title` | CharField |  |
| `description` | TextField |  |
| `status` | CharField | choices: OPEN, RESPONDING, RESOLVED |
| `declared_by` | ForeignKey | → `User`; nullable |
| `declared_at` | DateTimeField |  |
| `resolved_at` | DateTimeField | nullable |
| `response_notes` | TextField |  |

## Tickets (`apps.tickets`)

### `ServiceRequest`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `ticket_number` | CharField | unique |
| `customer` | ForeignKey | → `Customer`; nullable |
| `category` | CharField | choices: NO_WATER, METER_FAULT, LEAK, BILL_DISPUTE, NEW_CONNECTION, DISCONNECTION, METER_REPLACEMENT, CONTACT_UPDATE, OTHER |
| `priority` | CharField | choices: LOW, MEDIUM, HIGH, URGENT |
| `status` | CharField | choices: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED |
| `title` | CharField |  |
| `description` | TextField |  |
| `location` | CharField |  |
| `latitude` | DecimalField | nullable |
| `longitude` | DecimalField | nullable |
| `meter` | ForeignKey | → `Meter`; nullable |
| `bill` | ForeignKey | → `Bill`; nullable |
| `raised_by` | ForeignKey | → `User`; nullable |
| `assigned_to` | ForeignKey | → `User`; nullable |
| `resolution` | TextField |  |
| `resolved_at` | DateTimeField | nullable |
| `closed_at` | DateTimeField | nullable |
| `satisfaction_rating` | PositiveSmallIntegerField | nullable |
| `satisfaction_comment` | TextField |  |

### `TicketComment`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `ticket` | ForeignKey | → `ServiceRequest` |
| `author` | ForeignKey | → `User`; nullable |
| `body` | TextField |  |
| `is_internal` | BooleanField | Internal notes are hidden from the customer |

## Notifications (`apps.notifications`)

### `Notification`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `event` | CharField |  |
| `channel` | CharField | choices: SMS, WHATSAPP, EMAIL, PORTAL |
| `customer` | ForeignKey | → `Customer`; nullable |
| `user` | ForeignKey | → `User`; nullable |
| `recipient` | CharField |  |
| `title` | CharField |  |
| `message` | TextField |  |
| `status` | CharField | choices: QUEUED, SENT, FAILED |
| `sent_at` | DateTimeField | nullable |
| `error` | CharField |  |
| `is_read` | BooleanField |  |
| `metadata` | JSONField |  |

## Audit (`apps.audit`)

### `AuditLog`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `community` | ForeignKey | → `Community`; nullable |
| `actor` | ForeignKey | → `User`; nullable |
| `actor_label` | CharField |  |
| `action` | CharField |  |
| `model_name` | CharField |  |
| `object_id` | CharField |  |
| `object_label` | CharField |  |
| `changes` | JSONField |  |
| `reason` | TextField |  |
| `ip_address` | GenericIPAddressField | nullable |
| `user_agent` | CharField |  |
| `created_at` | DateTimeField |  |

## Approvals (`apps.approvals`)

### `ApprovalRequest`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `request_type` | CharField | choices: BILL_ADJUSTMENT, REFUND, TARIFF_CHANGE, METER_REPLACEMENT, CUSTOMER_DEACTIVATION, DEBT_WRITE_OFF, DISCONNECTION, RECONNECTION, PAYMENT_CORRECTION |
| `requested_by` | ForeignKey | → `User`; nullable |
| `target_model` | CharField |  |
| `target_id` | CharField |  |
| `target_label` | CharField |  |
| `payload` | JSONField |  |
| `reason` | TextField |  |
| `status` | CharField | choices: PENDING, APPROVED, REJECTED, EXECUTED, FAILED |
| `reviewed_by` | ForeignKey | → `User`; nullable |
| `reviewed_at` | DateTimeField | nullable |
| `review_note` | TextField |  |
| `execution_result` | JSONField |  |

## Documents (`apps.documents`)

### `Document`

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `title` | CharField |  |
| `category` | CharField | choices: CUSTOMER_AGREEMENT, CONNECTION_FORM, METER_INSTALLATION, MAINTENANCE_REPORT, WATER_QUALITY_REPORT, RECEIPT, OFFICIAL_NOTICE, POLICY, OTHER |
| `customer` | ForeignKey | → `Customer`; nullable |
| `asset` | ForeignKey | → `Asset`; nullable |
| `file` | FileField | nullable |
| `external_url` | CharField | Link to a file stored in Drive/S3/Cloudinary (recommended on Railway, whose disk is ephemeral) |
| `description` | TextField |  |
| `uploaded_by` | ForeignKey | → `User`; nullable |
| `is_public_to_customer` | BooleanField |  |

## Analytics (`apps.analytics`)

### `WaterProduction`

Daily volume produced/pumped into the network. Billed consumption vs production = non-revenue water (water loss).

| Field | Type | Notes |
|---|---|---|
| `id` | BigAutoField | unique |
| `created_at` | DateTimeField |  |
| `updated_at` | DateTimeField |  |
| `community` | ForeignKey | → `Community` |
| `date` | DateField |  |
| `asset` | ForeignKey | → `Asset`; nullable |
| `volume_m3` | DecimalField |  |
| `pump_hours` | DecimalField | nullable |
| `notes` | CharField |  |
