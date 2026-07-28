import React, { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { apiClient, type AiHistoryItem } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { logger } from "../utils/logger";
import {
  Button,
  EmptyState,
  FolioHeader,
  InlineNotice,
} from "../components/ui/PrivateLedger";
import { ledgerControlClass } from "../styles/tokens";
import type { AiAdvice } from "../types";

const QUICK_QUESTIONS = [
  "Summarize this month",
  "Why is food spending high?",
  "How can I reduce spending?",
];

const formatSessionDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function AiAdvisor() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [advice, setAdvice] = useState<AiAdvice | null>(null);
  const [sessions, setSessions] = useState<AiHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAiHistory = async () => {
      try {
        setError(null);
        const history = await apiClient.getAiHistory();
        setSessions(history || []);
      } catch (requestError: unknown) {
        logger.error(
          "Error loading AI history",
          requestError instanceof Error ? requestError : undefined,
        );
        setError(t("failed-load-ai-history"));
        setSessions([]);
      }
    };

    loadAiHistory();
  }, [t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || loading) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAiAdvice(trimmedQuery);
      setAdvice(response);
      setSessions((current) => [
        {
          id: Date.now().toString(),
          query: trimmedQuery,
          response: response.advice,
          category: response.category,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      setQuery("");
    } catch (requestError: unknown) {
      logger.error(
        "Error getting AI advice",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(getErrorMessage(requestError, t("failed-get-ai-advice")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8" aria-busy={loading}>
      <FolioHeader
        title="AI Advisor"
        description="Ask focused questions about your spending, budgets, and recorded financial activity."
      />

      <section aria-labelledby="advisor-workspace-heading">
        <div className="flex flex-col gap-3 border-b border-ledger-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Advisor workspace</p>
            <h2
              id="advisor-workspace-heading"
              className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink"
            >
              What would you like to understand?
            </h2>
          </div>
          <p className="text-xs text-ink-muted">
            Uses your FinanceAI activity · {sessions.length.toLocaleString()}{" "}
            previous {sessions.length === 1 ? "conversation" : "conversations"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-b border-ledger-border py-5"
        >
          <label htmlFor="advisor-question" className="sr-only">
            {t("ask-financial-question")}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input
              id="advisor-question"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask about this month, a budget, or your next financial step"
              className={`${ledgerControlClass} flex-1`}
              disabled={loading}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              className="w-full sm:w-auto"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {loading ? "Preparing advice…" : "Ask FinanceAI"}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs text-ink-muted">Suggested</span>
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setQuery(question)}
                disabled={loading}
                className="min-h-11 rounded-control px-2 text-left text-sm font-medium text-ink-secondary transition-colors duration-150 ease-out hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
              >
                {question}
              </button>
            ))}
          </div>
        </form>
      </section>

      {error && <InlineNotice>{error}</InlineNotice>}

      {advice && (
        <section
          className="border-b border-ledger-border pb-8"
          aria-labelledby="current-advice-heading"
        >
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(14rem,3fr)] lg:gap-10">
            <div>
              <p className="text-sm font-medium capitalize text-accent">
                {advice.category} recommendation
              </p>
              <h2
                id="current-advice-heading"
                className="mt-2 text-xl font-semibold tracking-[-0.02em] text-ink"
              >
                Current recommendation
              </h2>
              <p className="mt-3 max-w-[72ch] whitespace-pre-wrap text-sm leading-7 text-ink-secondary">
                {advice.advice}
              </p>
            </div>
            <aside className="border-t border-ledger-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                Advisor note
              </p>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                Treat this as guidance. Review the recorded amounts and your own
                priorities before acting.
              </p>
            </aside>
          </div>
        </section>
      )}

      <section aria-labelledby="advisor-history-heading">
        <div className="flex items-baseline justify-between gap-4 border-b border-ledger-border pb-4">
          <div>
            <h2
              id="advisor-history-heading"
              className="text-xl font-semibold tracking-[-0.02em] text-ink"
            >
              {t("recent-conversations")}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Questions and guidance from this account.
            </p>
          </div>
          {sessions.length > 0 && (
            <p className="shrink-0 text-sm tabular-nums text-ink-secondary">
              {sessions.length.toLocaleString()} shown
            </p>
          )}
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            title={t("no-conversations-yet")}
            description="Ask about recent spending, a budget, or the next step toward a goal."
          />
        ) : (
          <div>
            {sessions.map((session) => (
              <article
                key={session.id}
                className="border-b border-ledger-border py-6"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink-muted">
                      You asked
                    </p>
                    <h3 className="mt-1 text-base font-semibold leading-6 text-ink">
                      {session.query}
                    </h3>
                  </div>
                  <time
                    dateTime={session.createdAt}
                    className="shrink-0 text-xs tabular-nums text-ink-muted"
                  >
                    {formatSessionDate(session.createdAt)}
                  </time>
                </div>

                <div className="mt-4 border-l border-accent pl-4 sm:ml-4 sm:pl-5">
                  <div className="flex items-center gap-2">
                    <MessageCircle
                      className="h-4 w-4 text-accent"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium capitalize text-accent">
                      FinanceAI · {session.category}
                    </p>
                  </div>
                  <p className="mt-2 max-w-[76ch] whitespace-pre-wrap text-sm leading-7 text-ink-secondary">
                    {session.response}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
