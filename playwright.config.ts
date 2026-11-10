// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "@playwright/test";

const basePath = process.env.SITE_BASE_PATH ?? "";
const baseURL = `http://127.0.0.1:4322${basePath === "/" ? "" : basePath}/`;

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "list",
  use: {
    baseURL,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: "node tools/serve-dist.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
