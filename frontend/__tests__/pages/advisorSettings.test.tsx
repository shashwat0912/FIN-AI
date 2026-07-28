import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AiAdvisor from "../../pages/AiAdvisor";
import Settings from "../../pages/Settings";
import { apiClient } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  apiClient: {
    getAiHistory: vi.fn(),
    getAiAdvice: vi.fn(),
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
  vi.mocked(apiClient.getAiHistory).mockResolvedValue([]);
  vi.mocked(apiClient.getAiAdvice).mockResolvedValue({
    advice: "Keep the next transfer focused on your emergency fund.",
    category: "savings",
    confidence: 0.9,
  });
});

describe("AI Advisor workspace", () => {
  it("submits a focused question and adds the response to the workspace", async () => {
    const user = userEvent.setup();
    render(<AiAdvisor />);

    await screen.findByText("no-conversations-yet");
    await user.type(
      screen.getByLabelText("ask-financial-question"),
      "What should I prioritize?",
    );
    await user.click(screen.getByRole("button", { name: "Ask FinanceAI" }));

    await waitFor(() =>
      expect(apiClient.getAiAdvice).toHaveBeenCalledWith(
        "What should I prioritize?",
      ),
    );
    expect(
      screen.getAllByText(
        "Keep the next transfer focused on your emergency fund.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "What should I prioritize?" }),
    ).toBeInTheDocument();
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
