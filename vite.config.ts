import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { execFileSync } from "node:child_process";

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
