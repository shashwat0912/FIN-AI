import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { apiClient } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { logger } from "../utils/logger";
import {
  Amount,
  Button,
  EmptyState,
  Field,
  FolioHeader,
  InlineNotice,
  SkeletonRow,
} from "../components/ui/PrivateLedger";
import { ProgressLine, RowActionMenu } from "../components/ui/FinanceLedger";
import { ledgerControlClass } from "../styles/tokens";
import { onTransactionsUpdated } from "../lib/appEvents";

interface BudgetItem {
  id: string;
  name: string;
  categoryKey: string | null;
  amount: number;
  spent: number;
  remaining: number;
  utilizationPercentage: number;
  status: "ON_TRACK" | "NEAR_LIMIT" | "OVER_BUDGET" | "INACTIVE";
  period: "MONTHLY" | "YEARLY" | "WEEKLY";
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const getPercentage = (spent: number, amount: number) =>
  amount > 0 ? (spent / amount) * 100 : 0;

const getBudgetTone = (percentage: number) => {
  if (percentage >= 100) return "negative";
  if (percentage >= 80) return "warning";
  return "accent";
};

export default function Budget() {
  const { t } = useLanguage();
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetForm, setBudgetForm] = useState({
    name: "",
    amount: "",
    period: "MONTHLY" as BudgetItem["period"],
    isActive: true,
  });

