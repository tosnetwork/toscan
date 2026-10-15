import { expect, test } from "@playwright/test";

test("PQ chain exposes stable validator identities and explicit protocol gates", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/network");
  const protocol = page.getByRole("region", { name: "Post-quantum protocol evidence" });
  await expect(protocol.getByRole("heading", { name: "Post-quantum protocol", exact: true })).toBeVisible();
  await expect(protocol.getByText("VM protocol version", { exact: true })).toBeVisible();
  await expect(protocol.getByText("ML-DSA-44", { exact: true })).toBeVisible();
  await expect(protocol.getByText("Falcon-512 padded", { exact: true })).toBeVisible();
  await expect(protocol.getByText("VM verifier", { exact: true })).toBeVisible();
  if (process.env.TOSCAN_EXPECT_VM) {
    await expect(protocol.locator("dd").first()).toHaveText(process.env.TOSCAN_EXPECT_VM);
  }
  await expect(page.getByText("Preview data", { exact: false })).toHaveCount(0);
  await page.goto("/validators");
  await expect(page.getByRole("heading", { name: "Current validator set" })).toBeVisible();
  await expect(page.getByText("PQ finality verified by node", { exact: true })).toBeVisible();
  await expect(page.locator(".validator-metrics > div").filter({ hasText: "Observed proof signatures" }).locator("strong")).not.toHaveText("—");
  const rows = page.locator(".validator-table tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first().getByText("ML-DSA-44", { exact: true })).toBeVisible();
  const search = page.getByPlaceholder("Search identity, key ID or ADNL");
  await search.fill("ML-DSA-44");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(rows).toHaveCount(3);
  await rows.first().locator('a[href^="/validator/"]').first().click();
  await expect(page.getByRole("heading", { name: "Consensus key" })).toBeVisible();
  await expect(page.locator("dl").getByText("ML-DSA-44", { exact: true })).toBeVisible();
  await expect(page.getByText("Current key ID", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Quantum candidate accounts expose public authority roles from live state", async ({ page }) => {
  test.skip(!process.env.TOSCAN_QUANTUM_WALLET, "Requires separately funded candidate genesis accounts");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/address/${process.env.TOSCAN_QUANTUM_WALLET}`);
  const evidence = page.getByRole("region", { name: "Account cryptography" });
  await expect(evidence.getByText("Quantum Wallet · Code hash matched")).toBeVisible();
  await expect(evidence.getByText("ML-DSA-44", { exact: true })).toBeVisible();
  await expect(evidence.getByText("SLH-DSA-SHA2-128s", { exact: true })).toBeVisible();
  await expect(evidence.getByText("Stateful HSS/LMS H20/W4", { exact: true })).toBeVisible();
  await expect(evidence.getByText("Disabled; inert V5 field is zero", { exact: true })).toBeVisible();
  await expect(evidence.getByText("fee / fee tree id", { exact: true })).toBeVisible();
  await page.goto(`/address/${process.env.TOSCAN_QUANTUM_VAULT}`);
  await expect(page.getByRole("region", { name: "Account cryptography" }).getByText("next leaf", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
