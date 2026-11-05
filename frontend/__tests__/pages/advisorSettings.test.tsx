import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AiAdvisor from "../../pages/AiAdvisor";
import Settings from "../../pages/Settings";
import { apiClient } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  apiClient: {
    getAiHistory: vi.fn(),
    getFinanceAdvice: vi.fn(),
    getGoals: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("../../context/LanguageContext", () => {
  const setLanguage = vi.fn();
  const t = (key: string) => key;

  return {
    useLanguage: () => ({ currentLanguage: "en", setLanguage, t }),
  };
});

vi.mock("../../context/DarkModeContext", () => ({
  useDarkMode: () => ({
    preference: "dark",
    setTheme: vi.fn(),
  }),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(apiClient.getGoals).mockResolvedValue({ data: [], pagination: {} });
  vi.mocked(apiClient.getAiHistory).mockResolvedValue([]);
  vi.mocked(apiClient.getFinanceAdvice).mockResolvedValue({
    summary: "Recorded monthly surplus is ₹20,000.",
    financial_health: "stable",
    evidence: [
      {
        id: "e1",
        tool: "get_financial_summary",
        status: "ok",
        source: "FIN-AI",
        observedAt: "2026-11-03T12:00:00Z",
        data: {
          totalIncome: 100000,
          totalExpenses: 80000,
          netAmount: 20000,
          savingsRate: 0.2,
          topCategories: [],
          transactionCount: 12,
          start: "2026-11-01",
          end: "2026-11-03",
        },
      },
    ],
    recommendations: [
      { id: "buffer", text: "Reserve a cash buffer.", evidenceIds: ["e1"] },
    ],
    tools_used: ["get_financial_summary"],
    assumptions: ["Recorded data only."],
    confidence: 0.8,
    simulations: [],
    provider: "mock",
  });
});

describe("Finance Advisor workspace", () => {
  it("shows evidence, recommendations and optional activity without redesigning the workspace", async () => {
    const user = userEvent.setup();
    render(<AiAdvisor />);
    await user.type(
      screen.getByLabelText("Your financial question"),
      "What should I prioritize?",
    );
    await user.click(screen.getByRole("button", { name: "Ask FinanceAI" }));
    await waitFor(() =>
      expect(apiClient.getFinanceAdvice).toHaveBeenCalledWith({
        question: "What should I prioritize?",
      }),
    );
    expect(
      screen.getByText("Recorded monthly surplus is ₹20,000."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Income ₹1,00,000/)).toBeInTheDocument();
    expect(screen.getByText("Reserve a cash buffer.")).toBeInTheDocument();
    expect(
      screen.getByText("Recorded data only.").closest("details"),
    ).not.toHaveAttribute("open");
  });
  it("sends explicit simulation parameters and displays deterministic impact", async () => {
    vi.mocked(apiClient.getGoals).mockResolvedValue({
      data: [
        {
          id: "goal1",
          name: "Emergency reserve",
          targetAmount: 300000,
          currentAmount: 60000,
          status: "ACTIVE",
          userId: "owner",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
      pagination: {},
    });
    const result = await vi
      .mocked(apiClient.getFinanceAdvice)
      .getMockImplementation()!({ question: "test" });
    vi.mocked(apiClient.getFinanceAdvice).mockResolvedValue({
      ...result,
      simulations: [
        {
          kind: "reduce_category",
          goalId: "goal1",
          baselineMonthlySavings: 20000,
          monthlyChange: 5000,
          scenarioMonthlySavings: 25000,
          remaining: 240000,
          baselineMonths: 12,
          scenarioMonths: 10,
          monthsEarlier: 2,
          baselineCompletion: "2027-11-03",
          scenarioCompletion: "2027-09-03",
          requiredMonthlySavings: 20000,
          affordable: true,
          basis: "2026-10",
        },
      ],
    });
    const user = userEvent.setup();
    render(<AiAdvisor />);
    await user.click(screen.getByText("Test a financial scenario (optional)"));
    await user.selectOptions(
      screen.getByLabelText("Scenario"),
      "reduce_category",
    );
    await user.clear(screen.getByLabelText("Scenario value"));
    await user.type(screen.getByLabelText("Scenario value"), "25");
    await user.type(
      screen.getByLabelText("Your financial question"),
      "Review this scenario",
    );
    await user.click(screen.getByRole("button", { name: "Ask FinanceAI" }));
    await screen.findByText("2 months earlier");
    expect(apiClient.getFinanceAdvice).toHaveBeenCalledWith({
      question: "Review this scenario",
      simulation: {
        kind: "reduce_category",
        category: "food-dining",
        percent: 25,
      },
    });
    expect(screen.getByText(/No money has moved/)).toBeInTheDocument();
  });
  it("shows insufficient evidence and retains legacy history", async () => {
    const response = await vi
      .mocked(apiClient.getFinanceAdvice)
      .getMockImplementation()!({ question: "test" });
    vi.mocked(apiClient.getFinanceAdvice).mockResolvedValue({
      ...response,
      financial_health: "insufficient_evidence",
      summary: "Not enough recorded history.",
      confidence: 0,
      recommendations: [],
    });
    vi.mocked(apiClient.getAiHistory).mockResolvedValue([
      {
        id: "old",
        query: "Previous question",
        response: "Previous recorded answer",
        category: "budget",
        createdAt: "2026-01-01",
      },
    ]);
    const user = userEvent.setup();
    render(<AiAdvisor />);
    await screen.findByText("Previous advisor conversations");
    await user.type(
      screen.getByLabelText("Your financial question"),
      "How are my finances?",
    );
    await user.click(screen.getByRole("button", { name: "Ask FinanceAI" }));
    expect(
      await screen.findByText("Not enough recorded history."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Recommended next steps"),
    ).not.toBeInTheDocument();
  });
  it("handles errors without rendering sensitive provider error messages", async () => {
    vi.mocked(apiClient.getFinanceAdvice).mockRejectedValue(
      new Error("postgres://secret@database"),
    );
    const user = userEvent.setup();
    render(<AiAdvisor />);
    await user.type(
      screen.getByLabelText("Your financial question"),
      "Review my budget",
    );
    await user.click(screen.getByRole("button", { name: "Ask FinanceAI" }));
    expect(
      await screen.findByText(
        "Could not prepare your financial review. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/postgres:/)).not.toBeInTheDocument();
  });
});

describe("Settings sections", () => {
  it("keeps notification changes behind the existing section save action", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    await user.click(
      screen.getByRole("checkbox", { name: "email-notifications" }),
    );
    await user.click(screen.getByRole("button", { name: "save-changes" }));

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "userNotifications_default",
      expect.stringContaining('"email":false'),
    );
    expect(
      screen.getByText("Notification preferences saved on this device."),
    ).toBeInTheDocument();
  });

  it("keeps keyboard focus inside the password dialog", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.click(screen.getByRole("button", { name: /security/i }));
    await user.click(screen.getByRole("button", { name: "change-password" }));

    const dialog = screen.getByRole("dialog", { name: "change-password" });
    const currentPassword = within(dialog).getByLabelText("current-password");
    const submit = within(dialog).getByRole("button", {
      name: "change-password",
    });

    expect(currentPassword).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(submit).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(currentPassword).toHaveFocus();
  });
});
