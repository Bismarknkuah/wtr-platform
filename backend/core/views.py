from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        with connection.cursor() as c:
            c.execute("SELECT 1")
        db = "ok"
    except Exception as e:  # pragma: no cover
        db = f"error: {e}"
    return JsonResponse({"status": "ok", "database": db, "service": "wtr-platform-api"})
