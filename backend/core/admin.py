from django.apps import apps
from django.contrib import admin
for model in apps.get_models():
    if model._meta.app_label in ("core", "accounts", "communities", "customers", "meters", "tariffs", "billing", "payments", "infrastructure", "tickets", "notifications", "audit", "approvals", "documents", "analytics"):
        try:
            admin.site.register(model)
        except admin.sites.AlreadyRegistered:
            pass
