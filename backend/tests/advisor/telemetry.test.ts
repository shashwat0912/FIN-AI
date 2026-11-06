import { afterAll, expect, it } from 'vitest';
import { metrics, trace } from '@opentelemetry/api';
import {
  TracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  InMemoryMetricExporter,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics';
import { advise } from '../../src/advisor/service';
import { MockAdvisorProvider } from '../../src/advisor/provider';
import { fixtureData } from '../../src/advisor/evals';
import type { FinanceTools } from '../../src/advisor/types';
const spans = new InMemorySpanExporter();
const traces = new TracerProvider({
  spanProcessors: [new SimpleSpanProcessor({ exporter: spans })],
});
trace.setGlobalTracerProvider(traces);
const exportedMetrics = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const meters = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({ exporter: exportedMetrics, exportIntervalMillis: 60000 }),
  ],
});
metrics.setGlobalMeterProvider(meters);
afterAll(async () => {
  await traces.shutdown();
  await meters.shutdown();
  trace.disable();
  metrics.disable();
});
it('exports only bounded metadata, including on provider and tool exceptions', async () => {
  const secret = 'PRIVATE_FINANCIAL_PROMPT_AND_DB_URL';
  const privateMarkers = [
    'person@example.com',
    ['eyJ' + 'a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)].join('.'),
  ];
  const data = fixtureData();
  const tools: FinanceTools = {
    call: async () => {
      throw new Error(`${secret} postgres://user:private@database/db`);
    },
  };
  await advise(
    { question: `Review my finances ${secret} ${privateMarkers.join(' ')}` },
    tools,
    new MockAdvisorProvider()
  );
  await advise(
    { question: `How are my finances? ${secret}` },
    { call: async () => data.get_financial_summary as never },
    {
      name: 'openai',
      plan: async () => {
        throw new Error(secret);
      },
      select: async () => {
        throw new Error(secret);
      },
    }
  );
  await traces.forceFlush();
  await meters.forceFlush();
  const spansJson = JSON.stringify(
    spans
      .getFinishedSpans()
      .map(s => ({ name: s.name, attributes: s.attributes, events: s.events, status: s.status }))
  );
  const metricsJson = JSON.stringify(exportedMetrics.getMetrics());
  expect(spansJson + metricsJson).not.toContain(secret);
  for (const marker of privateMarkers) expect(spansJson + metricsJson).not.toContain(marker);
  expect(spansJson + metricsJson).not.toContain('postgres://');
  expect(spansJson + metricsJson).not.toContain('totalIncome');
  expect(spans.getFinishedSpans().some(s => s.name === 'finance_advisor')).toBe(true);
  expect(metricsJson).toContain('advisor_requests_total');
  expect(metricsJson).toContain('advisor_tool_failures');
});
