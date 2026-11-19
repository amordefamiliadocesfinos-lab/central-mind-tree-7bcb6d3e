import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const vite=readFileSync("vite.config.ts","utf8");
const page=readFileSync("src/modules/health/pages/HealthProgramPage.tsx","utf8");
const build=readFileSync("src/modules/health/cch/buildProvenance.ts","utf8");
test("build config stamps source revision but does not invent it",()=>{
 assert.match(vite,/__CCH_BUILD_COMMIT__/);
 assert.match(vite,/git.*rev-parse/);
 assert.match(vite,/return "";/);
});
test("E2 view reveals read-only source SHA to Work",()=>{
 assert.match(page,/data-testid="cch-e2-build-revision"/);
 assert.match(page,/data-cch-build-commit/);
 assert.match(page,/Código servido:/);
});
test("only a full SHA is accepted",()=>{
 assert.match(build,/\[0-9a-f\]\{40\}/);
 assert.match(build,/shortRevision: revision\?\.slice\(0,12\)/);
 assert.match(build,/known: revision !== null/);
});
