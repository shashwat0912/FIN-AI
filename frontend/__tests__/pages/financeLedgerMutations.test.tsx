import React, { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Budget from "../../pages/Budget";
import Goals from "../../pages/Goals";
import { apiClient } from "../../lib/api";
import { dispatchTransactionsUpdated } from "../../lib/appEvents";

vi.mock("../../lib/api", () => ({
  apiClient: {
    getBudgets: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
    getGoals: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
  },
}));

vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn() },
}));

const budget = (id: string, name: string) => ({
  id,
  name,
  categoryKey: "food-dining",
  amount: 1000,
  spent: 100,
  remaining: 900,
  utilizationPercentage: 10,
  status: "ON_TRACK" as const,
  period: "MONTHLY" as const,
  userId: "user-1",
  isActive: true,
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
});

const goal = (id: string, name: string) => ({
  id,
  name,
  description: "",
  targetAmount: 1000,
  currentAmount: 100,
  status: "ACTIVE" as const,
  userId: "user-1",
  createdAt: "2026-07-16T00:00:00.000Z",
  updatedAt: "2026-07-16T00:00:00.000Z",
});

beforeEach(() => {
  vi.mocked(apiClient.getBudgets).mockResolvedValue({
    data: [],
    pagination: {},
  });
  vi.mocked(apiClient.getGoals).mockResolvedValue({ data: [], pagination: {} });
});

async function createBudget(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "add-budget" })[0]);
  await user.type(screen.getByLabelText("budget-name"), name);
  await user.type(screen.getByLabelText("budget-amount"), "1000");
  const submit = screen.getByRole("button", { name: "create-budget" });
  fireEvent.submit(submit.closest("form")!);
  await waitFor(() => expect(submit).not.toBeInTheDocument());
}

async function createGoal(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: "add-new-goal" })[0]);
  await user.type(screen.getByLabelText("goal-name"), name);
  await user.type(screen.getByLabelText("target-amount"), "1000");
  await user.type(screen.getByLabelText("current-amount"), "100");
  const submit = screen.getByRole("button", { name: "create-goal" });
  fireEvent.submit(submit.closest("form")!);
  await waitFor(() => expect(submit).not.toBeInTheDocument());
}

describe("Budget mutations", () => {
  it("creates three rows sequentially without refreshing the list", async () => {
    vi.mocked(apiClient.createBudget)
      .mockResolvedValueOnce(budget("b1", "Food"))
      .mockResolvedValueOnce(budget("b2", "Travel"))
      .mockResolvedValueOnce(budget("b3", "Home"));
    render(<Budget />);
    await screen.findByText("no-budgets-yet");

    await createBudget("Food");
    await createBudget("Travel");
    await createBudget("Home");

    expect(apiClient.createBudget).toHaveBeenCalledTimes(3);
    expect(apiClient.getBudgets).toHaveBeenCalledTimes(1);
    expect(screen.getByText("3 budgets, monthly")).toBeInTheDocument();
    expect(screen.getByText("3 categories")).toBeInTheDocument();
    expect(screen.getAllByText("Home").length).toBeGreaterThan(1);
  });

  it("disables submit while a create is pending", async () => {
    let resolveCreate!: (value: ReturnType<typeof budget>) => void;
    vi.mocked(apiClient.createBudget).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<Budget />);
    await screen.findByText("no-budgets-yet");

    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "add-budget" })[0]);
    await user.type(screen.getByLabelText("budget-name"), "Food");
    await user.type(screen.getByLabelText("budget-amount"), "1000");
    fireEvent.submit(
      screen.getByRole("button", { name: "create-budget" }).closest("form")!,
    );

    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    resolveCreate(budget("b1", "Food"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Saving…" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("updates and deletes locally without refreshing the list", async () => {
    const original = budget("b1", "Food");
    const updated = { ...original, name: "Groceries" };
    vi.mocked(apiClient.getBudgets).mockResolvedValue({
      data: [original],
      pagination: {},
    });
    vi.mocked(apiClient.updateBudget).mockResolvedValue(updated);
    vi.mocked(apiClient.deleteBudget).mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Budget />);
    const table = await screen.findByRole("table", { name: "Budgets" });

    await userEvent.setup().click(within(table).getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("budget-name");
    await userEvent.setup().clear(name);
    await userEvent.setup().type(name, "Groceries");
    fireEvent.submit(screen.getByRole("button", { name: "update-budget" }).closest("form")!);
    expect(await screen.findAllByText("Groceries")).not.toHaveLength(0);

    await userEvent.setup().click(within(table).getByRole("button", { name: "Delete" }));
    await screen.findByText("no-budgets-yet");
    expect(apiClient.getBudgets).toHaveBeenCalledTimes(1);
    expect(apiClient.updateBudget).toHaveBeenCalledTimes(1);
    expect(apiClient.deleteBudget).toHaveBeenCalledTimes(1);
  });

  it("keeps loaded rows visible when a Strict Mode refresh is rate-limited", async () => {
    vi.mocked(apiClient.getBudgets)
      .mockResolvedValueOnce({ data: [budget("b1", "Food")], pagination: {} })
      .mockRejectedValueOnce(
        new Error("Too many requests. Please wait a moment and try again."),
      );

    render(
      <StrictMode>
        <Budget />
      </StrictMode>,
    );

    expect(
      await screen.findByText(
        "Too many requests. Please wait a moment and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Food").length).toBeGreaterThan(1);
    expect(screen.getByText("1 category")).toBeInTheDocument();
  });

  it("reloads derived budgets when transactions are updated", async () => {
    vi.mocked(apiClient.getBudgets)
      .mockResolvedValueOnce({ data: [], pagination: {} })
      .mockResolvedValueOnce({ data: [budget("b1", "Food")], pagination: {} });
    render(<Budget />);
    await screen.findByText("no-budgets-yet");

    act(() => dispatchTransactionsUpdated());

    await waitFor(() => expect(apiClient.getBudgets).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Food").length).toBeGreaterThan(0);
  });
});

