import { expect, test } from "@playwright/test";

test("browser follows the real chain through PostgreSQL projection and node execution", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See what the TOS Network can prove/i })).toBeVisible();
  await expect(page.getByText("Preview data", { exact: false })).toHaveCount(0);

  await page.goto("/network");
  await expect(page.getByText("Fully caught up")).toBeVisible();
  // Assert the count is positive rather than that the text differs from
  // "0 transactions". toContainText matches substrings, and every healthy count
  // ending in a zero -- 790, 1000 -- contains "0 transactions", so the negative
  // form fails on exactly the outcome it is meant to accept.
  const indexedTransactions = page.locator(".index-health > div").first().getByText(/transactions/);
  await expect(indexedTransactions).toBeVisible();
  const indexedText = (await indexedTransactions.innerText()).trim();
  const indexedCount = Number.parseInt(indexedText.replace(/[^0-9]/g, ""), 10);
  expect(indexedCount, `indexer reported "${indexedText}"`).toBeGreaterThan(0);

  await page.goto("/transactions");
  const firstTransaction = page.locator('main a[href^="/tx/"]').first();
  await expect(firstTransaction).toBeVisible();
  await firstTransaction.click();
  await expect(page.getByRole("heading", { name: "Transaction" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Execution phases" })).toBeVisible();
  await expect(page.getByText("VM steps", { exact: false }).or(page.getByText("Skipped", { exact: true }))).toBeVisible();

  const message = page.locator('a[href^="/message/"]').first();
  if (await message.count()) {
    await message.click();
    await expect(page.getByRole("heading", { name: "Message" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Message path" })).toBeVisible();
  }

  await page.goto("/economy");
  await expect(page.getByRole("heading", { name: "Agent economy" })).toBeVisible();
  await expect(page.getByText("Registered agents")).toBeVisible();
  await expect(page.getByText("No indexed task lifecycle data yet.")).toHaveCount(0);

  await page.goto("/validators");
  await expect(page.getByRole("heading", { name: "Validators" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current validator set" })).toBeVisible();
  await expect(page.getByText("Evidence boundary.")).toBeVisible();
  await page.locator('a[href^="/validator/"]').first().click();
  await expect(page.getByText("Voting-weight history")).toBeVisible();

  await page.goto("/staking");
  await expect(page.getByRole("heading", { name: "Staking" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Completed reward cycles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stake above the effective cap earns no additional reward" })).toBeVisible();
  await expect(page.getByText("Surplus earns").locator("..").getByText("No", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nominator Pools" })).toBeVisible();
  await expect(page.getByText("No Nominator Pool contract has appeared")).toHaveCount(0);
  await expect(page.locator(".staking-pool-list article")).toHaveCount(1);
  await expect(page.getByText("Evidence boundary.")).toBeVisible();
  await page.locator('a[href^="/staking/pool/"]').first().click();
  await expect(page.getByRole("heading", { name: "Nominator positions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "More pool capital does not always produce more rewards" })).toBeVisible();

  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Network analytics" })).toBeVisible();
  await expect(page.getByText("Transaction activity")).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport) expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});
