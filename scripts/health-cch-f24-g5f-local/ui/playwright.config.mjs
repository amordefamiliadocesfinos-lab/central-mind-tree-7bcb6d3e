import {defineConfig} from "@playwright/test";
export default defineConfig({
 testDir:".",testMatch:"browser.spec.mjs",workers:1,retries:0,timeout:70_000,
 use:{baseURL:"http://127.0.0.1:4181",headless:true,screenshot:"only-on-failure",trace:"off"},
 reporter:[["list"],["json",{outputFile:"test-results/g5f-browser-results.json"}]],
 webServer:{cwd:process.cwd(),command:"npx vite --config scripts/health-cch-f24-g5f-local/ui/vite.config.ts",
  url:"http://127.0.0.1:4181",reuseExistingServer:false,timeout:60_000},
 outputDir:"test-results/g5f-browser-traces"
});
