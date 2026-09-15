"""
Seed a realistic multi-community demo so every dashboard — platform, community, finance, water
manager, meter reader, technician, support, auditor and customer — has meaningful data.

    python manage.py seed_demo            # creates the demo estate (no-op if it already exists)
    python manage.py seed_demo --reset    # deletes and rebuilds it

What gets created
-----------------
Three communities with different personalities so the platform benchmark has something to rank:

  * Abokobi (Demo)          Greater Accra · 24 customers · well run · full staff logins
  * Nsawam Adoagyiri (Demo) Eastern       · 16 customers · high water loss, poor collections
  * Kpone (Demo)            Greater Accra · 10 customers · newly approved, first month of billing
  * Aburi (Demo)            Eastern       · registration pending approval (no data)

For every active community: tariffs & levies, properties, customers, meters, a reading route,
5 months of readings (current month partly read, some flagged), 4 generated billing periods with
back-dated bills, payments across MoMo / cash / agent / bank (some partial, some debtors), daily
water production, infrastructure tree with maintenance history, water-quality tests, outages,
tickets (assigned / unassigned / resolved / rated) with back-dated timestamps, an executed
approval (bill adjustment), a reversed payment, a meter replacement, a faulty meter, an
emergency, a dunning run and documents.

Logins (password for all: Demo1234!)
------------------------------------
  Platform:   admin@wtr.gh (from seed_platform, password from .env) · ops.platform@wtr.gh
  Abokobi:    admin.abokobi@wtr.gh · finance.abokobi@wtr.gh · water.abokobi@wtr.gh ·
              reader.abokobi@wtr.gh · tech.abokobi@wtr.gh · support.abokobi@wtr.gh · auditor.abokobi@wtr.gh · desk.abokobi@wtr.gh
  Household:  mensah@demo.gh (Mensah Family, Abokobi)
  Nsawam / Kpone have an admin, finance officer, water manager, reader and technician each
  (e.g. admin.nsawam@wtr.gh, reader.kpone@wtr.gh).
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import User
from apps.analytics.models import WaterProduction
from apps.approvals.models import ApprovalRequest
from apps.approvals.services import decide as decide_approval
from apps.billing.models import Bill, BillingPeriod
from apps.billing.services import generate_bills_for_period, refresh_overdue, run_dunning
from apps.communities.models import Community, CommunityRole, SubscriptionPlan, Town
from apps.customers.models import Customer, Property
from apps.documents.models import Document
from apps.infrastructure.models import Asset, Emergency, MaintenanceRecord, Outage, WaterQualityTest
from apps.meters.models import Meter, MeterReading, ReadingRoute
from apps.meters.services import record_reading, replace_meter, validate_reading
from apps.payments.models import Payment
from apps.payments.services import record_payment, reverse_payment
from apps.tariffs.models import ServiceCharge, TariffPlan, TariffTier
from apps.tickets.models import ServiceRequest, TicketComment
from core.roles import Role

PASSWORD = "Demo1234!"
SURNAMES = ["Mensah", "Owusu", "Boateng", "Asante", "Agyemang", "Osei", "Appiah", "Darko", "Adjei", "Amoah", "Ofori", "Quaye", "Tetteh", "Lartey", "Nkuah",
            "Frimpong", "Baah", "Danso", "Sarpong", "Yeboah", "Ansah", "Kumi", "Addo", "Bonsu", "Acheampong", "Opoku", "Gyasi", "Antwi", "Badu", "Kwarteng"]
FIRST_NAMES = ["Kofi", "Ama", "Kwame", "Akua", "Yaw", "Abena", "Kojo", "Efua", "Kwesi", "Adwoa", "Nana", "Esi"]

COMMUNITIES = [
    # key, name, region, district, town, system, size, profile
    dict(key="abokobi", name="Abokobi (Demo)", region="Greater Accra", district="Ga East", town="Abokobi", system="PIPED", size=24,
         towns=["Abokobi", "Sesemi", "Teiman", "Oyarifa", "Pantang"],
         lat=5.7167, lng=-0.2000, source="Mechanised borehole + overhead reservoir",
         pay_full=0.70, pay_part=0.15, nrw=1.15, full_staff=True),
    dict(key="nsawam", name="Nsawam Adoagyiri (Demo)", region="Eastern", district="Nsawam Adoagyiri", town="Nsawam", system="SMALL_TOWN", size=16,
         towns=["Nsawam", "Adoagyiri", "Djankrom", "Fotobi"],
         lat=5.8086, lng=-0.3506, source="River intake + treatment plant",
         pay_full=0.40, pay_part=0.20, nrw=1.55, full_staff=False),
    dict(key="kpone", name="Kpone (Demo)", region="Greater Accra", district="Kpone Katamanso", town="Kpone", system="BOREHOLE", size=10,
         towns=["Kpone", "Oyibi"],
         lat=5.6900, lng=-0.0600, source="Two mechanised boreholes",
         pay_full=0.80, pay_part=0.10, nrw=1.10, full_staff=False, months=2),
]


def _aware(d: date, hour=9):
    return timezone.make_aware(timezone.datetime.combine(d, timezone.datetime.min.time()).replace(hour=hour))


class Command(BaseCommand):
    help = "Seed a multi-community demo estate"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete the demo communities first")

    # ----------------------------------------------------------------------------------------
    def handle(self, *args, **opts):
        existing = Community.objects.filter(name__endswith="(Demo)")
        if existing.exists() and opts["reset"]:
            self.wipe(existing)
            existing = Community.objects.none()
        if existing.exists():
            self.stdout.write("Demo communities already exist — nothing to do (use --reset to rebuild).")
            return

        random.seed(7)
        self.today = timezone.localdate()
        self.platform_users()
        for spec in COMMUNITIES:
            with transaction.atomic():
                self.build_community(spec)
        Community.objects.create(name="Aburi (Demo)", region="Eastern", district="Akuapim South", town="Aburi", water_system_type="PIPED",
                                 service_status="PENDING", households_count=380, contact_name="Yaw Odame", contact_phone="0244111222",
                                 water_source="Spring catchment", latitude=5.8500, longitude=-0.1750)
        self.stdout.write(self.style.SUCCESS("Demo estate created: Abokobi, Nsawam Adoagyiri, Kpone (active) and Aburi (pending). Password for all demo users: Demo1234!"))

    # ----------------------------------------------------------------------------------------
    def wipe(self, communities):
        """
        Delete every record belonging to the demo communities. Financial models use PROTECT foreign
        keys on purpose (a bill can never silently vanish), so we can't just cascade: we walk every
        model that carries a `community` FK and delete in passes until nothing protected is left.
        """
        from django.apps import apps as django_apps
        from django.db.models.deletion import ProtectedError
        ids = list(communities.values_list("id", flat=True))
        tenant_models = [m for m in django_apps.get_models() if m is not Community and any(f.name == "community" for f in m._meta.fields)]
        remaining = set(tenant_models)
        for _ in range(12):
            if not remaining:
                break
            for model in list(remaining):
                try:
                    with transaction.atomic():
                        model.objects.filter(community_id__in=ids).delete()
                    remaining.discard(model)
                except ProtectedError:
                    continue
        if remaining:
            raise RuntimeError(f"Could not clear demo data for: {', '.join(m.__name__ for m in remaining)}")
        Community.objects.filter(id__in=ids).delete()
        self.stdout.write("Previous demo estate removed.")

    # ----------------------------------------------------------------------------------------
    def platform_users(self):
        for key, role in (("ops", Role.PLATFORM_OPERATIONS_ADMIN),):
            u, _ = User.objects.get_or_create(email=f"{key}.platform@wtr.gh", defaults=dict(full_name=f"{key.title()} Platform", role=role))
            u.set_password(PASSWORD)
            u.save()

    # ----------------------------------------------------------------------------------------
    def build_community(self, spec):
        today = self.today
        key = spec["key"]
        c = Community.objects.create(
            name=spec["name"], region=spec["region"], district=spec["district"], town=spec["town"], water_system_type=spec["system"],
            service_status="ACTIVE", approved_at=timezone.now() - timedelta(days=200), water_source=spec["source"], latitude=spec["lat"], longitude=spec["lng"],
            households_count=spec["size"] * 15, contact_name=f"{random.choice(FIRST_NAMES)} {random.choice(SURNAMES)}", contact_phone="0244000000",
        )
        # Nsawam is the "struggling" community: a lenient policy that lets debt build up.
        if key == "nsawam":
            s = c.settings
            s.due_days = 30
            s.late_penalty_percent = Decimal("0")
            s.water_loss_target_percent = Decimal("25")
            s.save()

        # ---- towns served by this community (a community = the district-level utility) ------
        towns = [Town.objects.create(community=c, name=n, code=n[:3].upper(), households_estimate=random.randint(60, 400),
                                     latitude=Decimal(str(round(spec["lat"] + i * 0.01, 6))), longitude=Decimal(str(round(spec["lng"] + i * 0.008, 6))))
                 for i, n in enumerate(spec["towns"])]
        self.towns = towns
        plans = list(SubscriptionPlan.objects.filter(is_active=True).order_by("monthly_price"))
        if plans:
            c.subscription_plan = plans[min(len(plans) - 1, {"abokobi": 1, "nsawam": 0, "kpone": 0}.get(key, 0))]
            c.save(update_fields=["subscription_plan"])

        # ---- staff -------------------------------------------------------------------------
        roles = [("admin", Role.COMMUNITY_ADMIN), ("finance", Role.COMMUNITY_FINANCE_OFFICER), ("water", Role.COMMUNITY_WATER_MANAGER),
                 ("reader", Role.METER_READER), ("tech", Role.TECHNICIAN)]
        if spec["full_staff"]:
            roles.append(("support", Role.CUSTOMER_SUPPORT))
            roles.append(("auditor", Role.AUDITOR))
            roles.append(("desk", Role.FRONT_DESK_COLLECTOR))
        users = {}
        for k, role in roles:
            users[k] = User.objects.create_user(email=f"{k}.{key}@wtr.gh", password=PASSWORD, full_name=f"{k.title()} {spec['town']}", role=role, community=c, phone="0240000000")
        c.admin = users["admin"]
        c.save(update_fields=["admin"])
        self.users = users
        if spec["full_staff"]:
            # An example community-defined role: a zone supervisor who reads meters, handles tickets and looks at bills.
            zone = CommunityRole.objects.create(community=c, name="Zone supervisor", description="Oversees one zone: readings, requests, customer records",
                                                modules=["customers", "meters", "readings", "validation", "tickets", "billing", "documents"])
            users["zone"] = User.objects.create_user(email=f"zone.{key}@wtr.gh", password=PASSWORD, full_name=f"Zone {spec['town']}", role=Role.CUSTOM, custom_role=zone, community=c, phone="0240000000")

        # ---- tariffs -----------------------------------------------------------------------
        res = TariffPlan.objects.create(community=c, name=f"{spec['town']} Residential", category="RESIDENTIAL", billing_mode="TIERED", minimum_charge=Decimal("5"))
        for o, f, t, r in ((1, 0, 5, "2.00"), (2, 5, 10, "2.50"), (3, 10, 20, "3.00"), (4, 20, None, "4.00")):
            TariffTier.objects.create(plan=res, order=o, from_m3=f, to_m3=t, rate_per_m3=Decimal(r))
        com = TariffPlan.objects.create(community=c, name=f"{spec['town']} Commercial", category="COMMERCIAL", billing_mode="TIERED", minimum_charge=Decimal("15"))
        for o, f, t, r in ((1, 0, 10, "4.00"), (2, 10, None, "5.50")):
            TariffTier.objects.create(plan=com, order=o, from_m3=f, to_m3=t, rate_per_m3=Decimal(r))
        inst = TariffPlan.objects.create(community=c, name=f"{spec['town']} Institutional", category="INSTITUTIONAL", billing_mode="FLAT", flat_rate=Decimal("3.50"), minimum_charge=Decimal("20"))
        ServiceCharge.objects.create(community=c, name="Service charge", charge_type="SERVICE", amount=Decimal("10"))
        ServiceCharge.objects.create(community=c, name="Maintenance levy", charge_type="MAINTENANCE_LEVY", amount=Decimal("5"))
        ServiceCharge.objects.create(community=c, name="Infrastructure levy", charge_type="INFRASTRUCTURE_LEVY", amount=Decimal("20"), applies_to=["COMMERCIAL", "INDUSTRIAL"])

        # ---- customers, properties, meters ------------------------------------------------
        route_a = ReadingRoute.objects.create(community=c, name="Zone A route", reader=users["reader"], schedule_note="Every 1st–5th of the month")
        route_b = ReadingRoute.objects.create(community=c, name="Zone B route", reader=users["reader"] if spec["size"] <= 12 else None, schedule_note="Every 6th–10th of the month")
        customers = []
        for i in range(spec["size"]):
            surname = SURNAMES[(i * 7 + len(key)) % len(SURNAMES)]
            if i % 8 == 7:
                cat, label = "COMMERCIAL", f"{surname} Enterprise"
            elif i == 5 and spec["size"] >= 12:
                cat, label = "SCHOOL", f"{spec['town']} Basic School"
            elif i == 9 and spec["size"] >= 12:
                cat, label = "CHURCH", f"{surname} Memorial Church"
            else:
                cat, label = "RESIDENTIAL", f"{surname} Family"
            zone = "A" if i < spec["size"] // 2 else "B"
            town = towns[i % len(towns)]
            prop = Property.objects.create(community=c, address=f"Plot {i + 1}, {town.name} Zone {zone}", property_type=cat, town=town,
                                           latitude=Decimal(str(round(spec["lat"] + i * 0.0008, 6))), longitude=Decimal(str(round(spec["lng"] + i * 0.0006, 6))))
            cust = Customer.objects.create(
                community=c, household_name=label, contact_person=f"{FIRST_NAMES[i % len(FIRST_NAMES)]} {surname}", phone=f"02{i % 5 + 3}{random.randint(1000000, 9999999)}",
                property=prop, town=town, category=cat, tariff_plan=com if cat == "COMMERCIAL" else inst if cat in ("SCHOOL", "CHURCH", "INSTITUTIONAL") else res,
                occupants=1 if cat != "RESIDENTIAL" else random.randint(2, 9), connection_date=date(2025, 1, 1) + timedelta(days=i * 10),
                address=prop.address, latitude=prop.latitude, longitude=prop.longitude, email="mensah@demo.gh" if (key == "abokobi" and i == 0) else "",
            )
            Meter.objects.create(community=c, serial_number=f"{key[:3].upper()}-{1000 + i}", customer=cust, property=prop, initial_reading=Decimal(random.randint(100, 900)),
                                 installation_date=cust.connection_date, status="ACTIVE", manufacturer="Itron" if i % 3 else "Elster", meter_size="15mm" if cat == "RESIDENTIAL" else "20mm",
                                 is_smart=(i % 6 == 5), iot_device_id=f"iot-{key}-{i}" if i % 6 == 5 else "", installation_location="Front yard")
            customers.append(cust)
            (route_a if zone == "A" else route_b).customers.add(cust)
        self.customers = customers

        if key == "abokobi":
            portal = User.objects.create_user(email="mensah@demo.gh", password=PASSWORD, full_name=customers[0].contact_person, role=Role.CUSTOMER, community=c)
            customers[0].user = portal
            customers[0].save(update_fields=["user"])
            self.portal = portal
        else:
            self.portal = None

        # ---- infrastructure (before readings so outages/maintenance can reference assets) --
        self.infrastructure(c, spec)

        # ---- months of readings, bills, payments ----------------------------------------
        self.billing_history(c, spec)

        # ---- corrections, replacements, tickets, emergencies, documents -----------------
        self.operations_story(c, spec)

    # ----------------------------------------------------------------------------------------
    def infrastructure(self, c, spec):
        today = self.today
        users = self.users
        town = spec["town"]
        bh = Asset.objects.create(community=c, name="Borehole 1", asset_type="BOREHOLE", installed_on=date(2022, 3, 1), capacity="4 L/s",
                                  maintenance_interval_days=180, last_maintenance=today - timedelta(days=120), next_maintenance=today + timedelta(days=60),
                                  latitude=Decimal(str(spec["lat"] - 0.004)), longitude=Decimal(str(spec["lng"] - 0.001)))
        pump = Asset.objects.create(community=c, name="Submersible pump", asset_type="PUMP", parent=bh, installed_on=date(2022, 3, 1), capacity="5.5 kW", manufacturer="Grundfos",
                                    maintenance_interval_days=90, last_maintenance=today - timedelta(days=80), next_maintenance=today + timedelta(days=10), status="OPERATIONAL")
        res = Asset.objects.create(community=c, name="Overhead reservoir", asset_type="RESERVOIR", parent=pump, capacity="50 m³", installed_on=date(2022, 4, 1),
                                   maintenance_interval_days=365, next_maintenance=today + timedelta(days=150), latitude=Decimal(str(spec["lat"] - 0.002)), longitude=Decimal(str(spec["lng"] + 0.001)))
        Asset.objects.create(community=c, name="Main distribution line", asset_type="PIPELINE", parent=res, capacity="2.4 km", installed_on=date(2022, 4, 1),
                             maintenance_interval_days=365, next_maintenance=today + timedelta(days=25), status="DEGRADED" if spec["key"] == "nsawam" else "OPERATIONAL")
        doser = Asset.objects.create(community=c, name="Chlorine doser", asset_type="CHLORINATION", parent=res, installed_on=date(2023, 1, 1), status="DEGRADED",
                                     maintenance_interval_days=60, last_maintenance=today - timedelta(days=75), next_maintenance=today - timedelta(days=15))
        Asset.objects.create(community=c, name="Solar array", asset_type="SOLAR", parent=pump, capacity="8 kW", installed_on=date(2023, 6, 1),
                             maintenance_interval_days=180, next_maintenance=today + timedelta(days=90))
        if spec["key"] == "nsawam":
            Asset.objects.create(community=c, name="Treatment plant", asset_type="TREATMENT_PLANT", parent=bh, capacity="120 m³/day", installed_on=date(2019, 8, 1),
                                 status="UNDER_MAINTENANCE", maintenance_interval_days=90, next_maintenance=today - timedelta(days=40))

        MaintenanceRecord.objects.create(community=c, asset=pump, maintenance_type="PREVENTIVE", performed_on=today - timedelta(days=80), technician=users["tech"],
                                         description="Bearings replaced, impeller cleaned, insulation tested", cost=Decimal("850"), downtime_hours=Decimal("4"), parts_used="2× SKF 6205 bearings")
        MaintenanceRecord.objects.create(community=c, asset=pump, maintenance_type="CORRECTIVE", performed_on=today - timedelta(days=200), technician=users["tech"],
                                         description="Motor burnt out after power surge – rewound", cost=Decimal("2400"), downtime_hours=Decimal("36"), was_failure=True, failure_cause="Power surge")
        MaintenanceRecord.objects.create(community=c, asset=bh, maintenance_type="INSPECTION", performed_on=today - timedelta(days=120), technician=users["tech"],
                                         description="Yield test and camera inspection – 4.1 L/s, casing sound", cost=Decimal("600"), downtime_hours=Decimal("2"))
        MaintenanceRecord.objects.create(community=c, asset=doser, maintenance_type="CORRECTIVE", performed_on=today - timedelta(days=6), technician=users["tech"],
                                         description="Dosing pump diaphragm replaced; calibration pending", cost=Decimal("320"), downtime_hours=Decimal("1"))

        # Quality: monthly tests, one turbidity excursion in the latest test
        for k in range(6):
            t = WaterQualityTest.objects.create(community=c, asset=res, testing_location="Reservoir outlet", tested_on=today - timedelta(days=30 * k + 1), laboratory="GWCL Lab, Accra",
                                                ph=Decimal(str(round(random.uniform(6.9, 7.6), 2))), turbidity_ntu=Decimal("6.4") if k == 0 else Decimal(str(round(random.uniform(1.2, 3.8), 2))),
                                                chlorine_mg_l=Decimal("0.6"), tds_mg_l=Decimal("310"), temperature_c=Decimal("27.4"), ecoli_cfu=0, coliform_cfu=0, tested_by=users["water"])
            t.evaluate()
            t.save()

        # Outages: one restored last month, one active for the struggling community
        o = Outage.objects.create(community=c, cause="Pump tripped on low voltage", affected_area="Zone B", asset=pump, started_at=timezone.now() - timedelta(days=22, hours=7),
                                  expected_restoration=timezone.now() - timedelta(days=22), restored_at=timezone.now() - timedelta(days=21, hours=20), status="RESTORED",
                                  declared_by=users["water"], notify_customers=False, customers_notified=spec["size"])
        Outage.objects.create(community=c, cause="Scheduled reservoir cleaning", affected_area="Whole community", asset=res, started_at=timezone.now() - timedelta(days=60, hours=6),
                              restored_at=timezone.now() - timedelta(days=60), status="RESTORED", declared_by=users["water"], notify_customers=False, customers_notified=spec["size"])
        if spec["key"] == "nsawam":
            Outage.objects.create(community=c, cause="Burst on main distribution line near the market", affected_area="Zone A", asset=None, started_at=timezone.now() - timedelta(hours=5),
                                  expected_restoration=timezone.now() + timedelta(hours=6), status="ACTIVE", declared_by=users["water"], notify_customers=False, customers_notified=spec["size"] // 2)
            Emergency.objects.create(community=c, emergency_type="PIPELINE_BURST", severity="HIGH", title="Main line burst at Nsawam market",
                                     description="2-inch main split at the junction; water flowing onto the road. Valve V3 closed, repair crew dispatched.", status="RESPONDING",
                                     declared_by=users["water"], declared_at=timezone.now() - timedelta(hours=5))
        Emergency.objects.create(community=c, emergency_type="PUMP_FAILURE", severity="CRITICAL", title="Pump motor burnt out", description="Total loss of supply until motor rewound.",
                                 status="RESOLVED", declared_by=users["water"], declared_at=timezone.now() - timedelta(days=200), resolved_at=timezone.now() - timedelta(days=198),
                                 response_notes="Motor rewound by contractor; surge protector installed.")
        self.assets = dict(bh=bh, pump=pump, res=res, doser=doser)

    # ----------------------------------------------------------------------------------------
    def billing_history(self, c, spec):
        today = self.today
        users = self.users
        customers = self.customers
        n_months = spec.get("months", 5)
        months = []
        m = today.replace(day=1)
        for _ in range(n_months):
            months.append(m)
            m = (m - timedelta(days=1)).replace(day=1)
        months.reverse()

        for mi, mstart in enumerate(months):
            mend = (mstart + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            current = mi == len(months) - 1

            # -- readings ------------------------------------------------------------------
            for idx, cust in enumerate(customers):
                meter = cust.active_meter
                base = 28 if cust.category == "COMMERCIAL" else 45 if cust.category == "SCHOOL" else 12 if cust.category == "CHURCH" else random.randint(8, 22)
                cons = base + random.randint(-3, 4)
                if current:
                    # Zone B is read later in the month; leave part of it unread so coverage < 100 %.
                    if idx >= spec["size"] * 3 // 4 and today.day < 10:
                        continue
                    cons = max(1, round(cons * (today.day / ((mend - mstart).days + 1))))
                    if idx == 3:
                        cons = base * 4          # leak → CONSUMPTION_SPIKE
                    if idx == 7 and spec["size"] > 8:
                        cons = 0                 # vacant / bypass → zero consumption
                last = MeterReading.objects.filter(meter=meter).exclude(status="REJECTED").order_by("-reading_date", "-id").first()
                base_value = last.reading_value if last else meter.initial_reading
                reading, _ = record_reading(community=c, meter=meter, reading_value=base_value + cons, reading_date=(today if current else mend) - timedelta(days=random.randint(0, 3)),
                                            read_by=users["reader"], source="IOT" if meter.is_smart else "MOBILE", latitude=cust.latitude, longitude=cust.longitude,
                                            device_id=f"android-{users['reader'].id}", auto_validate=True)
                if not current and reading.status == "PENDING":
                    validate_reading(reading, users["water"], True, "Confirmed on site")

            # -- production ≈ validated consumption × NRW factor ------------------------
            billed = MeterReading.objects.filter(community=c, reading_date__gte=mstart, reading_date__lte=mend, status__in=["VALIDATED", "BILLED"]).aggregate(s=Sum("consumption"))["s"] or Decimal("0")
            days = (min(mend, today) - mstart).days + 1
            per_day = (billed * Decimal(str(spec["nrw"])) / days).quantize(Decimal("0.1"))
            for d in range(days):
                jitter = Decimal(str(round(random.uniform(0.85, 1.15), 3)))     # ±15 % day-to-day variation, mean preserved
                WaterProduction.objects.create(community=c, asset=self.assets["bh"], date=mstart + timedelta(days=d), volume_m3=(per_day * jitter).quantize(Decimal("0.1")),
                                               pump_hours=Decimal(str(round(random.uniform(7.5, 10.5), 1))))

            # -- billing period ------------------------------------------------------------
            # Bills for a month are issued on the 1st of the following month (as a real office would do),
            # so the current month always shows "billed this month" while its own period stays OPEN.
            issued_on = mend + timedelta(days=1)
            period = BillingPeriod.objects.create(community=c, name=mstart.strftime("%B %Y"), start_date=mstart, end_date=mend, due_date=issued_on + timedelta(days=c.settings.due_days))
            if current:
                continue   # stays OPEN with readings still coming in — generate it from the Billing periods page
            generate_bills_for_period(period, users["finance"])
            Bill.objects.filter(period=period).update(issued_at=_aware(issued_on, 9), created_at=_aware(issued_on, 9), due_date=issued_on + timedelta(days=c.settings.due_days))
            period.generated_at = _aware(issued_on, 9)
            period.save(update_fields=["generated_at"])

            # -- payments ------------------------------------------------------------------
            for idx, cust in enumerate(customers):
                cust.refresh_from_db()
                if cust.outstanding_balance <= 0:
                    continue
                roll = random.random()
                pay_day = min(issued_on + timedelta(days=random.randint(0, 18)), today)
                method = random.choice(["MOBILE_MONEY", "MOBILE_MONEY", "MOBILE_MONEY", "CASH", "AGENT", "BANK", "USSD"])
                provider = {"MOBILE_MONEY": random.choice(["MTN MoMo", "Telecel Cash", "AT Money"]), "BANK": "GCB Bank", "USSD": "MTN MoMo", "AGENT": "Agent Kwabena"}.get(method, "")
                if roll < spec["pay_full"]:
                    record_payment(community=c, customer=cust, amount=cust.outstanding_balance, method=method, provider=provider, provider_reference=f"{key_ref(method)}{random.randint(100000, 999999)}",
                                   recorded_by=users["finance"] if method != "USSD" else None, paid_at=_aware(pay_day, random.randint(8, 19)), payer_phone=cust.phone, deliver=False)
                elif roll < spec["pay_full"] + spec["pay_part"]:
                    record_payment(community=c, customer=cust, amount=(cust.outstanding_balance / 2).quantize(Decimal("0.01")), method=method, provider=provider,
                                   recorded_by=users["finance"], paid_at=_aware(pay_day, random.randint(8, 19)), payer_phone=cust.phone, deliver=False)

        refresh_overdue(c)
        run_dunning(c, users["finance"])
        self.months = months

    # ----------------------------------------------------------------------------------------
    def operations_story(self, c, spec):
        today = self.today
        users = self.users
        customers = self.customers
        portal = self.portal
        raised = portal or users["admin"]

        # A bill dispute that went through approval and was executed (shows up for auditors & finance)
        disputed = Bill.objects.filter(community=c, customer=customers[5]).order_by("-issued_at").first()
        if disputed:
            req = ApprovalRequest.objects.create(community=c, request_type="BILL_ADJUSTMENT", requested_by=users["finance"], target_model="Bill", target_id=str(disputed.id),
                                                 target_label=disputed.invoice_number, payload={"bill": disputed.id, "amount": "-12.50"}, reason="Meter misread by 5 m³ — confirmed on site by the water manager.")
            decide_approval(req, users["admin"], True, "Verified with the reader's photo.")
            ApprovalRequest.objects.filter(pk=req.pk).update(created_at=timezone.now() - timedelta(days=9), reviewed_at=timezone.now() - timedelta(days=8))
        # A pending write-off request for the finance officer / admin to decide
        debtor = Customer.objects.filter(community=c, outstanding_balance__gt=20).order_by("-outstanding_balance").first()
        if debtor:
            ApprovalRequest.objects.create(community=c, request_type="DEBT_WRITE_OFF", requested_by=users["finance"], target_model="Customer", target_id=str(debtor.id),
                                           target_label=f"{debtor.household_name} ({debtor.customer_id})", payload={"customer": debtor.id, "amount": "15.00"},
                                           reason="Household relocated; balance below the cost of recovery.")

        # A payment recorded against the wrong customer and reversed
        wrong = Payment.objects.filter(community=c, status="SUCCESSFUL", customer=customers[2]).order_by("-paid_at").first()
        if wrong:
            reverse_payment(wrong, users["finance"], "Recorded against the wrong household — re-entered under CUS-…003.")

        # A faulty meter, and a meter that was replaced last month (audit trail kept)
        faulty = customers[4].active_meter
        if faulty:
            faulty.status = "FAULTY"
            faulty.condition = "DAMAGED"
            faulty.notes = "Dial fogged, register sticking. Replacement requested."
            faulty.save()
        spare = Meter.objects.create(community=c, serial_number=f"{spec['key'][:3].upper()}-SPARE-1", status="AVAILABLE", manufacturer="Itron", meter_size="15mm", initial_reading=Decimal("0"))
        Meter.objects.create(community=c, serial_number=f"{spec['key'][:3].upper()}-SPARE-2", status="AVAILABLE", manufacturer="Itron", meter_size="15mm", initial_reading=Decimal("0"))
        old = customers[6].active_meter
        if old and spec["size"] > 8:
            replace_meter(community=c, old_meter=old, new_meter=spare, final_reading=old.current_reading, initial_reading=Decimal("0"),
                          reason="Register seized after 14 years in service", performed_by=users["tech"], performed_on=today)

        # Tickets with realistic ages
        t1 = ServiceRequest.objects.create(community=c, customer=customers[3], town=customers[3].town, category="LEAK", priority="HIGH", title="Water pooling near the meter",
                                           description="Continuous flow at the meter box since Monday morning. Ground is soft around the pipe.", location=customers[3].address,
                                           raised_by=raised, status="ASSIGNED", assigned_to=users["tech"])
        ServiceRequest.objects.filter(pk=t1.pk).update(created_at=timezone.now() - timedelta(hours=30))
        TicketComment.objects.create(community=c, ticket=t1, author=users["support"] if "support" in users else users["admin"], body="Assigned to the technician — visit planned for tomorrow morning.", is_internal=False)
        t2 = ServiceRequest.objects.create(community=c, customer=customers[5], category="BILL_DISPUTE", priority="MEDIUM", title="Bill seems too high this month",
                                           description="My household usage did not change but the bill doubled.", raised_by=users.get("support", users["admin"]), status="OPEN")
        ServiceRequest.objects.filter(pk=t2.pk).update(created_at=timezone.now() - timedelta(days=4))
        t3 = ServiceRequest.objects.create(community=c, customer=customers[1], category="NO_WATER", priority="URGENT", title="No water since this morning",
                                           description="Taps completely dry in the whole compound.", location="Zone A", raised_by=users.get("support", users["admin"]), status="OPEN")
        ServiceRequest.objects.filter(pk=t3.pk).update(created_at=timezone.now() - timedelta(hours=6))
        t4 = ServiceRequest.objects.create(community=c, customer=customers[4], category="METER_FAULT", priority="MEDIUM", title="Meter glass foggy, hard to read",
                                           description="Reader could not see the dial.", raised_by=users["reader"], status="IN_PROGRESS", assigned_to=users["tech"])
        ServiceRequest.objects.filter(pk=t4.pk).update(created_at=timezone.now() - timedelta(days=2))
        for k, (cust, cat, title_, res_, rating, days_ago) in enumerate([
            (customers[9 % len(customers)], "NEW_CONNECTION", "Connect new house on Plot 40", "Connected and meter installed", 5, 12),
            (customers[8 % len(customers)], "CONTACT_UPDATE", "Change my phone number", "Number updated", 4, 20),
            (customers[2], "LEAK", "Leak at the public standpipe", "Tap washer replaced", 5, 33),
            (customers[7 % len(customers)], "BILL_DISPUTE", "Charged for water during outage", "Bill adjusted after review", 3, 45),
        ]):
            t = ServiceRequest.objects.create(community=c, customer=cust, category=cat, priority="MEDIUM", title=title_, description=title_, raised_by=users.get("support", users["admin"]),
                                              status="CLOSED", assigned_to=users["tech"], resolution=res_, satisfaction_rating=rating,
                                              resolved_at=timezone.now() - timedelta(days=days_ago - 1), closed_at=timezone.now() - timedelta(days=days_ago - 1))
            ServiceRequest.objects.filter(pk=t.pk).update(created_at=timezone.now() - timedelta(days=days_ago))

        # Two reports that came in through the public QR link (no account behind them)
        for k, (cat, title_, desc, town) in enumerate([
            ("LEAK", "Burst pipe at the market road", "Water gushing from the ground near the taxi rank since last night.", self.towns[0]),
            ("NO_WATER", "No water in the whole street", "Taps dry in our area since morning; neighbours too.", self.towns[-1]),
        ]):
            tp = ServiceRequest.objects.create(community=c, category=cat, priority="URGENT" if cat == "NO_WATER" else "HIGH", title=title_, description=desc, location=f"{town.name} main road",
                                               town=town, source="PUBLIC", reporter_name=random.choice(FIRST_NAMES) + " " + random.choice(SURNAMES), reporter_phone=f"024{random.randint(1000000, 9999999)}", status="OPEN")
            ServiceRequest.objects.filter(pk=tp.pk).update(created_at=timezone.now() - timedelta(hours=3 + k * 10))
        c.public_report_token = f"demo-{spec['key']}-{random.randint(100000, 999999)}xyz"
        c.save(update_fields=["public_report_token"])

        # Documents
        Document.objects.create(community=c, title="Customer service agreement (template)", category="CUSTOMER_AGREEMENT", external_url="https://example.com/wtr/agreement.pdf",
                                description="Standard household connection agreement", uploaded_by=users["admin"])
        Document.objects.create(community=c, title=f"Water quality report — {today.strftime('%B %Y')}", category="WATER_QUALITY_REPORT", external_url="https://example.com/wtr/quality.pdf",
                                uploaded_by=users["water"], is_public_to_customer=True)
        Document.objects.create(community=c, title="Tariff notice 2026", category="OFFICIAL_NOTICE", external_url="https://example.com/wtr/tariff-notice.pdf",
                                uploaded_by=users["admin"], is_public_to_customer=True)


def key_ref(method):
    return {"MOBILE_MONEY": "MP", "USSD": "MP", "BANK": "TRX", "AGENT": "AG", "CASH": "CSH"}.get(method, "REF")
