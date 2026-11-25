#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const helper = fs.readFileSync("src/lib/nucleo/m4EvidenceWindow.ts", "utf8");
const js = ts.transpileModule(helper, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText;
const scope = {exports: {}};
vm.runInNewContext(js, scope, {timeout: 1000});
const {M4_EVIDENCE_VISIBLE_LIMIT: limit, projectM4EvidenceWindow: project} = scope.exports;
assert.equal(limit, 100);
for (const size of [0, 1, 99, 100, 101, 125]) {
  const sample = Array.from({length: size}, (_, i) => i);
  const window = project(sample);
  assert.equal(window.visible.length, Math.min(size, 100), "visible " + size);
  assert.equal(window.hasMore, size > 100, "partial " + size);
  assert.equal(window.visible[0], size > 0 ? 0 : undefined);
  assert.equal(window.visible.at(-1), size > 0 ? Math.min(size, 100) - 1 : undefined);
}
const source = fs.readFileSync("src/components/nucleo/NucleoTechnicalEvidence.tsx", "utf8");
assert.match(source, /\.limit\(M4_EVIDENCE_VISIBLE_LIMIT \+ 1\)/);
assert.match(source, /projectM4EvidenceWindow\(returned\)/);
assert.match(source, /setHasMore\(!result\.error && window\.hasMore\)/);
assert.match(source, /Recorte parcial: existem mais de 100 evidências acessíveis/);
assert.match(source, /não representa o histórico completo/);
assert.match(source, /Nenhuma evidência encontrada no recorte autorizado/);
assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
const detail = scope.exports.projectM4SourceDetails;
const a = "a".repeat(40), b = "b".repeat(40);
assert.equal(detail("pull_request", {merge_commit_sha:a}, "948").sha,a);
assert.equal(detail("pull_request", {merge_sha:b}, "625").sha,b);
assert.equal(detail("pull_request", {merge_commit_sha:a,merge_sha:a.toUpperCase()}, "789").sha,a);
assert.equal(detail("pull_request", {merge_commit_sha:a,merge_sha:b}, "789").sha,null);
assert.equal(detail("pull_request", {merge_commit_sha:"invalid"}, "789").conflict,true);
assert.equal(detail("workflow_run", {head_sha:b}, "123").sha,b);
assert.equal(detail("commit", {}, a).sha,a);
assert.equal(detail("migration", {head_sha:a}, "20261111234500").sha,null);
assert.equal(detail("pull_request", {}, "948").sha,null);
assert.match(source,/catch\s*\{\s*if \(cancelled\) return;\s*setRecords\(\[\]\);\s*setHasMore\(false\);\s*setError\(true\)/);
assert.match(source,/finally\s*\{\s*if \(!cancelled\) setLoading\(false\)/);
assert.match(source,/const current = loadedScope === scope/);
assert.match(source,/current && !loading && !error && groups\.map/);
assert.match(source,/projectM4SourceDetails\(record\.kind, record\.snapshot, record\.external_key\)/);
console.log("UX/NT-06: janela 0/1/99/100/>100, RLS e mensagens de recorte PASS");
