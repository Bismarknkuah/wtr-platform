from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    community = models.ForeignKey("communities.Community", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs")
    actor_label = models.CharField(max_length=200, blank=True)
    action = models.CharField(max_length=40)          # CREATE / UPDATE / DELETE / LOGIN / APPROVE / PAYMENT / ...
    model_name = models.CharField(max_length=80)
    object_id = models.CharField(max_length=80, blank=True)
    object_label = models.CharField(max_length=200, blank=True)
    changes = models.JSONField(default=dict, blank=True)  # {"field": {"from": .., "to": ..}}
    reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.model_name} {self.object_id}"
