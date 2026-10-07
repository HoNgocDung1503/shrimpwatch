from datadog import initialize, statsd
from ddtrace import tracer

from app.config import settings


def init_metrics():
    options = {
        "statsd_host": settings.DD_AGENT_HOST,
        "statsd_port": settings.DD_DOGSTATSD_PORT,
        "namespace": "shrimpwatch",
    }
    initialize(**options)


def gauge(name: str, value: float, tags: dict | None = None):
    tag_list = [f"{k}:{v}" for k, v in (tags or {}).items()]
    tag_list.extend(
        [
            f"farm_id:{settings.FARM_ID}",
            f"env:{settings.DD_ENV}",
            f"service:{settings.DD_SERVICE}",
        ]
    )
    try:
        statsd.gauge(name, value, tags=tag_list)
    except Exception:
        pass


def increment(name: str, value: int = 1, tags: dict | None = None):
    tag_list = [f"{k}:{v}" for k, v in (tags or {}).items()]
    tag_list.extend(
        [
            f"farm_id:{settings.FARM_ID}",
            f"env:{settings.DD_ENV}",
            f"service:{settings.DD_SERVICE}",
        ]
    )
    try:
        statsd.increment(name, value=value, tags=tag_list)
    except Exception:
        pass


def set_span_tags(pond_id: str | None = None, device_type: str | None = None, **extra):
    span = tracer.current_span()
    if span is None:
        return
    if pond_id:
        span.set_tag("pond", pond_id)
    if device_type:
        span.set_tag("device_type", device_type)
    span.set_tag("farm_id", settings.FARM_ID)
    for k, v in extra.items():
        span.set_tag(k, v)
