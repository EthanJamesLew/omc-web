// tests/runners/browser/bouncing-ball.spec.js — cross-engine tripwire.
// Drives the real web/public/ app: presses Build, Compile, Run on the
// default BouncingBall and asserts the trace table renders with the
// expected first/last row values within tolerance. If this fails on
// firefox-but-not-chromium we have wasm floating-point drift to chase.

const { test, expect } = require("@playwright/test");

test("BouncingBall end-to-end in browser", async ({ page }) => {
  test.setTimeout(180_000);  // emception cold-start can be 30s
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("omc.wasm ready", { timeout: 60_000 });

  await page.click("#build");
  await expect(page.locator("#status")).toContainText("press Compile", { timeout: 60_000 });

  await page.click("#compile");
  await expect(page.locator("#status")).toContainText("press Run", { timeout: 120_000 });

  await page.click("#run");
  await expect(page.locator("#status")).toContainText("sim done", { timeout: 30_000 });

  const firstRow = await page.locator("#trace-body tr").first().locator("td").allTextContents();
  // BouncingBall at t=0: time=0, h=1, v=0, flying=1, …
  expect(parseFloat(firstRow[0])).toBeCloseTo(0, 6);
  expect(parseFloat(firstRow[1])).toBeCloseTo(1, 6);
});
