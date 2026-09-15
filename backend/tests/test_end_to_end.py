"""
End-to-end test of the core business engine through the real HTTP API:
Community → Customer → Meter → Reading (anomaly) → Tariff → Bill → Payment → Receipt → Ledger → Dunning → Approvals → Dashboards,
plus tenant-isolation checks. Run: python manage.py test
"""
from decimal import Decimal
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient


class EndToEndTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_platform", verbosity=0)

    def login(self, email, password="Passw0rd!123"):
        c = APIClient()
        r = c.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return c, r.data["user"]

    def test_full_lifecycle(self):
        admin, me = self.login("admin@wtr.gh", "ChangeMe123!")
        self.assertIn("MANAGE_COMMUNITIES", me["permissions"])

        # --- Platform: create + approve two communities ------------------------------------------
        r = admin.post("/api/communities/", {"name": "Abokobi", "region": "Greater Accra", "district": "Ga East", "water_system_type": "PIPED"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        com_a = r.data; self.assertTrue(com_a["code"].startswith("WTR-GH-GRE-"))
        r = admin.post(f"/api/communities/{com_a['id']}/approve/", {}, format="json"); self.assertEqual(r.data["service_status"], "ACTIVE")
        com_b = admin.post("/api/communities/", {"name": "Nsawam", "region": "Eastern", "district": "Nsawam Adoagyiri"}, format="json").data
        self.assertNotEqual(com_a["code"], com_b["code"])

        # --- Users: community admin for A, community admin for B ---------------------------------
        for email, cid in (("adminA@wtr.gh", com_a["id"]), ("adminB@wtr.gh", com_b["id"])):
            r = admin.post("/api/auth/users/", {"email": email, "full_name": email, "role": "COMMUNITY_ADMIN", "community": cid, "password": "Passw0rd!123"}, format="json")
            self.assertEqual(r.status_code, 201, r.content)
        ca, _ = self.login("adminA@wtr.gh")
        cb, _ = self.login("adminB@wtr.gh")
        r = ca.post("/api/auth/users/", {"email": "reader@wtr.gh", "full_name": "Reader", "role": "METER_READER", "password": "Passw0rd!123"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); reader_id = r.data["id"]
        r = ca.post("/api/auth/users/", {"email": "fin@wtr.gh", "full_name": "Finance", "role": "COMMUNITY_FINANCE_OFFICER", "password": "Passw0rd!123"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        # community admin cannot mint platform users
        r = ca.post("/api/auth/users/", {"email": "x@wtr.gh", "full_name": "x", "role": "PLATFORM_SUPER_ADMIN", "password": "Passw0rd!123"}, format="json")
        self.assertEqual(r.status_code, 403)

        # --- Tariff + service charges (community scoped) -----------------------------------------
        r = ca.post("/api/tariffs/", {"name": "Abokobi Residential", "category": "RESIDENTIAL", "billing_mode": "TIERED", "minimum_charge": "5",
                                      "tiers": [{"from_m3": 0, "to_m3": 5, "rate_per_m3": "2.00"}, {"from_m3": 5, "to_m3": 10, "rate_per_m3": "2.50"},
                                                {"from_m3": 10, "to_m3": 20, "rate_per_m3": "3.00"}, {"from_m3": 20, "to_m3": None, "rate_per_m3": "4.00"}]}, format="json")
        self.assertEqual(r.status_code, 201, r.content); tariff = r.data
        r = ca.get(f"/api/tariffs/{tariff['id']}/simulate/?consumption=25")
        # 5*2 + 5*2.5 + 10*3 + 5*4 = 10+12.5+30+20 = 72.50
        self.assertEqual(r.data["water_charge"], "72.50", r.data)
        ca.post("/api/service-charges/", {"name": "Service charge", "charge_type": "SERVICE", "amount": "10.00"}, format="json")
        ca.post("/api/service-charges/", {"name": "Maintenance levy", "charge_type": "MAINTENANCE_LEVY", "amount": "5.00"}, format="json")
        # B cannot see A's tariff
        self.assertEqual(cb.get(f"/api/tariffs/{tariff['id']}/").status_code, 404)

        # --- Customer + property + meter ---------------------------------------------------------
        prop = ca.post("/api/properties/", {"address": "Plot 12, Abokobi"}, format="json").data
        r = ca.post("/api/customers/", {"household_name": "Mensah Family", "contact_person": "Kofi Mensah", "phone": "0244000001", "property": prop["id"],
                                        "category": "RESIDENTIAL", "tariff_plan": tariff["id"], "email": "mensah@example.com", "latitude": "5.7", "longitude": "-0.2"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); cust = r.data
        self.assertTrue(cust["customer_id"].startswith("CUS-GRE-"))
        r = ca.post("/api/meters/", {"serial_number": "SN-0001", "customer": cust["id"], "property": prop["id"], "initial_reading": "1250", "installation_date": "2026-01-01"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); meter = r.data
        self.assertEqual(meter["status"], "ACTIVE")
        # tenant isolation — another community sees nothing
        self.assertEqual(cb.get(f"/api/customers/{cust['id']}/").status_code, 404)
        self.assertEqual(cb.get("/api/customers/").data["count"], 0)
        # platform isolation — platform staff run the registry, not the community
        self.assertEqual(admin.get("/api/customers/").status_code, 403)                    # no VIEW_CUSTOMERS at all
        self.assertEqual(admin.get("/api/tariffs/").status_code, 403)
        self.assertEqual(admin.get(f"/api/dashboard/community/?community={com_a['id']}").status_code, 403)
        self.assertEqual(admin.get(f"/api/communities/{com_a['id']}/settings/").status_code, 403)
        self.assertEqual(admin.get("/api/communities/").data["count"], 2)                  # registry is visible
        r = admin.post("/api/auth/users/", {"email": "t@wtr.gh", "full_name": "t", "role": "TECHNICIAN", "community": com_a["id"], "password": "Passw0rd!123"}, format="json")
        self.assertEqual(r.status_code, 403, "platform staff must not create community staff")
        self.assertNotIn("reader@wtr.gh", [u["email"] for u in admin.get("/api/auth/users/").data["results"]], "platform staff must not list community staff")
        # system settings — the community admin can switch modules off per role
        fin, me_fin = self.login("fin@wtr.gh")
        self.assertIn("VIEW_PAYMENTS", me_fin["permissions"])
        r = ca.patch(f"/api/communities/{com_a['id']}/features/", {"module_access": {"COMMUNITY_FINANCE_OFFICER": ["payments"], "COMMUNITY_ADMIN": ["customers"]}}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertNotIn("COMMUNITY_ADMIN", r.data["module_access"], "admin cannot restrict themselves")
        self.assertNotIn("VIEW_PAYMENTS", fin.get("/api/auth/me/").data["permissions"])
        self.assertEqual(fin.get("/api/payments/").status_code, 403)
        self.assertEqual(admin.get(f"/api/communities/{com_a['id']}/features/").status_code, 403, "platform staff cannot see system settings")
        ca.patch(f"/api/communities/{com_a['id']}/features/", {"module_access": {}}, format="json")   # restore for the rest of the test

        # --- Readings: manual (auto-validated for admin), anomaly, offline sync idempotency -----
        r = ca.post("/api/readings/", {"meter": meter["id"], "reading_value": "1275", "reading_date": "2026-09-05"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); self.assertEqual(r.data["consumption"], "25.000"); self.assertEqual(r.data["status"], "VALIDATED")
        rd, _ = self.login("reader@wtr.gh")
        r = rd.post("/api/readings/bulk_sync/", {"readings": [
            {"meter": meter["id"], "reading_value": "1270", "reading_date": "2026-09-10", "client_reading_id": "uuid-1"},
            {"meter": meter["id"], "reading_value": "1270", "reading_date": "2026-09-10", "client_reading_id": "uuid-1"}]}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual([x["status"] for x in r.data["results"]], ["created", "duplicate"])
        self.assertIn("REVERSE_READING", r.data["results"][0]["flags"])
        rev_id = r.data["results"][0]["id"]
        self.assertEqual(ca.post(f"/api/readings/{rev_id}/reject/", {"note": "entry error"}, format="json").data["status"], "REJECTED")
        self.assertEqual(ca.get("/api/readings/anomalies/").data["count"], 0)

        # --- Billing period + generation ---------------------------------------------------------
        r = ca.post("/api/billing-periods/", {"name": "September 2026", "frequency": "MONTHLY", "start_date": "2026-09-01", "end_date": "2026-09-30", "due_date": "2026-10-14"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); period = r.data
        r = ca.post(f"/api/billing-periods/{period['id']}/generate/", {}, format="json")
        self.assertEqual(r.status_code, 200, r.content); self.assertEqual(r.data["summary"]["created"], 1, r.data)
        bill = ca.get("/api/bills/").data["results"][0]
        self.assertTrue(bill["invoice_number"].startswith("INV-WTR-2026-"))
        self.assertEqual(bill["water_charge"], "72.50"); self.assertEqual(bill["service_charge"], "10.00"); self.assertEqual(bill["maintenance_levy"], "5.00")
        self.assertEqual(bill["total_amount"], "87.50"); self.assertEqual(bill["status"], "ISSUED")
        cust_now = ca.get(f"/api/customers/{cust['id']}/").data
        self.assertEqual(cust_now["outstanding_balance"], "87.50")
        # regenerating is idempotent
        self.assertEqual(ca.post(f"/api/billing-periods/{period['id']}/generate/", {}, format="json").data["summary"]["already_billed"], 1)

        # --- Payment: partial then full, receipt + ledger ---------------------------------------
        r = ca.post("/api/payments/", {"customer": cust["id"], "amount": "50.00", "method": "MOBILE_MONEY", "provider": "MTN MoMo", "provider_reference": "MP123"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); self.assertTrue(r.data["reference"].startswith("PAY-WTR-")); self.assertTrue(r.data["receipt_number"].startswith("RCT-WTR-"))
        self.assertEqual(ca.get(f"/api/bills/{bill['id']}/").data["status"], "PARTIALLY_PAID")
        # duplicate provider reference rejected
        self.assertEqual(ca.post("/api/payments/", {"customer": cust["id"], "amount": "1", "method": "MOBILE_MONEY", "provider_reference": "MP123"}, format="json").status_code, 400)
        ca.post("/api/payments/", {"customer": cust["id"], "amount": "37.50", "method": "CASH"}, format="json")
        b = ca.get(f"/api/bills/{bill['id']}/").data
        self.assertEqual(b["status"], "PAID"); self.assertEqual(b["outstanding_amount"], "0.00")
        self.assertEqual(ca.get(f"/api/customers/{cust['id']}/").data["outstanding_balance"], "0.00")
        ledger = ca.get(f"/api/customers/{cust['id']}/statement/").data["entries"]
        self.assertEqual([e["entry_type"] for e in ledger], ["PAYMENT", "PAYMENT", "BILL"])
        self.assertEqual(ledger[0]["balance_after"], "0.00")

        # --- Approval workflow: finance officer requests adjustment, admin approves → executes ---
        fin, _ = self.login("fin@wtr.gh")
        self.assertEqual(fin.post(f"/api/bills/{bill['id']}/adjust/", {"amount": "-5", "reason": "x"}, format="json").status_code, 403)
        r = fin.post("/api/approvals/", {"request_type": "BILL_ADJUSTMENT", "payload": {"bill": bill["id"], "amount": "-7.50"}, "reason": "Goodwill", "target_label": bill["invoice_number"]}, format="json")
        self.assertEqual(r.status_code, 201, r.content); req = r.data
        self.assertEqual(fin.post(f"/api/approvals/{req['id']}/approve/", {}, format="json").status_code, 403)  # no APPROVE_REQUESTS
        r = ca.post(f"/api/approvals/{req['id']}/approve/", {"note": "ok"}, format="json")
        self.assertEqual(r.data["status"], "EXECUTED", r.data)
        self.assertEqual(ca.get(f"/api/customers/{cust['id']}/").data["outstanding_balance"], "-7.50")  # credit

        # --- Meter replacement keeps audit trail ------------------------------------------------
        new = ca.post("/api/meters/", {"serial_number": "SN-0002", "initial_reading": "0"}, format="json").data
        r = ca.post(f"/api/meters/{meter['id']}/replace/", {"new_meter": new["id"], "final_reading": "1290", "initial_reading": "0", "reason": "Faulty dial"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(ca.get(f"/api/meters/{meter['id']}/").data["status"], "REPLACED")
        self.assertEqual(ca.get(f"/api/meters/{new['id']}/").data["customer"], cust["id"])

        # --- Customer portal --------------------------------------------------------------------
        r = ca.post(f"/api/customers/{cust['id']}/create_portal_login/", {"email": "mensah@example.com", "password": "Passw0rd!123"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        cp, cp_me = self.login("mensah@example.com")
        self.assertEqual(cp_me["role"], "CUSTOMER")
        r = cp.get("/api/dashboard/customer/"); self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["summary"]["outstanding"], -7.5); self.assertEqual(len(r.data["bills"]), 1)
        r = cp.post("/api/tickets/", {"category": "LEAK", "title": "Leak at the gate", "description": "Water pooling"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); ticket = r.data
        self.assertEqual(cp.get("/api/customers/").status_code, 403)  # customers cannot list customers
        r = ca.post(f"/api/tickets/{ticket['id']}/assign/", {"assigned_to": reader_id, "priority": "HIGH"}, format="json"); self.assertEqual(r.data["status"], "ASSIGNED")
        ca.post(f"/api/tickets/{ticket['id']}/transition/", {"status": "IN_PROGRESS"}, format="json")
        self.assertEqual(ca.post(f"/api/tickets/{ticket['id']}/transition/", {"status": "RESOLVED", "resolution": "Fixed valve"}, format="json").data["status"], "RESOLVED")
        self.assertEqual(cp.post(f"/api/tickets/{ticket['id']}/rate/", {"rating": 5}, format="json").data["status"], "CLOSED")

        # --- Infrastructure, outage, water quality, production, dunning, dashboards -------------
        pump = ca.post("/api/assets/", {"name": "Main pump", "asset_type": "PUMP", "installed_on": "2024-01-01", "maintenance_interval_days": 90}, format="json").data
        self.assertTrue(pump["asset_id"].startswith("PUMP-"))
        r = ca.post("/api/maintenance/", {"asset": pump["id"], "performed_on": "2026-09-01", "description": "Serviced", "cost": "120"}, format="json"); self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(ca.get(f"/api/assets/{pump['id']}/").data["next_maintenance"], "2026-11-30")
        r = ca.post("/api/outages/", {"cause": "Pump failure", "affected_area": "Zone 2", "started_at": "2026-09-13T08:20:00Z", "expected_restoration": "2026-09-13T15:00:00Z"}, format="json")
        self.assertEqual(r.status_code, 201, r.content); self.assertEqual(r.data["customers_notified"], 1)
        self.assertEqual(ca.post(f"/api/outages/{r.data['id']}/restore/", {}, format="json").data["status"], "RESTORED")
        r = ca.post("/api/water-quality/", {"testing_location": "Reservoir tap", "tested_on": "2026-09-10", "ph": "7.1", "turbidity_ntu": "9", "chlorine_mg_l": "0.5"}, format="json")
        self.assertEqual(r.data["compliance_status"], "ALERT", r.data)
        ca.post("/api/water-production/", {"date": "2026-09-05", "volume_m3": "30"}, format="json")
        r = ca.get("/api/dashboard/community/"); self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["overview"]["total_customers"], 1); self.assertIn("score", r.data)
        self.assertEqual(ca.post("/api/bills/run_dunning/", {}, format="json").status_code, 200)
        self.assertEqual(ca.get("/api/bills/aging/").status_code, 200)
        r = admin.get("/api/dashboard/platform/"); self.assertEqual(r.status_code, 200, r.content); self.assertEqual(r.data["totals"]["communities"], 2)
        self.assertEqual(ca.get("/api/dashboard/platform/").status_code, 403)
        r = ca.post("/api/analytics/intelligence/", {"question": "Which households have abnormal consumption?"}, format="json"); self.assertEqual(r.status_code, 200)
        self.assertGreater(ca.get("/api/audit-logs/").data["count"], 10)
        self.assertGreater(cp.get("/api/notifications/mine/").data["results"].__len__(), 0)
        self.assertEqual(admin.get("/api/health/").status_code, 200)
