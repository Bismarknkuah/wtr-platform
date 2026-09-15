from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantModel(TimeStampedModel):
    """Every tenant-scoped record carries its community. Isolation is enforced in core.tenancy."""
    community = models.ForeignKey("communities.Community", on_delete=models.CASCADE, related_name="%(class)ss")

    class Meta:
        abstract = True

from core.sequences import Sequence  # noqa: E402,F401  (registers the model with the app)
