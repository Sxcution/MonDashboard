const fs = require("node:fs");
const { test, expect } = require("@playwright/test");

const base = process.env.DASHBOARD_BASE_URL || "http://127.0.0.1:5000";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const launchOptions = fs.existsSync(chromePath)
  ? { executablePath: chromePath, args: ["--no-sandbox"] }
  : { args: ["--no-sandbox"] };

test.use({
  browserName: "chromium",
  launchOptions
});

for (const path of ["/", "/mxh", "/notes", "/image/", "/settings/", "/telegram"]) {
  test(`dashboard smoke ${path}`, async ({ page }) => {
    const failures = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") failures.push(`console: ${msg.text()}`);
    });
    page.on("response", (response) => {
      const url = response.url();
      const status = response.status();
      if (status >= 400 && (/\.(js|css)$/.test(url) || url.includes("/static/"))) {
        failures.push(`${status}: ${url}`);
      }
    });

    const response = await page.goto(base + path, { waitUntil: "domcontentloaded" });
    expect(response.status()).toBeLessThan(400);
    await page.waitForTimeout(700);
    expect(failures, failures.join("\n")).toEqual([]);
  });
}
