import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const ui = "http://127.0.0.1:5173";
const api = "http://127.0.0.1:3001";
const output = new URL("../docs/assets/demo/", import.meta.url);
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const { PrismaClient } = require("@prisma/client");

// The smoke server and capture must share the disposable Compose database.
const db = new PrismaClient({
  datasourceUrl: "postgresql://financeai_test@localhost:5433/finance_ai_test",
});
const email = `portfolio-${randomUUID()}@example.com`;
const walkthrough = process.argv.includes("--walkthrough");
let browser;
let user;
try {
  user = await db.user.create({
    data: { email, name: "Demo Operator", role: "ADMIN" },
  });
  const now = new Date();
  const date = (day) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day, 12));
  const ledger = [
    [78000, "Monthly pay", "Salary", "salary", "INCOME"],
    [34000, "Apartment rent", "Housing", "housing", "EXPENSE"],
    [9000, "Groceries", "Groceries", "groceries", "EXPENSE"],
    [8000, "Dining out", "Food & Dining", "food-dining", "EXPENSE"],
    [5000, "Commute", "Transport", "transport", "EXPENSE"],
    [10000, "Utilities and essentials", "Utilities", "utilities", "EXPENSE"],
  ];
  await db.transaction.createMany({
    data: ledger.flatMap(
      ([amount, description, category, categoryKey, type], i) =>
        [
          date(2 + i * 3),
          new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        ].map((date) => ({
          userId: user.id,
          amount,
          description,
          category,
          categoryKey,
          type,
          date,
        })),
    ),
  });
  await db.goal.create({
    data: {
      userId: user.id,
      name: "Emergency fund",
      targetAmount: 300000,
      currentAmount: 45000,
    },
  });

  browser = await chromium.launch({ headless: !walkthrough });
  const page = await browser.newPage({
    viewport: { width: 1280, height: walkthrough ? 850 : 1600 },
    colorScheme: "light",
    locale: "en-IN",
    timezoneId: "UTC",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await page.route("**/*", (route) =>
    [ui, api].includes(new URL(route.request().url()).origin)
      ? route.continue()
      : route.abort(),
  );

  await page.goto(`${ui}/login`);
  await page.locator("#identifier").fill(email);
  const otpSent = page.waitForResponse(
    (response) => response.url() === `${api}/api/v1/auth/send-otp`,
  );
  await page.locator('form button[type="submit"]').click();
  const otp = (await (await otpSent).json()).data?.otpForDev;
  assert.match(
    otp ?? "",
    /^\d{6}$/,
    "Use the existing local smoke server with development OTP",
  );
  await page.locator("#otp").fill(otp);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(`${ui}/dashboard`);
  await page.waitForLoadState("networkidle");

  if (walkthrough) {
    const terminal = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      await terminal.question(
        "Demo ready. Press Enter to close the browser and remove the demo account.\n",
      );
    } finally {
      terminal.close();
    }
  } else {
    await mkdir(output, { recursive: true });
    async function capture(file, top, evidence = []) {
      for (const tool of evidence) {
        const heading = top.getByRole("heading", {
          name: new RegExp(`\\b${tool}$`),
        });
        await expect(heading).toBeVisible();
        await heading.evaluate((element) =>
          element.parentElement.setAttribute("data-demo-evidence", ""),
        );
      }
      await page.evaluate(() => document.fonts.ready.then(() => true));
      await top.evaluate((element) =>
        element.setAttribute("data-demo-capture", ""),
      );
      // Capture only the result section, outside the account sidebar and browser chrome.
      const visibleText = await top.innerText();
      const privateText =
        /[\w.%+-]+@[\w.-]+\.\w+|https?:\/\/|\b\d{12}\b|(?:\/Users|\/home|\/private\/tmp)\/|AKIA[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./;
      assert(
        !privateText.test(visibleText),
        "Private-looking text in screenshot workspace",
      );
      await top.screenshot({
        path: fileURLToPath(new URL(file, output)),
        animations: "disabled",
        style: `[data-demo-capture] { padding: 24px; }
          [aria-label="Open chat"] { visibility: hidden; }
        ${evidence.length ? "details > div:has(h4):not([data-demo-evidence]) { display: none; }" : ""}`,
      });
    }

    await page.getByRole("link", { name: "AI Advisor", exact: true }).click();
    await page
      .getByLabel("Your financial question")
      .fill(
        "Reduce dining spending by 20%. How does this change my goal timeline?",
      );
    const review = page.waitForResponse(
      (response) => response.url() === `${api}/api/v1/advisor`,
    );
    await page.getByRole("button", { name: "Ask FinanceAI" }).click();
    const response = await review;
    assert(
      response.ok(),
      `The local Advisor request returned ${response.status()}`,
    );
    const answer = (await response.json()).data;
    assert.equal(answer?.provider, "mock");
    const scenario = answer.simulations[0];
    assert.deepEqual(
      [
        scenario.baselineMonthlySavings,
        scenario.scenarioMonthlySavings,
        scenario.monthsEarlier,
      ],
      [12000, 13600, 3],
    );
    await expect(
      page.getByRole("heading", { name: "Based on your data" }),
    ).toBeVisible();
    await page.getByText("Assumptions and activity", { exact: true }).click();
    await capture(
      "finance-advisor.png",
      page.getByRole("region", { name: "Your financial review" }),
    );

    await page.getByRole("link", { name: "Cloud Ops", exact: true }).click();
    const simulation = "Simulated infrastructure data — no live AWS telemetry";
    const incident = page.getByRole("region", {
      name: "Incident investigator",
    });
    await page
      .getByLabel("Incident or question")
      .fill("Why is backend readiness failing?");
    const investigation = page.waitForResponse(
      (response) => response.url() === `${api}/api/v1/cloud-ops/investigate`,
      { timeout: 75000 },
    );
    await incident
      .getByRole("button", { name: "Investigate incident" })
      .click();
    assert(
      (await investigation).ok(),
      "The local investigation request failed",
    );
    await expect(incident.getByText(simulation, { exact: true })).toBeVisible();
    await expect(
      incident.getByText("database connection pool saturation", {
        exact: true,
      }),
    ).toBeVisible();
    await incident.locator("summary").click();
    await capture("sre-investigation.png", incident, ["rds_get_metrics"]);

    await page
      .getByLabel("Demo scenario", { exact: false })
      .selectOption("bad_deployment");
    const deployment = page.getByRole("region", { name: "Deployment review" });
    const deploymentReview = page.waitForResponse(
      (response) =>
        response.url() === `${api}/api/v1/cloud-ops/deployment-review`,
      { timeout: 75000 },
    );
    await deployment.getByRole("button", { name: "Review deployment" }).click();
    assert((await deploymentReview).ok(), "The local deployment review failed");
    await expect(
      deployment.getByText(simulation, { exact: true }),
    ).toBeVisible();
    await expect(
      deployment.getByText(
        /^Recommendation: (PROMOTE|HOLD|ROLLBACK_RECOMMENDED)$/,
      ),
    ).toBeVisible();
    await expect(deployment.getByText(/^Baseline: /)).toBeVisible();
    await expect(deployment.getByText(/^Observation: /)).toBeVisible();
    await deployment.locator("summary").click();
    await capture("deployment-review.png", deployment, [
      "kubernetes_get_deployments",
    ]);
  }
} finally {
  await browser?.close();
  try {
    if (user) await db.user.delete({ where: { id: user.id } });
  } finally {
    await db.$disconnect();
  }
}
