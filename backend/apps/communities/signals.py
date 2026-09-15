from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Community, CommunitySettings


@receiver(post_save, sender=Community)
def ensure_settings(sender, instance, created, **kwargs):
    if created:
        CommunitySettings.objects.get_or_create(community=instance, defaults={"reminder_days": [7, 14, 21]})
