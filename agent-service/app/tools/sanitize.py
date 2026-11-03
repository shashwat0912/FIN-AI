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
    r"secret|password|credential|token|authorization|cookie|private.?key|api.?key|^env$|^environment$|connection.?string|database.?url|last.applied.configuration",
    re.I,
)
SECRET_TEXT = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)|"
    r"(?:AKIA|ASIA)[A-Z0-9]{16}|(?:sk-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]+|"
    r"(?:postgres(?:ql)?|rediss?|smtp[s]?|mysql)://[^\s\"<>]+|"
    r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|"
    r"(?i:(?:bearer\s+)[A-Za-z0-9._~+/-]+)|"
    r"(?i:(?:password|secret|token|api[_-]?key|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*[\"']?[^\s,;\"']+)"
)
MAX_PAYLOAD_BYTES = 16000
MAX_STRING_CHARS = 512
MAX_ITEMS = 50
MAX_DEPTH = 8


def signals(text: str) -> list[str]:
    return [name for name, pattern in SIGNALS.items() if re.search(pattern, text[:16000], re.I)]


def sanitize(value: Any) -> tuple[Any, bool]:
    """Bound work and output before schema projection; never treat strings as instructions."""
    remaining = MAX_PAYLOAD_BYTES // 2
    truncated = False

    def visit(item, depth=0):
        nonlocal remaining, truncated
        if depth > MAX_DEPTH or remaining <= 0:
            truncated = True
            return "[TRUNCATED]"
        if isinstance(item, dict):
            if item.get("kind") == "Secret":
                return {"kind": "Secret", "data": "[REDACTED]", "stringData": "[REDACTED]"}
            result = {}
            for index, (key, child) in enumerate(item.items()):
                if index >= MAX_ITEMS or remaining <= 0:
                    truncated = True
                    break
                clean_key = SECRET_TEXT.sub("[REDACTED]", str(key)[:128])
                remaining -= len(clean_key.encode()) + 8
                result[clean_key] = (
                    "[REDACTED]" if SECRET_KEY.search(clean_key) else visit(child, depth + 1)
                )
            return result
        if isinstance(item, list):
            if len(item) > MAX_ITEMS:
                truncated = True
            items = []
            for child in item[:MAX_ITEMS]:
                if remaining <= 0:
                    truncated = True
                    break
                items.append(visit(child, depth + 1))
            return items
        if isinstance(item, str):
            if re.search(r"(?i)\bkind[\"']?\s*[:=]\s*[\"']?Secret\b", item[:16000]):
                return "[KUBERNETES_SECRET_REDACTED]"
            text = SECRET_TEXT.sub("[REDACTED]", item[:4096])
            limit = min(MAX_STRING_CHARS, max(remaining // 4, 0))
            if len(text) > limit or len(item) > 4096:
                truncated = True
            clean = text[:limit]
            remaining -= len(clean.encode()) + 4
            return clean
        if isinstance(item, (int, float, bool)) or item is None:
            remaining -= 32
            return item
        raise ValueError("Non-JSON tool data")

    clean = visit(value)
    if len(json.dumps(clean, allow_nan=False).encode()) > MAX_PAYLOAD_BYTES:
        raise ValueError("Tool result exceeded safe payload size")
    return clean, truncated


def redact(value: Any) -> Any:
    return sanitize(value)[0]


def bounded(value: dict) -> dict:
    clean, truncated = sanitize(value)
    if truncated:
        raise ValueError("Tool result was truncated")
    return clean