  const loadBudgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getBudgets();
      setBudgets(response.data as BudgetItem[]);
    } catch (requestError: unknown) {
      logger.error(
        "Error loading budgets",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load budgets",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
    return onTransactionsUpdated(loadBudgets);
  }, []);

  const resetEditor = () => {
    setBudgetForm({
      name: "",
      amount: "",
      period: "MONTHLY",
      isActive: true,
    });
    setEditingBudget(null);
    setShowAddForm(false);
  };

  const openNewBudget = () => {
    setEditingBudget(null);
    setBudgetForm({
      name: "",
      amount: "",
      period: "MONTHLY",
      isActive: true,
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError(null);
      const budgetData = {
        name: budgetForm.name,
        amount: Number.parseFloat(budgetForm.amount),
        period: budgetForm.period,
        isActive: budgetForm.isActive,
      };

      if (editingBudget) {
        const updated = (await apiClient.updateBudget(
          editingBudget.id,
          budgetData,
        )) as BudgetItem;
        setBudgets((current) =>
          current.map((budget) =>
            budget.id === updated.id ? updated : budget,
          ),
        );
      } else {
        const created = (await apiClient.createBudget(
          budgetData,
        )) as BudgetItem;
        setBudgets((current) => [created, ...current]);
      }

      resetEditor();
    } catch (requestError: unknown) {
      logger.error(
        "Error saving budget",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save budget",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (budget: BudgetItem) => {
    setEditingBudget(budget);
    setBudgetForm({
      name: budget.name,
      amount: budget.amount.toString(),
      period: budget.period,
      isActive: budget.isActive,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (budget: BudgetItem) => {
    if (!window.confirm(t("confirm-delete-budget"))) return;
    try {
      setError(null);
      await apiClient.deleteBudget(budget.id);
      setBudgets((current) => current.filter((item) => item.id !== budget.id));
    } catch (requestError: unknown) {
      logger.error(
        "Error deleting budget",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete budget",
      );
    }
  };

  const totals = useMemo(
    () =>
      budgets.reduce(
        (summary, budget) => ({
          budget: summary.budget + Number(budget.amount),
          spent: summary.spent + Number(budget.spent),
        }),
        { budget: 0, spent: 0 },
      ),
    [budgets],
  );
  const remaining = totals.budget - totals.spent;
  const utilisation = getPercentage(totals.spent, totals.budget);
  const periods = Array.from(
    new Set(budgets.map((budget) => t(budget.period.toLowerCase()))),
  );
  const context =
    budgets.length > 0
      ? `${budgets.length.toLocaleString()} ${budgets.length === 1 ? "budget" : "budgets"}, ${periods.join(", ")}`
      : t("monitor-spending");

  return (
    <div className="space-y-8" aria-busy={loading}>
      <FolioHeader
        title={t("budget")}
        description={context}
        action={
          <Button onClick={openNewBudget} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("add-budget")}
          </Button>
        }
      />

      {showAddForm && (
        <section
          aria-labelledby="budget-editor-heading"
          className="border-y border-ledger-border bg-ledger-surface py-5 sm:px-5 sm:py-6"
        >
          <div className="px-4 sm:px-0">
            <h2
              id="budget-editor-heading"
              className="text-lg font-semibold text-ink"
            >
              {editingBudget ? t("edit-budget") : t("add-new-budget")}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Set a category limit. Spending is calculated from transactions.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 px-4 sm:px-0">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <Field label={t("budget-name")} htmlFor="budget-name">
                <input
                  id="budget-name"
                  type="text"
                  required
                  value={budgetForm.name}
                  onChange={(event) =>
                    setBudgetForm({ ...budgetForm, name: event.target.value })
                  }
                  className={ledgerControlClass}
                  placeholder={t("budget-name-placeholder")}
                />
              </Field>
              <Field label={t("period")} htmlFor="budget-period">
                <select
                  id="budget-period"
                  value={budgetForm.period}
                  onChange={(event) =>
                    setBudgetForm({
                      ...budgetForm,
                      period: event.target.value as BudgetItem["period"],
                    })
                  }
                  className={ledgerControlClass}
                >
                  <option value="WEEKLY">{t("weekly")}</option>
                  <option value="MONTHLY">{t("monthly")}</option>
                  <option value="YEARLY">{t("yearly")}</option>
                </select>
              </Field>
              <Field
                label={t("budget-amount")}
                htmlFor="budget-amount"
                helper="Rupees and paise."
              >
                <input
                  id="budget-amount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={budgetForm.amount}
                  onChange={(event) =>
                    setBudgetForm({ ...budgetForm, amount: event.target.value })
                  }
                  aria-describedby="budget-amount-message"
                  className={ledgerControlClass}
                />
              </Field>
            </div>
            <label
              htmlFor="budget-active"
              className="mt-5 flex min-h-11 items-center gap-3 text-sm font-medium text-ink"
            >
              <input
                id="budget-active"
                type="checkbox"
                checked={budgetForm.isActive}
                onChange={(event) =>
                  setBudgetForm({
                    ...budgetForm,
                    isActive: event.target.checked,
                  })
                }
                className="h-4 w-4 rounded-status border-ledger-border text-accent focus:ring-focus"
              />
              {t("active-budget")}
            </label>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editingBudget
                    ? t("update-budget")
                    : t("create-budget")}
              </Button>
              <Button variant="secondary" onClick={resetEditor}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </section>
      )}

      {error && (
        <InlineNotice
          action={
            <Button variant="secondary" onClick={loadBudgets}>
              Retry
            </Button>
          }
        >
          {error}
        </InlineNotice>
      )}

      {!loading && budgets.length > 0 && (
        <>
          <section
            className="border-b border-ledger-border pb-8"
            aria-labelledby="budget-finding-heading"
          >
            <p className="text-sm text-ink-secondary">
              Available across recorded budgets
            </p>
            <h2
              id="budget-finding-heading"
              className={`mt-1 text-3xl font-semibold tracking-[-0.03em] tabular-nums ${remaining < 0 ? "text-negative" : "text-ink"}`}
            >
              {remaining < 0
                ? `${formatRupees(Math.abs(remaining))} over budget`
                : `${formatRupees(remaining)} remaining`}
            </h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-ink-secondary">
              {formatPercent(utilisation)} of the combined limit has been
              recorded as spent.
            </p>
          </section>

          <dl
            className="grid grid-cols-2 border-y border-ledger-border md:grid-cols-4"
            aria-label="Budget summary"
          >
            <SummaryItem label={t("total-budget")} amount={totals.budget} />
            <SummaryItem
              label={t("total-spent")}
              amount={totals.spent}
              className="border-l border-ledger-border"
            />
            <SummaryItem
              label={t("remaining")}
              amount={remaining}
              className="border-t border-ledger-border md:border-l md:border-t-0"
              negative={remaining < 0}
            />
            <div className="border-l border-t border-ledger-border px-4 py-4 md:border-t-0">
              <dt className="text-xs text-ink-secondary">Utilisation</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                {formatPercent(utilisation)}
              </dd>
            </div>
          </dl>

          <section aria-labelledby="budget-ledger-heading">
            <div className="flex items-baseline justify-between gap-4 py-5">
              <div>
                <h2
                  id="budget-ledger-heading"
                  className="text-xl font-semibold tracking-[-0.02em] text-ink"
                >
                  Budget ledger
                </h2>
                <p className="mt-1 text-sm text-ink-secondary">
                  Limits and recorded spending by category
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums text-ink-secondary">
                {budgets.length.toLocaleString()}{" "}
                {budgets.length === 1 ? "category" : "categories"}
              </p>
            </div>

            <div className="hidden xl:block" role="table" aria-label="Budgets">
              <div
                className="grid grid-cols-[minmax(10rem,1.4fr)_7.5rem_7.5rem_7.5rem_minmax(10rem,0.9fr)_2.75rem] gap-4 border-b border-ledger-border py-3 text-caption font-medium uppercase tracking-[0.08em] text-ink-secondary"
                role="row"
              >
                <span role="columnheader">Category</span>
                <span role="columnheader" className="text-right">
                  Limit
                </span>
                <span role="columnheader" className="text-right">
                  Spent
                </span>
                <span role="columnheader" className="text-right">
                  Remaining
                </span>
                <span role="columnheader">Utilisation</span>
                <span role="columnheader" className="sr-only">
                  Actions
                </span>
              </div>
              <div role="rowgroup">
                {budgets.map((budget) => (
                  <BudgetDesktopRow
                    key={budget.id}
                    budget={budget}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    t={t}
                  />
                ))}
              </div>
            </div>

            <div className="xl:hidden">
              {budgets.map((budget) => (
                <BudgetMobileRow
                  key={budget.id}
                  budget={budget}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  t={t}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {loading && (
        <div role="status" aria-label={t("loading")}>
          <span className="sr-only">{t("loading")}</span>
          <div className="hidden xl:block">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonRow key={index} />
            ))}
          </div>
          <div className="xl:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <MobileSkeleton key={index} />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && budgets.length === 0 && !showAddForm && (
        <EmptyState
          title={t("no-budgets-yet")}
          description={t("create-first-budget")}
          action={
            <Button onClick={openNewBudget}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("add-budget")}
            </Button>
          }
        />
      )}
    </div>
  );
}

const formatRupees = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatPercent = (value: number) =>
  `${Math.round(value).toLocaleString("en-IN")}%`;

function SummaryItem({
  label,
  amount,
  className = "",
  negative = false,
}: {
  label: string;
  amount: number;
  className?: string;
  negative?: boolean;
}) {
  return (
    <div className={`px-4 py-4 ${className}`}>
      <dt className="text-xs text-ink-secondary">{label}</dt>
      <dd className={negative ? "mt-1 text-negative" : "mt-1 text-ink"}>
        <Amount
          amount={amount}
          type="NEUTRAL"
          showSign={false}
          className="text-lg font-semibold"
        />
      </dd>
    </div>
  );
}

function BudgetDesktopRow({ budget, onEdit, onDelete, t }: BudgetRowProps) {
  const percentage = budget.utilizationPercentage;
  const remaining = budget.remaining;
  const status = getBudgetStatus(budget.status, t);

  return (
    <div
      role="row"
      className="group grid min-h-20 grid-cols-[minmax(10rem,1.4fr)_7.5rem_7.5rem_7.5rem_minmax(10rem,0.9fr)_2.75rem] items-center gap-4 border-b border-ledger-border py-3 transition-colors duration-150 hover:bg-ledger-surface focus-within:bg-ledger-surface motion-reduce:transition-none"
    >
      <div role="cell" className="min-w-0">
        <p className="break-words text-sm font-medium text-ink">
          {budget.name}
        </p>
        <p className="mt-1 text-xs capitalize text-ink-secondary">
          {t(budget.period.toLowerCase())}
          {!budget.isActive ? `, ${t("inactive")}` : ""}
        </p>
      </div>
      <Amount
        role="cell"
        amount={budget.amount}
        type="NEUTRAL"
        showSign={false}
        className="block text-right text-ink"
      />
      <Amount
        role="cell"
        amount={budget.spent}
        type="NEUTRAL"
        showSign={false}
        className="block text-right text-ink"
      />
      <Amount
        role="cell"
        amount={remaining}
        type="NEUTRAL"
        showSign={false}
        className={`block text-right ${remaining < 0 ? "text-negative" : "text-ink"}`}
      />
      <div role="cell" className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <span
            className={
              percentage >= 100
                ? "text-negative"
                : percentage >= 80
                  ? "text-warning"
                  : "text-ink-secondary"
            }
          >
            {status}
          </span>
          <span className="tabular-nums text-ink-secondary">
            {formatPercent(percentage)}
          </span>
        </div>
        <ProgressLine
          value={percentage}
          tone={getBudgetTone(percentage)}
          label={`${budget.name} utilisation`}
        />
      </div>
      <RowActionMenu
        label={`Actions for ${budget.name}`}
        onEdit={() => onEdit(budget)}
        onDelete={() => onDelete(budget)}
      />
    </div>
  );
}

function BudgetMobileRow({ budget, onEdit, onDelete, t }: BudgetRowProps) {
  const percentage = budget.utilizationPercentage;
  const remaining = budget.remaining;
  const status = getBudgetStatus(budget.status, t);

  return (
    <article className="group border-b border-ledger-border py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-ink">
            {budget.name}
          </h3>
          <p
            className={`mt-1 text-xs ${percentage >= 100 ? "text-negative" : percentage >= 80 ? "text-warning" : "text-ink-secondary"}`}
          >
            {status}, {t(budget.period.toLowerCase())}
          </p>
        </div>
        <RowActionMenu
          label={`Actions for ${budget.name}`}
          onEdit={() => onEdit(budget)}
          onDelete={() => onDelete(budget)}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="text-xs text-ink-secondary">{t("remaining")}</dt>
          <dd
            className={remaining < 0 ? "mt-1 text-negative" : "mt-1 text-ink"}
          >
            <Amount amount={remaining} type="NEUTRAL" showSign={false} />
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-ink-secondary">{t("total-budget")}</dt>
          <dd className="mt-1 text-ink">
            <Amount amount={budget.amount} type="NEUTRAL" showSign={false} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-secondary">{t("spent")}</dt>
          <dd className="mt-1 text-ink">
            <Amount amount={budget.spent} type="NEUTRAL" showSign={false} />
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-ink-secondary">Utilisation</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-ink">
            {formatPercent(percentage)}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <ProgressLine
          value={percentage}
          tone={getBudgetTone(percentage)}
          label={`${budget.name} utilisation`}
        />
      </div>
    </article>
  );
}

function getBudgetStatus(status: BudgetItem["status"], t: (key: string) => string) {
  if (status === "OVER_BUDGET") return t("over-budget");
  if (status === "NEAR_LIMIT") return "Near limit";
  if (status === "INACTIVE") return t("inactive");
  return t("on-track");
}

interface BudgetRowProps {
  budget: BudgetItem;
  onEdit: (budget: BudgetItem) => void;
  onDelete: (budget: BudgetItem) => void;
  t: (key: string) => string;
}

function MobileSkeleton() {
  return (
    <div
      className="border-b border-ledger-border py-5 animate-pulse motion-reduce:animate-none"
      aria-hidden="true"
    >
      <div className="h-3 w-2/5 rounded-status bg-ledger-border" />
      <div className="mt-3 h-3 w-1/4 rounded-status bg-ledger-border" />
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div className="h-8 rounded-status bg-ledger-border" />
        <div className="h-8 rounded-status bg-ledger-border" />
      </div>
    </div>
  );
}
