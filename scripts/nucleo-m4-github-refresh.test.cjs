#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { buildManifest } = require("./nucleo-m4-github-refresh.cjs");
const root = "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/";
const baseline = [
  { code: "NUC-M1", kind: "pull_request", id: 608 },
  { code: "NUC-M3", kind: "workflow_run", id: 43103257248 },
];
const mock = async (url) => {
  if (url.endsWith("/pulls/608")) return {
    ok: true, json: async () => ({
      number: 608, html_url: root + "pull/608", title: "M1",
      merged_at: "2026-11-11T14:00:00Z", merge_commit_sha: "a".repeat(40),
    }),
  };
  if (url.endsWith("/actions/runs/43103257248")) return {
    ok: true, json: async () => ({
      id: 43103257248, html_url: root + "actions/runs/43103257248",
      name: "M3", conclusion: "success", head_sha: "b".repeat(40),
    }),
  };
  throw new Error("Unexpected API request");
};
async function test() {
  const manifest = await buildManifest(mock, "", baseline);
  assert.equal(manifest.records.length, 2);
  assert.equal(manifest.read_only, true);
  assert.equal(manifest.requires_human_review, true);
  assert.equal(manifest.has_discrepancy, false);
  assert.equal(manifest.records[0].workstream_code, "NUC-M1");
  assert.equal(manifest.records[1].source_status, "success");

  const altered = await buildManifest(async url => {
    const response = await mock(url);
    if (url.endsWith("/pulls/608")) {
      const data = await response.json();
      data.merged_at = null;
      data.state = "open";
      return { ok: true, json: async () => data };
    }
    return response;
  }, "", baseline);
  assert.equal(altered.has_discrepancy, true);
  assert.equal(altered.records[0].verified_at_source, false);

  await assert.rejects(() => buildManifest(async url => {
    const response = await mock(url);
    if (url.endsWith("/pulls/608")) {
      const data = await response.json();
      data.number = 999;
      return { ok: true, json: async () => data };
    }
    return response;
  }, "", baseline), /identity mismatch/);

  await assert.rejects(() => buildManifest(async () => ({
    ok: false, status: 403,
  }), "", baseline), /HTTP 403/);
  console.log("M4 refresh: 4 cenários sintéticos aprovados; nenhuma conexão de escrita.");
}
test().catch(error => { console.error(error); process.exitCode = 1; });
