from django.db import migrations


def forwards(apps, schema_editor):
    """Platform Finance Admin was retired: its duties (plans, platform health) belong to the Super Admin."""
    User = apps.get_model("accounts", "User")
    User.objects.filter(role="PLATFORM_FINANCE_ADMIN").update(role="PLATFORM_SUPER_ADMIN")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_custom_roles")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