describe("Goal mutations", () => {
  it("creates three rows sequentially without refreshing the list", async () => {
    vi.mocked(apiClient.createGoal)
      .mockResolvedValueOnce(goal("g1", "Emergency fund"))
      .mockResolvedValueOnce(goal("g2", "Holiday"))
      .mockResolvedValueOnce(goal("g3", "Home deposit"));
    render(<Goals />);
    await screen.findByText("no-goals-yet");

    await createGoal("Emergency fund");
    await createGoal("Holiday");
    await createGoal("Home deposit");

    expect(apiClient.createGoal).toHaveBeenCalledTimes(3);
    expect(apiClient.createGoal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: "Emergency fund",
        description: "",
      }),
    );
    expect(apiClient.getGoals).toHaveBeenCalledTimes(1);
    expect(screen.getByText("3 goals, 3 active")).toBeInTheDocument();
    expect(screen.getByText("3 goals")).toBeInTheDocument();
    expect(screen.getAllByText("Home deposit").length).toBeGreaterThan(1);
  });

  it("disables submit while a create is pending", async () => {
    let resolveCreate!: (value: ReturnType<typeof goal>) => void;
    vi.mocked(apiClient.createGoal).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    render(<Goals />);
    await screen.findByText("no-goals-yet");

    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "add-new-goal" })[0],
    );
    await user.type(screen.getByLabelText("goal-name"), "Emergency fund");
    await user.type(screen.getByLabelText("target-amount"), "1000");
    await user.type(screen.getByLabelText("current-amount"), "100");
    fireEvent.submit(
      screen.getByRole("button", { name: "create-goal" }).closest("form")!,
    );

    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    resolveCreate(goal("g1", "Emergency fund"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Saving…" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("preserves form data when goal validation fails", async () => {
    vi.mocked(apiClient.createGoal).mockRejectedValue(
      new Error("Validation error"),
    );
    render(<Goals />);
    await screen.findByText("no-goals-yet");

    const user = userEvent.setup();
    await user.click(
      screen.getAllByRole("button", { name: "add-new-goal" })[0],
    );
    await user.type(screen.getByLabelText("goal-name"), "Emergency fund");
    await user.type(
      screen.getByLabelText("description"),
      "Six months of expenses",
    );
    await user.type(screen.getByLabelText("target-amount"), "1000");
    await user.type(screen.getByLabelText("current-amount"), "100");
    fireEvent.submit(
      screen.getByRole("button", { name: "create-goal" }).closest("form")!,
    );

    expect(await screen.findByText("Validation error")).toBeInTheDocument();
    expect(apiClient.createGoal).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("goal-name")).toHaveValue("Emergency fund");
    expect(screen.getByLabelText("description")).toHaveValue(
      "Six months of expenses",
    );
    expect(screen.getByLabelText("target-amount")).toHaveValue(1000);
    expect(screen.getByLabelText("current-amount")).toHaveValue(100);
  });

  it("updates and deletes locally without refreshing the list", async () => {
    const original = goal("g1", "Emergency fund");
    const updated = { ...original, name: "Safety fund" };
    vi.mocked(apiClient.getGoals).mockResolvedValue({
      data: [original],
      pagination: {},
    });
    vi.mocked(apiClient.updateGoal).mockResolvedValue(updated);
    vi.mocked(apiClient.deleteGoal).mockResolvedValue();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Goals />);
    const table = await screen.findByRole("table", { name: "Goals" });

    await userEvent.setup().click(within(table).getByRole("button", { name: "Edit" }));
    const name = screen.getByLabelText("goal-name");
    await userEvent.setup().clear(name);
    await userEvent.setup().type(name, "Safety fund");
    fireEvent.submit(screen.getByRole("button", { name: "update-goal" }).closest("form")!);
    expect(await screen.findAllByText("Safety fund")).not.toHaveLength(0);

    await userEvent.setup().click(within(table).getByRole("button", { name: "Delete" }));
    await screen.findByText("no-goals-yet");
    expect(apiClient.getGoals).toHaveBeenCalledTimes(1);
    expect(apiClient.updateGoal).toHaveBeenCalledTimes(1);
    expect(apiClient.deleteGoal).toHaveBeenCalledTimes(1);
  });

  it("keeps loaded rows visible when a Strict Mode refresh is rate-limited", async () => {
    vi.mocked(apiClient.getGoals)
      .mockResolvedValueOnce({
        data: [goal("g1", "Emergency fund")],
        pagination: {},
      })
      .mockRejectedValueOnce(
        new Error("Too many requests. Please wait a moment and try again."),
      );

    render(
      <StrictMode>
        <Goals />
      </StrictMode>,
    );

    expect(
      await screen.findByText(
        "Too many requests. Please wait a moment and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Emergency fund").length).toBeGreaterThan(1);
    expect(screen.getByText("1 goal")).toBeInTheDocument();
  });
});
