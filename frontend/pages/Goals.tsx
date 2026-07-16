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

interface GoalItem {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  status: "ACTIVE" | "COMPLETED" | "PAUSED" | "CANCELLED";
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const getProgress = (current: number, target: number) =>
  target > 0 ? (current / target) * 100 : 0;

const getProgressTone = (status: GoalItem["status"]) => {
  if (status === "CANCELLED") return "negative";
  if (status === "PAUSED") return "warning";
  return "accent";
};

const formatPercent = (value: number) =>
  `${Math.round(value).toLocaleString("en-IN")}%`;

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "No target date";

export default function Goals() {
  const { t } = useLanguage();
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);
  const [goalForm, setGoalForm] = useState({
    name: "",
    description: "",
    targetAmount: "",
    currentAmount: "",
    targetDate: "",
    status: "ACTIVE" as GoalItem["status"],
  });

  const loadGoals = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getGoals();
      setGoals(response.data as GoalItem[]);
    } catch (requestError: unknown) {
      logger.error(
        "Error loading goals",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load goals",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const resetEditor = () => {
    setGoalForm({
      name: "",
      description: "",
      targetAmount: "",
      currentAmount: "",
      targetDate: "",
      status: "ACTIVE",
    });
    setEditingGoal(null);
    setShowAddForm(false);
  };

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalForm({
      name: "",
      description: "",
      targetAmount: "",
      currentAmount: "",
      targetDate: "",
      status: "ACTIVE",
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError(null);
      const goalData = {
        name: goalForm.name,
        description: goalForm.description,
        targetAmount: Number.parseFloat(goalForm.targetAmount),
        currentAmount: Number.parseFloat(goalForm.currentAmount),
        targetDate: goalForm.targetDate || undefined,
        status: goalForm.status,
      };

      if (editingGoal) {
        const updated = (await apiClient.updateGoal(
          editingGoal.id,
          goalData,
        )) as GoalItem;
        setGoals((current) =>
          current.map((goal) => (goal.id === updated.id ? updated : goal)),
        );
      } else {
        const created = (await apiClient.createGoal(goalData)) as GoalItem;
        setGoals((current) => [created, ...current]);
      }

      resetEditor();
    } catch (requestError: unknown) {
      logger.error(
        "Error saving goal",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save goal",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (goal: GoalItem) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      description: goal.description || "",
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      targetDate: goal.targetDate?.split("T")[0] || "",
      status: goal.status,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (goal: GoalItem) => {
    if (!window.confirm(t("confirm-delete-goal"))) return;
    try {
      setError(null);
      await apiClient.deleteGoal(goal.id);
      setGoals((current) => current.filter((item) => item.id !== goal.id));
    } catch (requestError: unknown) {
      logger.error(
        "Error deleting goal",
        requestError instanceof Error ? requestError : undefined,
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete goal",
      );
    }
  };

  const focusGoal = useMemo(() => {
    const activeGoals = goals.filter((goal) => goal.status === "ACTIVE");
    return activeGoals.sort((left, right) => {
      if (!left.targetDate) return 1;
      if (!right.targetDate) return -1;
      return (
        new Date(left.targetDate).getTime() -
        new Date(right.targetDate).getTime()
      );
    })[0];
  }, [goals]);

  return (
    <div className="space-y-8" aria-busy={loading}>
      <FolioHeader
        title={t("goals")}
        description={
          goals.length > 0
            ? `${goals.length.toLocaleString()} ${goals.length === 1 ? "goal" : "goals"}, ${goals.filter((goal) => goal.status === "ACTIVE").length.toLocaleString()} active`
            : t("track-progress")
        }
        action={
          <Button onClick={openNewGoal} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("add-new-goal")}
          </Button>
        }
      />

      {showAddForm && (
        <section
          aria-labelledby="goal-editor-heading"
          className="border-y border-ledger-border bg-ledger-surface py-5 sm:px-5 sm:py-6"
        >
          <div className="px-4 sm:px-0">
            <h2
              id="goal-editor-heading"
              className="text-lg font-semibold text-ink"
            >
              {editingGoal ? t("edit-goal") : t("add-new-goal")}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Keep the target, progress, and timing in one place.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 px-4 sm:px-0">
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <Field label={t("goal-name")} htmlFor="goal-name">
                <input
                  id="goal-name"
                  type="text"
                  required
                  value={goalForm.name}
                  onChange={(event) =>
                    setGoalForm({ ...goalForm, name: event.target.value })
                  }
                  className={ledgerControlClass}
                  placeholder={t("goal-name-placeholder")}
                />
              </Field>
              <Field label={t("status")} htmlFor="goal-status">
                <select
                  id="goal-status"
                  value={goalForm.status}
                  onChange={(event) =>
                    setGoalForm({
                      ...goalForm,
                      status: event.target.value as GoalItem["status"],
                    })
                  }
                  className={ledgerControlClass}
                >
                  <option value="ACTIVE">{t("active")}</option>
                  <option value="PAUSED">{t("paused")}</option>
                  <option value="COMPLETED">{t("completed")}</option>
                  <option value="CANCELLED">{t("cancelled")}</option>
                </select>
              </Field>
              <Field
                label={t("target-amount")}
                htmlFor="goal-target"
                helper="Rupees and paise."
              >
                <input
                  id="goal-target"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={goalForm.targetAmount}
                  onChange={(event) =>
                    setGoalForm({
                      ...goalForm,
                      targetAmount: event.target.value,
                    })
                  }
                  aria-describedby="goal-target-message"
                  className={ledgerControlClass}
                />
              </Field>
              <Field
                label={t("current-amount")}
                htmlFor="goal-current"
                helper="Rupees and paise."
              >
                <input
                  id="goal-current"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={goalForm.currentAmount}
                  onChange={(event) =>
                    setGoalForm({
                      ...goalForm,
                      currentAmount: event.target.value,
                    })
                  }
                  aria-describedby="goal-current-message"
                  className={ledgerControlClass}
                />
              </Field>
              <Field label={t("target-date")} htmlFor="goal-date">
                <input
                  id="goal-date"
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(event) =>
                    setGoalForm({ ...goalForm, targetDate: event.target.value })
                  }
                  className={ledgerControlClass}
                />
              </Field>
              <Field label={t("description")} htmlFor="goal-description">
                <textarea
                  id="goal-description"
                  value={goalForm.description}
                  onChange={(event) =>
                    setGoalForm({
                      ...goalForm,
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  className={`${ledgerControlClass} h-auto min-h-24 py-2`}
                  placeholder={t("describe-goal")}
                />
              </Field>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : editingGoal
                    ? t("update-goal")
                    : t("create-goal")}
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
            <Button variant="secondary" onClick={loadGoals}>
              Retry
            </Button>
          }
        >
          {error}
        </InlineNotice>
      )}

      {!loading && focusGoal && <GoalFocus goal={focusGoal} t={t} />}

      {!loading && goals.length > 0 && (
        <section aria-labelledby="goal-ledger-heading">
          <div className="flex items-baseline justify-between gap-4 border-b border-ledger-border py-5">
            <div>
              <h2
                id="goal-ledger-heading"
                className="text-xl font-semibold tracking-[-0.02em] text-ink"
              >
                Goal ledger
              </h2>
              <p className="mt-1 text-sm text-ink-secondary">
                Targets, timing, and recorded progress
              </p>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-ink-secondary">
              {goals.length.toLocaleString()}{" "}
              {goals.length === 1 ? "goal" : "goals"}
            </p>
          </div>

          <div className="hidden xl:block" role="table" aria-label="Goals">
            <div
              className="grid grid-cols-[minmax(11rem,1.4fr)_8rem_8rem_8rem_minmax(9rem,0.8fr)_6rem_2.75rem] gap-4 border-b border-ledger-border py-3 text-caption font-medium uppercase tracking-[0.08em] text-ink-secondary"
              role="row"
            >
              <span role="columnheader">Goal</span>
              <span role="columnheader">Target date</span>
              <span role="columnheader" className="text-right">
                Current
              </span>
              <span role="columnheader" className="text-right">
                Remaining
              </span>
              <span role="columnheader">Progress</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="sr-only">
                Actions
              </span>
            </div>
            <div role="rowgroup">
              {goals.map((goal) => (
                <GoalDesktopRow
                  key={goal.id}
                  goal={goal}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  t={t}
                />
              ))}
            </div>
          </div>

          <div className="xl:hidden">
            {goals.map((goal) => (
              <GoalMobileRow
                key={goal.id}
                goal={goal}
                onEdit={handleEdit}
                onDelete={handleDelete}
                t={t}
              />
            ))}
          </div>
        </section>
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

      {!loading && !error && goals.length === 0 && !showAddForm && (
        <EmptyState
          title={t("no-goals-yet")}
          description={t("create-first-goal")}
          action={
            <Button onClick={openNewGoal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("add-new-goal")}
            </Button>
          }
        />
      )}
    </div>
  );
}

function GoalFocus({
  goal,
  t,
}: {
  goal: GoalItem;
  t: (key: string) => string;
}) {
  const progress = getProgress(goal.currentAmount, goal.targetAmount);
  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <section
      className="grid gap-6 border-b border-ledger-border pb-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)] lg:items-end"
      aria-labelledby="goal-focus-heading"
    >
      <div className="min-w-0">
        <p className="text-sm text-ink-secondary">Nearest active goal</p>
        <h2
          id="goal-focus-heading"
          className="mt-1 break-words text-3xl font-semibold tracking-[-0.03em] text-ink"
        >
          {goal.name}
        </h2>
        {goal.description && (
          <p className="mt-2 max-w-[65ch] text-sm leading-6 text-ink-secondary">
            {goal.description}
          </p>
        )}
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-4 text-sm">
            <span className="text-ink-secondary">
              {formatDate(goal.targetDate)}
            </span>
            <span className="font-medium tabular-nums text-ink">
              {formatPercent(progress)}
            </span>
          </div>
          <ProgressLine value={progress} label={`${goal.name} progress`} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ledger-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <FocusAmount label={t("target-amount")} amount={goal.targetAmount} />
        <FocusAmount label={t("current-amount")} amount={goal.currentAmount} />
        <FocusAmount
          label={t("remaining")}
          amount={remaining}
          className="col-span-2"
        />
      </dl>
    </section>
  );
}

function FocusAmount({
  label,
  amount,
  className = "",
}: {
  label: string;
  amount: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-ink-secondary">{label}</dt>
      <dd className="mt-1 text-ink">
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

function GoalDesktopRow({ goal, onEdit, onDelete, t }: GoalRowProps) {
  const progress = getProgress(goal.currentAmount, goal.targetAmount);
  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <div
      role="row"
      className="group grid min-h-20 grid-cols-[minmax(11rem,1.4fr)_8rem_8rem_8rem_minmax(9rem,0.8fr)_6rem_2.75rem] items-center gap-4 border-b border-ledger-border py-3 transition-colors duration-150 hover:bg-ledger-surface focus-within:bg-ledger-surface motion-reduce:transition-none"
    >
      <div role="cell" className="min-w-0">
        <p className="break-words text-sm font-medium text-ink">{goal.name}</p>
        {goal.description && (
          <p className="mt-1 truncate text-xs text-ink-secondary">
            {goal.description}
          </p>
        )}
      </div>
      <time
        role="cell"
        dateTime={goal.targetDate}
        className="text-sm tabular-nums text-ink-secondary"
      >
        {formatDate(goal.targetDate)}
      </time>
      <Amount
        role="cell"
        amount={goal.currentAmount}
        type="NEUTRAL"
        showSign={false}
        className="block text-right text-ink"
      />
      <Amount
        role="cell"
        amount={remaining}
        type="NEUTRAL"
        showSign={false}
        className="block text-right text-ink"
      />
      <div role="cell" className="min-w-0">
        <div className="mb-2 text-right text-xs tabular-nums text-ink-secondary">
          {formatPercent(progress)}
        </div>
        <ProgressLine
          value={progress}
          tone={getProgressTone(goal.status)}
          label={`${goal.name} progress`}
        />
      </div>
      <div role="cell">
        <GoalStatus status={goal.status} t={t} />
      </div>
      <RowActionMenu
        label={`Actions for ${goal.name}`}
        onEdit={() => onEdit(goal)}
        onDelete={() => onDelete(goal)}
      />
    </div>
  );
}

function GoalMobileRow({ goal, onEdit, onDelete, t }: GoalRowProps) {
  const progress = getProgress(goal.currentAmount, goal.targetAmount);
  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <article className="group border-b border-ledger-border py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-ink">
            {goal.name}
          </h3>
          {goal.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-secondary">
              {goal.description}
            </p>
          )}
        </div>
        <RowActionMenu
          label={`Actions for ${goal.name}`}
          onEdit={() => onEdit(goal)}
          onDelete={() => onDelete(goal)}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="text-xs text-ink-secondary">{t("current-amount")}</dt>
          <dd className="mt-1 text-ink">
            <Amount
              amount={goal.currentAmount}
              type="NEUTRAL"
              showSign={false}
            />
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-ink-secondary">{t("target-amount")}</dt>
          <dd className="mt-1 text-ink">
            <Amount
              amount={goal.targetAmount}
              type="NEUTRAL"
              showSign={false}
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-secondary">{t("remaining")}</dt>
          <dd className="mt-1 text-ink">
            <Amount amount={remaining} type="NEUTRAL" showSign={false} />
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-ink-secondary">{t("target-date")}</dt>
          <dd className="mt-1 text-sm tabular-nums text-ink">
            {formatDate(goal.targetDate)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-4">
        <GoalStatus status={goal.status} t={t} />
        <span className="text-xs tabular-nums text-ink-secondary">
          {formatPercent(progress)}
        </span>
      </div>
      <div className="mt-2">
        <ProgressLine
          value={progress}
          tone={getProgressTone(goal.status)}
          label={`${goal.name} progress`}
        />
      </div>
    </article>
  );
}

function GoalStatus({
  status,
  t,
}: {
  status: GoalItem["status"];
  t: (key: string) => string;
}) {
  if (status === "ACTIVE")
    return <span className="text-xs text-ink-secondary">{t("active")}</span>;
  const tone =
    status === "CANCELLED"
      ? "bg-ledger-surface text-negative"
      : status === "PAUSED"
        ? "bg-ledger-surface text-warning"
        : "bg-accent-soft text-accent";
  return (
    <span
      className={`inline-flex rounded-status px-2 py-1 text-xs font-medium ${tone}`}
    >
      {t(status.toLowerCase())}
    </span>
  );
}

interface GoalRowProps {
  goal: GoalItem;
  onEdit: (goal: GoalItem) => void;
  onDelete: (goal: GoalItem) => void;
  t: (key: string) => string;
}

function MobileSkeleton() {
  return (
    <div
      className="border-b border-ledger-border py-5 animate-pulse motion-reduce:animate-none"
      aria-hidden="true"
    >
      <div className="h-3 w-2/5 rounded-status bg-ledger-border" />
      <div className="mt-3 h-3 w-3/5 rounded-status bg-ledger-border" />
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div className="h-8 rounded-status bg-ledger-border" />
        <div className="h-8 rounded-status bg-ledger-border" />
      </div>
    </div>
  );
}
