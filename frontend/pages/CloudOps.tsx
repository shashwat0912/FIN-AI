import { useState } from 'react';
import { apiClient } from '../lib/api';
import { Button, Field, FolioHeader, InlineNotice } from '../components/ui/PrivateLedger';

type Operation = 'investigate' | 'deployment-review' | 'cost-analysis';
interface Assessment {
  investigation_id: string;
  incident: string;
  data_mode: 'simulation' | 'live';
  status: string;
  likely_root_cause: string;
  confidence: number;
  reasoning: string;
  tools_used: string[];
  recommended_actions: string[];
  evidence: Array<{ tool: string; data: Record<string, unknown>; error: { code: string; message: string } | null; correlation_id: string; trace_id: string; source?: string; resource?: string; observed_at?: string | null; freshness?: string; status?: string; trust?: string }>;
  actions: Array<{ id: string; action: string; status: string; payload_hash: string; namespace: string; deployment: string; replicas: number | null; expires_at: number }>;
  summary: {
    recommendation?: string;
    deployment?: string;
    pre_p95_ms?: number | null;
    post_p95_ms?: number | null;
    pre_p99_ms?: number | null;
    post_p99_ms?: number | null;
    pre_5xx_rate?: number | null;
    post_5xx_rate?: number | null;
    readiness_failures?: number | null;
    pod_restarts?: number | null;
    deployment_at?: string | null;
    baseline_window?: { start: string; end: string; sample_count: number } | null;
    observation_window?: { start: string; end: string; sample_count: number } | null;
    evidence_issues?: string[];
    pre_error_rate?: number | null;
    post_error_rate?: number | null;
    migration_status?: string;
    estimated_monthly_usd?: number | null;
    estimated_savings_usd?: number | null;
    period?: string;
    scope?: string;
    note?: string;
    largest_drivers?: Array<{ service: string; monthly_usd: number; previous_usd: number }>;
  };
}

const scenarios = [
  ['database_saturation', 'Database connection saturation'], ['crash_loop', 'CrashLoopBackOff'],
  ['oom', 'OOMKilled backend'], ['postgres_unavailable', 'PostgreSQL unavailable'],
  ['valkey_unavailable', 'Valkey unavailable'], ['bad_environment', 'Invalid environment variable'],
  ['migration_failed', 'Failed Prisma migration'], ['alb_unhealthy', 'Unhealthy ALB target'],
  ['high_latency', 'High backend latency'], ['bad_deployment', 'Bad deployment'],
  ['workflow_failure', 'GitHub Actions failure'], ['configuration_expired', 'Missing or expired configuration'],
  ['contradictory_telemetry', 'Contradictory telemetry'], ['stale_cloudwatch', 'Stale CloudWatch metrics'],
  ['missing_events', 'Missing Kubernetes events'], ['tool_timeout', 'Tool timeout'],
  ['malformed_tool', 'Malformed telemetry'], ['simultaneous_faults', 'Two simultaneous faults'],
  ['misleading_logs', 'Misleading logs'], ['prompt_injection', 'Prompt injection in logs'],
  ['unknown_cause', 'Unknown root cause'], ['incorrect_hypothesis', 'Incorrect initial hypothesis'],
  ['partial_aws_outage', 'Partial AWS outage'], ['healthy', 'Healthy infrastructure'],
];
const inputClass = 'min-h-11 w-full rounded-control border border-border-strong bg-surface-strong px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const display = (value: number | null | undefined, suffix = '') => value == null ? 'Unavailable' : `${value}${suffix}`;

