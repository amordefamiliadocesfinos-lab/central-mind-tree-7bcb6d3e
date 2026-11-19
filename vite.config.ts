import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// A source-build fingerprint for authenticated WORK read-only deployment checks.
// Do not invent a SHA when building from an exported tree without .git.
function cchSourceRevision(): string {
  for (const value of [process.env.CCH_SOURCE_COMMIT,process.env.GITHUB_SHA]) {
    if (typeof value === "string" && /^[0-9a-f]{40}$/i.test(value)) return value.toLowerCase();
  }
  try {
    const value=execFileSync("git",["rev-parse","HEAD"],{
      cwd:__dirname,encoding:"utf8",timeout:3000,stdio:["ignore","pipe","ignore"]
    }).trim();
    if (/^[0-9a-f]{40}$/i.test(value)) return value.toLowerCase();
  } catch {
    // Source package lacks a revision: report unknown rather than guessing.
  }
  return "";
}


// The Lovable Cloud builder may receive source without Git metadata. This
// deterministic file-content fingerprint is independent of env vars and .git.
// It is a scoped content check, NOT a Git commit and NOT an all-app checksum.
const cchFingerprintPaths = [
  "vite.config.ts",
  "src/modules/health/pages/HealthProgramPage.tsx",
  "src/modules/health/cch/buildProvenance.ts",
  "src/modules/health/cch/e2Preflight.ts",
  "src/modules/health/cch/equipmentChoices.ts",
  "src/modules/health/cch/prescriptionE2.ts",
  "src/modules/health/hooks/useHealthProgramM3.ts",
];
function cchSourceFingerprint(): string {
  try {
    const hash = createHash("sha256");
    for (const relativePath of cchFingerprintPaths) {
      hash.update(relativePath, "utf8");
      hash.update("\\0");
      hash.update(readFileSync(path.resolve(__dirname, relativePath)));
      hash.update("\\0");
    }
    return hash.digest("hex");
  } catch {
    // Never claim an identity when a source input is missing.
    return "";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [tanstackStart(), react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  environments: {
    ssr: {
      build: {
        // Keep internal shared exports out of the public Worker entrypoint.
        rollupOptions: { preserveEntrySignatures: "strict" },
      },
    },
  },
  define: {
    __CCH_BUILD_COMMIT__: JSON.stringify(cchSourceRevision()),
    __CCH_BUILD_FINGERPRINT__: JSON.stringify(cchSourceFingerprint()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  // A hospedagem publicada não resolve pacotes em tempo de execução:
  // no build o servidor precisa sair com todas as dependências embutidas.
  // Em desenvolvimento o Vite resolve os pacotes normalmente.
  ...(command === "build" ? { ssr: { noExternal: true } } : {}),
}));
