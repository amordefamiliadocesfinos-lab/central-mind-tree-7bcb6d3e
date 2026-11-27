import {defineConfig} from "vitest/config";
import path from "node:path";
export default defineConfig({resolve:{alias:{"@":path.resolve(process.cwd(),"src")}},esbuild:{jsx:"automatic"},test:{environment:"jsdom",include:["scripts/health-sau-sx05-recovery.test.tsx"],maxWorkers:1}});
