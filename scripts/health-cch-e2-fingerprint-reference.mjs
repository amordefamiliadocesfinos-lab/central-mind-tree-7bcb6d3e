import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const paths = [
  "vite.config.ts",
  "src/modules/health/pages/HealthProgramPage.tsx",
  "src/modules/health/cch/buildProvenance.ts",
  "src/modules/health/cch/e2Preflight.ts",
  "src/modules/health/cch/equipmentChoices.ts",
  "src/modules/health/cch/prescriptionE2.ts",
  "src/modules/health/hooks/useHealthProgramM3.ts",
];
const hash=createHash("sha256");
for(const file of paths){
 hash.update(file,"utf8");hash.update("\\0");
 hash.update(readFileSync(file));hash.update("\\0");
}
const digest=hash.digest("hex");
console.log("CCH_E2_SOURCE_FINGERPRINT_SHA256="+digest);
console.log("CCH_E2_FINGERPRINT_SCOPE="+paths.join(","));
