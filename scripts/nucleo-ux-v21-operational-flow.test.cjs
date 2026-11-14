#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const code = fs.readFileSync("src/pages/Nucleo.tsx", "utf8");
function has(fragment, reason) { assert(code.includes(fragment), reason); }
// Opening a selected document must move the operator to the existing editor.
has('const openPage = (id: string) => {', "Dedicated open path");
has('onClick={() => openPage(page.id)}', "List click opens editor");
has('editor?.scrollIntoView({ behavior: "smooth", block: "start" })', "Direct editor scroll");
has('editor?.focus({ preventScroll: true })', "Keyboard focus after open");
has('id="nucleo-editor" tabIndex={-1}', "Focusable editor region");
// Creation must clear scoped search before focusing the new page.
assert.match(code, /setPages\(\(prev\) => \[page, \.\.\.prev\]\);[\s\S]{0,240}setSearch\(""\);[\s\S]{0,100}setActivePageId\(page\.id\);[\s\S]{0,90}revealPageEditor\(\)/);
// Central mounts only after first visit, but stays mounted when temporarily hidden.
has('const [developmentVisited, setDevelopmentVisited] = useState(false)', "Mount on demand");
has('if (!developmentMode) setDevelopmentVisited(true)', "Load on first visit");
has('(developmentMode || developmentVisited) &&', "Persist after visit");
has('<NucleoDevelopmentCenter />', "Existing functionality preserved");
has('hidden={!developmentMode}', "Hide Central without unmount");
has('hidden={developmentMode}', "Keep local document area mounted");
has('if (id === activeArea) return;', "Return same area without losing context");
// Local-only data must not imply global/Core certification.
has('Busca restrita à área', "Search scope explained");
has('não pesquisa todo o Núcleo nem o Core.', "No misleading global query");
has('localPageGroups.map(group => (', "Local category bar retained");
has('Não indicam vigência, aprovação, publicação ou cobertura canônica', "Authority disclaimer");
// Backups, version management and browsing remain.
for (const part of ['handleExportLegacy', '<NucleoDriveReferences />', 'onRestoreVersion={(vid)', 'onDeleteVersion={(vid)', 'onDelete={() => deletePage(activePage.id)}']) has(part, "Existing functionality: " + part);
console.log("UX V2.1: direct documents, scope, context, densities and inherited functions verified");
