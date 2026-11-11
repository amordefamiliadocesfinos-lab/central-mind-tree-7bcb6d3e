/* Run from repository root: node scripts/nucleo-backup-smoke.cjs
 * Isolated synthetic tests: never accesses production/browser user content. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto, createHash } = require('node:crypto');
const ts = require('typescript');

const filename = path.resolve(process.cwd(), 'src/lib/nucleo/exportLegacyNucleo.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function attempt(seed) {
  const storage = new Map(Object.entries(seed));
  const before = JSON.stringify([...storage.entries()]);
  const downloads = [];
  let removed = false;
  let revoked = false;
  let objectBlob;
  const fakeWindow = { localStorage: {
    get length() { return storage.size; },
    key(index) { return [...storage.keys()][index] ?? null; },
    getItem(key) { return storage.get(key) ?? null; },
    setItem() { throw new Error('Unexpected write'); },
    removeItem() { throw new Error('Unexpected removal'); },
  }, crypto: webcrypto };
  const fakeDocument = {
    body: { appendChild() {} },
    createElement: () => ({
      set href(v) {},
      set download(v) { downloads.push(v); },
      click() {},
      remove() { removed = true; }
    })
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, window: fakeWindow, document: fakeDocument, Blob,
    TextEncoder, Date,
    URL: { createObjectURL(blob) { objectBlob = blob; return 'blob:test'; },
           revokeObjectURL() { revoked = true; } }
  }, { filename: 'exportLegacyNucleo.js' });
  let response, error;
  try { response = await exports.exportLegacyNucleo(); }
  catch (e) { error = e; }
  assert.equal(JSON.stringify([...storage.entries()]), before, 'export modified the original storage');
  return { response, error, objectBlob, downloads, removed, revoked };
}

(async () => {
  const raw = JSON.stringify([{ id: 'legado-1', areaId: 'biblioteca', title: 'Documento íntegro',
    content: 'áé💾', versions: [{ id: 'v1', content: 'texto anterior' }] }]);
  const ok = await attempt({
    'nucleo_painel_central_pages_v3': raw,
    'nucleo_biblioteca_seed_v1': '1',
    'not_nucleo_private': 'do not export'
  });
  assert.equal(ok.response.pageCount, 1);
  assert.equal(ok.response.keyCount, 2);
  assert(ok.removed && ok.revoked, 'temporary download resources were not cleaned');
  assert.match(ok.downloads[0], /^NUCLEO_LEGADO_BACKUP_/);
  const snapshot = JSON.parse(await ok.objectBlob.text());
  assert.equal(snapshot.entries['nucleo_painel_central_pages_v3'], raw);
  assert.equal(snapshot.entries['not_nucleo_private'], undefined);
  assert.equal(snapshot.pagesRawSha256, createHash('sha256').update(raw).digest('hex'));
  const invalid = await attempt({ 'nucleo_painel_central_pages_v3': '{broken' });
  assert(invalid.error && !invalid.objectBlob, 'malformed JSON should fail closed');
  const missing = await attempt({ 'nucleo_principios_seed_v1': '1' });
  assert(missing.error && !missing.objectBlob, 'missing pages should fail closed');
  console.log('Núcleo M0 backup: 3 cenários sintéticos aprovados; sem escrita no armazenamento.');
})().catch(e => { console.error(e); process.exitCode = 1; });
