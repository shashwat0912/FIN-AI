from opentelemetry import metrics, trace
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    MetricExporter,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SpanExporter

from app.config import Settings

tracer = trace.get_tracer("finance-ai.agent")
meter = metrics.get_meter("finance-ai.agent")
requests = meter.create_counter("agent_requests_total")
request_duration = meter.create_histogram("agent_request_duration", unit="s")
tool_calls = meter.create_counter("tool_calls_total")
tool_duration = meter.create_histogram("tool_call_duration", unit="s")
tool_failures = meter.create_counter("tool_failures_total")
tokens = meter.create_counter("agent_tokens_used")
llm_cost = meter.create_counter("estimated_llm_cost", unit="USD")
steps = meter.create_histogram("investigation_steps")
approval_requests = meter.create_counter("human_approval_requests")
approval_accepts = meter.create_counter("human_approval_accepts")


def configure(settings: Settings):
    if settings.telemetry_exporter == "none":
        return None
    span_exporter: SpanExporter
    metric_exporter: MetricExporter
    resource = Resource.create(
        {"service.name": "finance-ai-agent", "data.mode": settings.data_mode}
    )
    provider = TracerProvider(resource=resource)
    if settings.telemetry_exporter == "otlp":
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        span_exporter = OTLPSpanExporter(endpoint=settings.otlp_endpoint + "/v1/traces")
        metric_exporter = OTLPMetricExporter(endpoint=settings.otlp_endpoint + "/v1/metrics")
    else:
        span_exporter = ConsoleSpanExporter()
        metric_exporter = ConsoleMetricExporter()
    provider.add_span_processor(BatchSpanProcessor(span_exporter))
    metric_provider = MeterProvider(
        resource=resource,
        metric_readers=[PeriodicExportingMetricReader(metric_exporter)],
    )
    trace.set_tracer_provider(provider)
    metrics.set_meter_provider(metric_provider)
    return provider, metric_provider
