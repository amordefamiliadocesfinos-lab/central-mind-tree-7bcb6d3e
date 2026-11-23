import { defineConfig } from "@playwright/test";
export default defineConfig({
 testDir:".",testMatch:"g5e.browser.spec.mjs",workers:1,retries:0,timeout:60_000,
 use:{baseURL:"http://127.0.0.1:4177",headless:true,trace:"retain-on-failure",screenshot:"only-on-failure"},
 reporter:[["list"],["json",{outputFile:"test-results/g5e-results.json"}]],
 webServer:{command:"npx vite --config scripts/health-cch-f24-g5e/vite.config.ts",
   url:"http://127.0.0.1:4177",reuseExistingServer:false,timeout:45_000},
 outputDir:"test-results/g5e-traces"
});
