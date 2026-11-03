import json
import re
from typing import Any

# Only known diagnostic signatures enter model context; raw application logs never do.
SIGNALS = {
    "crash_loop": r"CrashLoopBackOff",
    "oom": r"OOMKilled",
    "postgres_unavailable": r"ECONNREFUSED.*5432|database system is shutting down",
    "database_saturation": r"too many clients|connection pool.*timed out|remaining connection slots",
    "valkey_unavailable": r"ECONNREFUSED.*6379|Redis connection.*closed",
    "bad_environment": r"Invalid environment variable|Invalid value for PORT",
    "migration_failed": r"P3009|P3018|prisma migrate.*failed",
    "alb_unhealthy": r"Target.ResponseCodeMismatch|Health checks failed",
    "high_latency": r"request duration exceeded|slow query",
    "bad_deployment": r"ProgressDeadlineExceeded|image version mismatch",
    "workflow_failure": r"Process completed with exit code 1",
    "configuration_expired": r"ExpiredToken|CreateContainerConfigError|secret .* not found",
}
SECRET_KEY = re.compile(
    r"secret|password|credential|token|authorization|cookie|environment|env$", re.I
)
SECRET_TEXT = re.compile(
    r"(?:AKIA|ASIA)[A-Z0-9]{16}|(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]+|"
    r"(?:postgres(?:ql)?|redis)://\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|"
    r"(?i:(?:password|secret|token|api[_-]?key)\s*[=:]\s*[^\s,;]+)"
)


def signals(text: str) -> list[str]:
    return [name for name, pattern in SIGNALS.items() if re.search(pattern, text, re.I)]


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(k): "[REDACTED]" if SECRET_KEY.search(str(k)) else redact(v)
            for k, v in value.items()
        }
    if isinstance(value, list):
        return [redact(v) for v in value[:100]]
    if isinstance(value, str):
        return SECRET_TEXT.sub("[REDACTED]", value)[:1000]
    return value


def bounded(value: dict) -> dict:
    clean = redact(value)
    if len(json.dumps(clean, default=str)) > 16000:
        raise ValueError("Tool result exceeded safe payload size")
    return clean
