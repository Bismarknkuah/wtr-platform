from core.middleware import get_current_request


def _client_ip(request):
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


def log_action(action: str, obj=None, changes=None, reason: str = "", model_name: str = None, community=None, actor=None):
    """Append-only audit record. Never raises — an audit failure must not break the business action."""
    from apps.audit.models import AuditLog
    try:
        request = get_current_request()
        actor = actor or (request.user if request and getattr(request, "user", None) and request.user.is_authenticated else None)
        if community is None and obj is not None:
            community = getattr(obj, "community", None)
            if community is None and obj.__class__.__name__ == "Community":
                community = obj
        AuditLog.objects.create(
            community=community,
            actor=actor,
            actor_label=(actor.get_full_name() or actor.email) if actor else "system",
            action=action,
            model_name=model_name or (obj.__class__.__name__ if obj is not None else ""),
            object_id=str(getattr(obj, "pk", "") or ""),
            object_label=str(obj)[:200] if obj is not None else "",
            changes=changes or {},
            reason=reason or "",
            ip_address=_client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT", "")[:300] if request else ""),
        )
    except Exception:  # pragma: no cover
        import logging
        logging.getLogger(__name__).exception("audit log failed")
