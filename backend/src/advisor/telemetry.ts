import { metrics, trace, SpanStatusCode } from '@opentelemetry/api';
import type { NodeSDK } from '@opentelemetry/sdk-node';
import { createRequire } from 'node:module';

let sdk: NodeSDK | undefined;
export function startAdvisorTelemetry(): void {
  const mode = process.env.ADVISOR_TELEMETRY || 'none';
  if (mode === 'none' || sdk) return;
  if (!['console', 'otlp'].includes(mode)) throw new Error('Invalid ADVISOR_TELEMETRY');
  // Disabled telemetry must not load exporters or slow application imports.
  const load = createRequire(__filename);
  const { NodeSDK } = load('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node');
  const { ConsoleSpanExporter } = load(
    '@opentelemetry/sdk-trace'
  ) as typeof import('@opentelemetry/sdk-trace');
  const { ConsoleMetricExporter, PeriodicExportingMetricReader } = load(
    '@opentelemetry/sdk-metrics'
  ) as typeof import('@opentelemetry/sdk-metrics');
  sdk = new NodeSDK(
    mode === 'console'
      ? {
          traceExporter: new ConsoleSpanExporter(),
          metricReaders: [
            new PeriodicExportingMetricReader({
              exporter: new ConsoleMetricExporter(),
              exportIntervalMillis: 10000,
            }),
          ],
          instrumentations: [],
          autoDetectResources: false,
        }
      : { instrumentations: [], autoDetectResources: false }
  );
  sdk.start();
}
export async function stopAdvisorTelemetry(): Promise<void> {
  await sdk?.shutdown();
}
const meter = () => metrics.getMeter('finance-advisor');
export function count(
  name:
    | 'advisor_requests_total'
    | 'advisor_tool_calls'
    | 'advisor_tool_failures'
    | 'advisor_tokens'
    | 'advisor_estimated_cost'
    | 'advisor_abstentions'
    | 'advisor_simulations',
  value = 1,
  attributes: Record<string, string | boolean> = {}
): void {
  meter().createCounter(name).add(value, attributes);
}
export async function timed<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const started = performance.now();
  // Manual spans avoid automatic prompt, SQL, HTTP, exception-message and financial payload capture.
  return trace.getTracer('finance-advisor').startActiveSpan(name, async span => {
    try {
      const result = await operation();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
      if (name === 'finance_advisor')
        meter()
          .createHistogram('advisor_request_duration', { unit: 's' })
          .record((performance.now() - started) / 1000);
    }
  });
}
