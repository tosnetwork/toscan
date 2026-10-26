import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const upstream = process.env.TOS_RPC_UPSTREAM ?? "http://127.0.0.1:52747";
test("shows native finality and downloads a pinned proof only on demand", async ({ page, request }, testInfo) => {
  const info = await (await request.post(`${upstream}/getMasterchainInfo`, { data: {} })).json();
  const block = info.result.last;
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const calls: Array<{ block_id: unknown; with_proof?: boolean }> = [];
  page.on("request", (request) => { const body = request.method() === "POST" ? request.postDataJSON() : null; if (body?.method === "getMasterchainBlockSignatures") calls.push(body.params); });
  await page.goto(`/block/-1/${block.shard}/${block.seqno}`);
  const evidence = page.getByRole("region", { name: "Block finality evidence" });
  await expect(evidence.getByText("Node verified · anchored finality", { exact: true })).toBeVisible();
  await expect.poll(() => evidence.locator("tbody tr").count()).toBeGreaterThanOrEqual(2);
  expect(calls).toHaveLength(1); expect(calls[0]!.with_proof).toBe(false);
  const download = page.waitForEvent("download");
  await evidence.getByRole("button", { name: "Download finality proof" }).click();
  expect((await download).suggestedFilename()).toBe(`tos-finality-${block.seqno}.json`);
  expect(calls).toHaveLength(2); expect(calls[1]!.with_proof).toBe(true);
  expect(calls[1]!.block_id).toEqual(calls[0]!.block_id);
  await evidence.screenshot({ path: testInfo.outputPath("finality.png") });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
test("shows native account roles and effective protocol defaults", async ({ page }, testInfo) => {
  if (!process.env.TOSCAN_PQ_ACCOUNTS) throw new Error("TOSCAN_PQ_ACCOUNTS must name the public disposable account map");
  const accounts = JSON.parse(await readFile(process.env.TOSCAN_PQ_ACCOUNTS, "utf8"));
  await page.goto(`/address/${accounts.quantum_wallet_v4}`);
  const account = page.getByRole("region", { name: "Account cryptography" });
  await expect(account.getByText("Quantum Wallet · Code hash matched")).toBeVisible();
  await expect(account.getByText("ML-DSA-44", { exact: true })).toBeVisible();
  await expect(account.getByText("Disabled; inert V5 field is zero", { exact: true })).toBeVisible();
  await expect(page.getByText("Preview data", { exact: false })).toHaveCount(0);
  const proofDownload = page.waitForEvent("download");
  await account.getByRole("button", { name: "Download account proof" }).click();
  expect((await proofDownload).suggestedFilename()).toBe("tos-account-proof.json");
  await account.screenshot({ path: testInfo.outputPath("account.png") });
  await page.goto("/network");
  const protocol = page.getByRole("region", { name: "Post-quantum protocol evidence" });
  await expect(protocol.getByText("VM protocol version", { exact: true })).toBeVisible();
  await expect(protocol.getByText(/No committed override; native defaults apply\./)).toBeVisible();
  await protocol.screenshot({ path: testInfo.outputPath("protocol.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("shows self-pay wallet fees and exports its native account proof", async ({ page }, testInfo) => {
  if (!process.env.TOSCAN_PQ_ACCOUNTS) throw new Error("Missing public disposable account map");
  const accounts = JSON.parse(await readFile(process.env.TOSCAN_PQ_ACCOUNTS, "utf8"));
  await page.goto(`/address/${accounts.quantum_self_pay_v1}`);
  const account = page.getByRole("region", { name: "Account cryptography" });
  await expect(account.getByText("Quantum Self-pay Wallet · Code hash matched")).toBeVisible();
  await expect(account.getByText("Wallet balance (self-pay)", { exact: true })).toBeVisible();
  await expect(account.getByText("ML-DSA-44", { exact: true })).toBeVisible();
  await expect(account.getByText("SLH-DSA-SHA2-128s", { exact: true })).toBeVisible();
  await expect(account.getByText("18446744073709551615", { exact: true })).toBeVisible();
  await expect(account.getByText(/HSS\/LMS/)).toHaveCount(0);
  const download = page.waitForEvent("download");
  await account.getByRole("button", { name: "Download account proof" }).click();
  expect((await download).suggestedFilename()).toBe("tos-account-proof.json");
  await account.screenshot({ path: testInfo.outputPath("self-pay-account.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("refuses malformed recognized authority without showing partial fields", async ({ page }) => {
  if (!process.env.TOSCAN_PQ_ACCOUNTS) throw new Error("Missing public disposable account map");
  const accounts = JSON.parse(await readFile(process.env.TOSCAN_PQ_ACCOUNTS, "utf8"));
  await page.goto(`/address/${accounts.malformed_module}`);
  const account = page.getByRole("region", { name: "Account cryptography" });
  await expect(account.getByRole("alert")).toBeVisible();
  await expect(account.getByText("Code hash matched", { exact: false })).toHaveCount(0);
  await expect(account.getByRole("button", { name: "Download account proof" })).toHaveCount(0);
});
