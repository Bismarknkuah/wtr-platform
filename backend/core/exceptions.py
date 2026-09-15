from rest_framework.views import exception_handler as drf_handler
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError


def exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "message_dict") else exc.messages
        return Response({"detail": detail}, status=400)
    if isinstance(exc, IntegrityError):
        return Response({"detail": "This record conflicts with an existing one (duplicate or referenced value)."}, status=409)
    return drf_handler(exc, context)
