#!/usr/bin/env node
"use strict";
/**
 * Núcleo M4: preflight de fontes GitHub, somente leitura.
 * Produz um manifesto revisável; jamais grava no Supabase ou muda status das frentes.
 */
const fs = require("node:fs");
const path = require("node:path");
const ROOT = "amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const API = "https://api.github.com/repos/" + ROOT;
const BASELINE = [
  { code: "NUC-M1", kind: "pull_request", id: 608 },
  { code: "NUC-M2", kind: "pull_request", id: 611 },
  { code: "NUC-M3", kind: "pull_request", id: 614 },
  { code: "NUC-M3", kind: "pull_request", id: 619 },
  { code: "NUC-M1", kind: "workflow_run", id: 43094643388 },
  { code: "NUC-M3", kind: "workflow_run", id: 43103257248 },
  { code: "NUC-M3", kind: "workflow_run", id: 43108556183 },
];

function assertIdentity(value, expected) {
  if (!Number.isSafeInteger(value) || value !== expected) {
    throw new Error("GitHub source identity mismatch: " + expected);
  }
}
async function apiGet(endpoint, fetchImpl, token) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetchImpl(API + endpoint, { headers });
  if (!response.ok) throw new Error("GitHub API HTTP " + response.status + " for " + endpoint);
  const body = await response.json();
  if (!body || typeof body !== "object") throw new Error("Malformed GitHub response");
  return body;
}
async function buildManifest(fetchImpl, token, baseline = BASELINE) {
  const capturedAt = new Date().toISOString();
  const records = [];
  let needsReview = false;
  for (const entry of baseline) {
    const endpoint = entry.kind === "pull_request" ? "/pulls/" + entry.id : "/actions/runs/" + entry.id;
    const item = await apiGet(endpoint, fetchImpl, token);
    if (entry.kind === "pull_request") assertIdentity(item.number, entry.id);
    else assertIdentity(item.id, entry.id);
    const url = item.html_url;
    const expectedPrefix = "https://github.com/" + ROOT + "/";
    if (typeof url !== "string" || !url.startsWith(expectedPrefix)) {
      throw new Error("Unexpected GitHub source URL for " + entry.id);
    }
    const status = entry.kind === "pull_request"
      ? (item.merged_at ? "merged" : item.state)
      : item.conclusion || item.status;
    const expected = entry.kind === "pull_request" ? "merged" : "success";
    const verified = status === expected;
    if (!verified) needsReview = true;
    records.push({
      workstream_code: entry.code,
      source: "github",
      kind: entry.kind,
      external_key: String(entry.id),
      reference_url: url,
      title: String(item.title || item.name || entry.kind).slice(0, 260),
      source_observed_at: item.updated_at || item.run_started_at || null,
      checked_at: capturedAt,
      verified_at_source: verified,
      source_status: status,
      source_sha: entry.kind === "pull_request" ? item.merge_commit_sha || null : item.head_sha || null,
    });
  }
  return {
    schema_version: "nucleo-m4-refresh-manifest-v1",
    read_only: true,
    requires_human_review: true,
    has_discrepancy: needsReview,
    source: "github-api",
    repository: ROOT,
    checked_at: capturedAt,
    records,
    caveats: [
      "Nenhum registro foi gravado no Core ou em qualquer banco.",
      "Os dados representam somente o estado da fonte no horário indicado.",
      "Conferência não altera o estado das frentes ou seus critérios de aceite.",
      "Migrations Supabase exigem inspeção independente e não são inferidas pelo GitHub.",
    ],
  };
}
async function main() {
  const manifest = await buildManifest(global.fetch, process.env.GITHUB_TOKEN);
  const target = process.env.M4_MANIFEST_OUTPUT || "nucleo-m4-gh-refresh-manifest.json";
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2) + "\n", { flag: "w" });
  console.log("M4: fontes conferidas=" + manifest.records.length +
    ", divergência=" + manifest.has_discrepancy + "; manifesto somente leitura gerado.");
}
if (require.main === module) {
  main().catch(error => { console.error("M4 refresh failed:", error.message); process.exitCode = 1; });
}
module.exports = { buildManifest };