function Result({ result }: { result: Assessment }) {
  return (
    <div className="mt-5 space-y-4" aria-live="polite">
      <p className="text-sm font-semibold text-accent">{result.data_mode === 'simulation' ? 'Simulated infrastructure data — no live AWS telemetry' : 'Live infrastructure data'}</p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-ink-secondary">Status</dt><dd className="font-semibold text-ink">{result.status.replace(/_/g, ' ')}</dd></div>
        <div><dt className="text-ink-secondary">Confidence</dt><dd className="text-ink">{Math.round(result.confidence * 100)}% (workflow estimate)</dd></div>
      </dl>
      <p className="text-sm text-ink-secondary">Assessment: {result.incident}</p>
      <p className="text-base font-semibold text-ink">{result.likely_root_cause}</p>
      <p className="max-w-[70ch] text-sm leading-6 text-ink-secondary">{result.reasoning}</p>
      {result.summary.recommendation && (
        <div className="space-y-2 text-sm text-ink">
          <p className="font-semibold">Recommendation: {result.summary.recommendation}</p>
          <p className="break-all">Deployment: {result.summary.deployment}</p>
          {result.summary.deployment_at && <p>Deployment time: {result.summary.deployment_at}</p>}
          {result.summary.baseline_window && <p>Baseline: {result.summary.baseline_window.start} – {result.summary.baseline_window.end} ({result.summary.baseline_window.sample_count} minute buckets)</p>}
          {result.summary.observation_window && <p>Observation: {result.summary.observation_window.start} – {result.summary.observation_window.end} ({result.summary.observation_window.sample_count} minute buckets)</p>}
          <p>P95 before / after: {display(result.summary.pre_p95_ms, ' ms')} / {display(result.summary.post_p95_ms, ' ms')}</p>
          <p>Error rate before / after: {display(result.summary.pre_error_rate)} / {display(result.summary.post_error_rate)}</p>
          <p>P99 before / after: {display(result.summary.pre_p99_ms, ' ms')} / {display(result.summary.post_p99_ms, ' ms')}</p>
          <p>5xx rate before / after: {display(result.summary.pre_5xx_rate)} / {display(result.summary.post_5xx_rate)}</p>
          <p>Readiness failures / pod restarts in observation window: {display(result.summary.readiness_failures)} / {display(result.summary.pod_restarts)}</p>
          <p>Migration: {result.summary.migration_status}</p>
          {result.summary.evidence_issues && result.summary.evidence_issues.length > 0 && <p>Evidence gaps: {result.summary.evidence_issues.join(', ')}</p>}
        </div>
      )}
      {'estimated_monthly_usd' in result.summary && (
        <div className="space-y-3 text-sm text-ink">
          <p className="font-semibold">Estimated monthly cost: {display(result.summary.estimated_monthly_usd, ' USD')}</p>
          <p>{result.summary.period}. Scope: {result.summary.scope}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Largest cost drivers in USD</caption>
              <thead><tr className="border-b border-ledger-border"><th scope="col" className="py-2">Service</th><th scope="col" className="py-2 text-right">Current USD</th><th scope="col" className="py-2 text-right">Previous USD</th></tr></thead>
              <tbody>{result.summary.largest_drivers?.map(item => <tr key={item.service} className="border-b border-ledger-border"><th scope="row" className="py-3 font-normal">{item.service}</th><td className="text-right tabular-nums">{item.monthly_usd.toFixed(2)}</td><td className="text-right tabular-nums">{item.previous_usd.toFixed(2)}</td></tr>)}</tbody>
            </table>
          </div>
          <p>{result.summary.note}</p>
          <p>Estimated savings: {display(result.summary.estimated_savings_usd, ' USD/month')}. Requires utilization and pricing evidence.</p>
        </div>
      )}
      <div><h3 className="font-semibold text-ink">Recommended actions</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-ink-secondary">{result.recommended_actions.map((action, i) => <li key={i}>{action}</li>)}</ul></div>
      {result.actions.map(action => <p key={action.id} className="break-words text-sm text-warning">Human approval required: {action.action} ({action.status}). Target: {action.namespace}/{action.deployment}{action.replicas != null ? `, replicas: ${action.replicas}` : ''}. Expires: {new Date(action.expires_at * 1000).toLocaleString()}. Action ID: {action.id}. Payload hash: {action.payload_hash}. Approval uses the separate operator API.</p>)}
      <details className="border-y border-ledger-border py-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink">Evidence and tools ({result.tools_used.length})</summary>
        <p className="break-all text-xs text-ink-secondary">Investigation: {result.investigation_id}</p>
        {result.evidence.map((entry, i) => <div key={`${entry.tool}-${i}`} className="border-t border-ledger-border py-3"><h4 className="break-all text-sm font-medium text-ink">{i}. {entry.tool}</h4><p className="mt-2 break-all text-xs text-ink-secondary">Untrusted evidence / Source: {entry.source || 'unknown'} / Resource: {entry.resource || 'unknown'} / Observed: {entry.observed_at || 'unknown'} / Freshness: {entry.freshness || 'unknown'} / Status: {entry.status || 'unknown'}</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-ink-secondary">{JSON.stringify(entry.error || entry.data, null, 2)}</pre><p className="mt-2 break-all text-xs text-ink-secondary">Correlation: {entry.correlation_id} / Trace: {entry.trace_id}</p></div>)}
      </details>
    </div>
  );
}

export default function CloudOps() {
  const [incident, setIncident] = useState('Why is the backend unhealthy?');
  const [scenario, setScenario] = useState('database_saturation');
  const [sha, setSha] = useState('a'.repeat(40));
  const [imageDigest, setImageDigest] = useState('');
  const [pending, setPending] = useState<Operation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Partial<Record<Operation, Assessment>>>({});

  async function run(operation: Operation) {
    setPending(operation);
    setError(null);
    try {
      const response = await apiClient.post<Assessment>(`/cloud-ops/${operation}`, { scenario, ...(operation === 'investigate' ? { incident } : operation === 'deployment-review' ? { sha, image_digest: imageDigest } : {}) });
      if (!response.data) throw new Error('The agent returned no assessment.');
      setResults(current => ({ ...current, [operation]: response.data }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Cloud Ops request failed.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <FolioHeader title="Cloud Ops" description="Operator assessments for the FIN-AI workload. Administrator access and the optional agent service are required. Each result identifies simulation or live data." />
      <Field label="Demo scenario (used only in simulation mode)" htmlFor="ops-scenario">
        <select id="ops-scenario" className={inputClass} value={scenario} disabled={pending !== null} onChange={event => { setScenario(event.target.value); setResults({}); }}>{scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </Field>
      {error && <InlineNotice>{error}</InlineNotice>}
      <section className="border-b border-ledger-border pb-6" aria-labelledby="incident-heading">
        <h2 id="incident-heading" className="mb-4 text-xl font-semibold text-ink">Incident investigator</h2>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run('investigate'); }}>
          <Field label="Incident or question" htmlFor="ops-incident"><textarea id="ops-incident" className={inputClass} rows={2} required minLength={3} maxLength={1000} value={incident} onChange={event => setIncident(event.target.value)} /></Field>
          <Button type="submit" disabled={pending !== null}>{pending === 'investigate' ? 'Collecting evidence…' : 'Investigate incident'}</Button>
        </form>
        {results.investigate && <Result result={results.investigate} />}
      </section>
      <section className="border-b border-ledger-border pb-6" aria-labelledby="deployment-heading">
        <h2 id="deployment-heading" className="mb-4 text-xl font-semibold text-ink">Deployment review</h2>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run('deployment-review'); }}>
          <Field label="Deployment commit SHA (the demo uses 40 a characters)" htmlFor="ops-sha"><input id="ops-sha" className={inputClass} required pattern="[a-f0-9]{40}" maxLength={40} value={sha} onChange={event => setSha(event.target.value)} /></Field>
          <Field label="Image digest from CI (optional for SHA-tagged images)" htmlFor="ops-digest"><input id="ops-digest" className={inputClass} pattern="sha256:[a-f0-9]{64}" value={imageDigest} onChange={event => setImageDigest(event.target.value)} /></Field>
          <Button type="submit" variant="secondary" disabled={pending !== null}>{pending === 'deployment-review' ? 'Reviewing deployment…' : 'Review deployment'}</Button>
        </form>
        {results['deployment-review'] && <Result result={results['deployment-review']} />}
      </section>
      <section aria-labelledby="finops-heading">
        <h2 id="finops-heading" className="text-xl font-semibold text-ink">FinOps</h2>
        <p className="mb-4 mt-2 max-w-[70ch] text-sm leading-6 text-ink-secondary">Compare service costs and review potential savings. No resources are changed or deleted.</p>
        <Button variant="secondary" disabled={pending !== null} onClick={() => void run('cost-analysis')}>{pending === 'cost-analysis' ? 'Analysing costs…' : 'Analyse costs'}</Button>
        {results['cost-analysis'] && <Result result={results['cost-analysis']} />}
      </section>
      {pending && <p role="status" className="text-sm text-ink-secondary">The bounded investigation is running. Results will appear below its form.</p>}
    </div>
  );
}
