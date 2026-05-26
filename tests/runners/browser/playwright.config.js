// tests/runners/browser/playwright.config.js — minimal Playwright config
// for tier-3 CI: drive web/public/ in headless Chrome + Firefox, assert
// the rendered trace cells against the same references the Node runner
// uses. Skeleton — `npm i @playwright/test` to populate node_modules.

module.exports = {
  testDir: __dirname,
  use: { baseURL: "http://localhost:8080" },
  webServer: {
    command: "cd ../../.. && make serve",
    url: "http://localhost:8080",
    timeout: 30000,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox",  use: { browserName: "firefox" } },
  ],
};
