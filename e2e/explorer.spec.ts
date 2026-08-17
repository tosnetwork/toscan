import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const address = "0:8a76df4d2f8a57a8b4b78f2d63156496dde6f17bb1a3df86f367dd2d6ab0a921";
const agent = "0:4bd621937f6f00f68169ad5843924e092b3f89f84a1abf283113e0b9c97e41c2";
const service = "0:e59cd1e7780b9f6dac188fa9f15acc678efe5a86f524b6f879ae469aafd85036";
const taskAddress = "0:91bd10a94892f3f1064f9e65a336a47d5ecfed4a0ea26d180b1375f9d4dc772a";

test("explores chain and AI-economy entities through deterministic routes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See what the TOS Network can prove/i })).toBeVisible();
  await expect(page.getByText("Preview data", { exact: false })).toBeVisible();

  await page.goto("/blocks");
  await expect(page.getByRole("heading", { name: "Blocks" })).toBeVisible();
  await page.getByRole("link", { name: /4,281,904/ }).first().click();
  await expect(page.getByRole("heading", { name: /Block 4,281,904/ })).toBeVisible();

  await page.goto("/transactions");
  await page.locator('main a[href^="/tx/"]').first().click();
  await expect(page.getByRole("heading", { name: "Transaction" })).toBeVisible();
  await expect(page.getByText("Total fee")).toBeVisible();
  await expect(page.getByText("Inbound message", { exact: true })).toBeVisible();
  await expect(page.getByText("internal", { exact: true }).first()).toBeVisible();

  await page.goto(`/agent/${agent}`);
  await expect(page.getByRole("heading", { name: "Agent Account" })).toBeVisible();
  await expect(page.getByText("Spending boundary")).toBeVisible();

  await page.goto(`/task/${taskAddress}`);
  await expect(page.getByRole("heading", { name: "Market signal synthesis" })).toBeVisible();
  await expect(page.getByText("Commercial terms")).toBeVisible();

  await page.goto("/disputes");
  await page.locator("tbody").getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Dispute" })).toBeVisible();

  await page.goto(`/service/${service}`);
  await expect(page.getByRole("heading", { name: "Service Actor" })).toBeVisible();
  await expect(page.getByText("What this proves")).toBeVisible();

  await page.goto(`/address/${address}`);
  await page.getByRole("tab", { name: /Assets/ }).click();
  await page.getByRole("link", { name: /[0-9a-f]{5}/ }).first().click();
  await expect(page.getByRole("heading", { name: "TOS Preview Asset" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("global search and keyboard shortcut resolve canonical identities", async ({ page }) => {
  await page.goto("/");
  const theme = page.getByRole("button", { name: /Change theme/ });
  await theme.click();
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("/");
  const search = page.locator('input[aria-label="Search TOS Network"]:visible').first();
  await expect(search).toBeFocused();
  await search.fill(address);
  await search.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/address/${address}$`));
  await expect(page.getByRole("heading", { name: "Address" })).toBeVisible();
});

test("primary public routes have no serious or critical accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "One desktop accessibility pass covers the shared DOM.");
  const routes = ["/", "/blocks", "/transactions", "/assets", "/agents", "/tasks", "/disputes", "/services", "/economy", "/network", "/validators", "/staking", "/governance"];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical"
    );
    expect(violations, `${route}: ${violations.map((item) => item.id).join(", ")}`).toEqual([]);
  }
});
