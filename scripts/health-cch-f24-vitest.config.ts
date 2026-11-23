import {defineConfig} from "vitest/config";
import path from "node:path";
export default defineConfig({
 resolve:{alias:{"@":path.resolve(process.cwd(),"src")}},
 esbuild:{jsx:"automatic"},
 test:{environment:"jsdom",include:["scripts/health-cch-f24-f19-interaction.test.tsx"],maxWorkers:1}
});
