from django.apps import AppConfig
class CommunitiesConfig(AppConfig):
    name = "apps.communities"
    default_auto_field = "django.db.models.BigAutoField"
    def ready(self):
        from . import signals  # noqa
