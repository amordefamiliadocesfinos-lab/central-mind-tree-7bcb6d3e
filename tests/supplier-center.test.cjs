const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the component's handlers with deferred Supabase responses. No real data is written.
function harness() {
  const state = [], refs = [], effects = [], requests = [], messages = [], storageCalls = [], opened = [];
  let cursor = 0, tree;
  const react = {
    useState(initial) { const n = cursor++; if (!(n in state)) state[n] = initial; return [state[n], v => { state[n] = typeof v === 'function' ? v(state[n]) : v; }]; },
    useRef(initial) { const n = cursor++; return refs[n] ??= { current: initial }; },
    useMemo(fn) { cursor++; return fn(); },
    useCallback(fn) { const n = cursor++; return refs[n] ??= fn; },
    useEffect(fn, deps) { const n = cursor++; const prev = effects[n]; if (!prev || deps.some((v, i) => v !== prev.deps[i])) effects[n] = { fn, deps, pending: true }; },
  };
  function request(table) {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    const q = { table, resolve, method: 'select', payload: null, id: null };
    requests.push(q);
    const builder = {
      select() { return this; }, eq(_, id) { q.id = id; return this; }, order() { return this; }, maybeSingle() { return this; },
      upsert(payload) { q.method = 'upsert'; q.payload = payload; return this; },
      insert(payload) { q.method = 'insert'; q.payload = payload; return this; },
      then: promise.then.bind(promise),
    };
    return builder;
  }
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const source = fs.readFileSync('src/components/operations/SupplierCenter.tsx', 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const storage = { from(bucket) { return {
    async upload(path, file, options) { storageCalls.push({ method: 'upload', bucket, path, file, options }); return { error: null }; },
    async remove(paths) { storageCalls.push({ method: 'remove', bucket, paths }); return { error: null }; },
    async createSignedUrl(path, seconds) { storageCalls.push({ method: 'sign', bucket, path, seconds }); return { data: { signedUrl: 'https://example.test/signed' }, error: null }; },
  }; } };
  vm.runInNewContext(code, { exports, crypto: { randomUUID: () => 'test-id' }, window: { open: (...args) => opened.push(args) }, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'date-fns') return { format: require('date-fns').format };
    if (name === 'sonner') return { toast: { success: s => messages.push(s), error: s => messages.push(s) } };
    if (name.endsWith('/client')) return { supabase: { from: request, storage } };
    if (name.endsWith('/useContacts')) return { useContacts: () => ({ loading: false, contacts: ['A', 'B'].map(id => ({ id, name: id, is_active: true, type: 'fornecedor' })) }) };
    return new Proxy({}, { get: (_, key) => key });
  } });
  function render() { cursor = 0; tree = exports.SupplierCenter(); for (const e of effects) if (e?.pending) { e.pending = false; e.fn(); } return tree; }
  function descendants(node) { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(descendants)]; }
  function nodes() { return descendants(tree); }
  function text(node) { if (node == null || typeof node === 'boolean') return ''; return typeof node === 'string' || typeof node === 'number' ? String(node) : [node.props?.children].flat(Infinity).map(text).join(''); }
  function button(label) { return nodes().find(n => n.type === 'Button' && text(n).trim() === label); }
  function input(label) { return nodes().find(n => n.props?.['aria-label'] === label); }
  async function flush() { await new Promise(r => setImmediate(r)); render(); }
  function select(id) { button(id).props.onClick(); render(); }
  async function finishReads(id, note = id, documents = []) { for (const q of requests.filter(q => q.method === 'select' && q.id === id)) q.resolve({ error: null, data: q.table === 'supplier_procurement_profiles' ? { supplier_contact_id: id, notes: note, lifecycle_status: 'prospectado' } : q.table === 'supplier_documents' ? documents : [] }); await flush(); }
  render();
  return { render, nodes, button, input, select, finishReads, flush, requests, messages, storageCalls, opened };
}

test('late A load cannot replace B; drafts reset on supplier selection', async () => {
  const h = harness(); h.select('A'); h.select('B');
  await h.finishReads('B', 'current B'); await h.finishReads('A', 'old A');
  assert.equal(h.nodes().find(n => n.type === 'Textarea').props.value, 'current B');
  h.input('Descrição original').props.onChange({ target: { value: 'B draft' } }); h.render();
  h.select('A'); assert.equal(h.input('Descrição original').props.value, '');
});

test('late catalog save across A → B → A preserves the current draft', async () => {
  const h = harness(); h.select('A'); await h.finishReads('A');
  h.input('Descrição original').props.onChange({ target: { value: 'old item' } }); h.render();
  h.button('Adicionar item').props.onClick(); await h.flush();
  const save = h.requests.find(q => q.method === 'insert');
  assert.equal(save.table, 'supplier_catalog_items');
  assert.equal(save.payload.product_id, undefined);
  h.select('B'); await h.finishReads('B'); h.select('A'); await h.finishReads('A');
  h.input('Descrição original').props.onChange({ target: { value: 'new draft' } }); h.render();
  save.resolve({ error: null }); await h.flush();
  assert.equal(h.input('Descrição original').props.value, 'new draft');
  assert.equal(h.messages.length, 0);
});

test('failed load keeps writes disabled', async () => {
  const h = harness(); h.select('A');
  for (const q of h.requests) q.resolve({ error: { message: 'denied' }, data: null });
  await h.flush();
  assert.equal(h.nodes().find(n => n.type === 'fieldset').props.disabled, true);
  h.button('Criar perfil').props.onClick(); await h.flush();
  assert.equal(h.requests.filter(q => q.method === 'upsert').length, 0);
});

test('late profile save does not reload or overwrite B', async () => {
  const h = harness(); h.select('A'); await h.finishReads('A');
  h.button('Salvar alterações').props.onClick(); await h.flush();
  const save = h.requests.find(q => q.method === 'upsert');
  assert.equal(save.payload.supplier_contact_id, 'A');
  h.select('B'); await h.finishReads('B', 'B notes');
  const count = h.requests.length; save.resolve({ error: null }); await h.flush();
  assert.equal(h.requests.length, count);
  assert.equal(h.nodes().find(n => n.type === 'Textarea').props.value, 'B notes');
});

test('upload uses private supplier prefix; failed metadata triggers cleanup', async () => {
  const h = harness(); h.select('A'); await h.finishReads('A');
  h.input('Selecionar documento').props.onChange({ target: { files: [{ name: 'catalog test.txt', type: 'text/plain', size: 4 }] } }); h.render();
  h.button('Enviar').props.onClick(); await h.flush();
  const upload = h.storageCalls[0];
  assert.equal(upload.bucket, 'order-documents'); assert.match(upload.path, /^suppliers\/A\//);
  assert.equal(upload.options.upsert, false);
  const metadata = h.requests.find(q => q.method === 'insert');
  assert.equal(metadata.table, 'supplier_documents');
  metadata.resolve({ error: { message: 'metadata denied' } }); await h.flush();
  assert.equal(h.storageCalls[1].method, 'remove');
  assert.equal(h.storageCalls[1].paths[0], upload.path);
  assert.equal(h.messages[0], 'metadata denied');
});

test('document opens only via short-lived signed URL', async () => {
  const h = harness(); h.select('A'); await h.finishReads('A', 'A', [{ id: 'doc', file_name: 'test.txt', storage_bucket: 'order-documents', storage_path: 'suppliers/A/test.txt' }]);
  h.button('Abrir').props.onClick(); await h.flush();
  assert.equal(h.storageCalls[0].method, 'sign'); assert.equal(h.storageCalls[0].seconds, 60);
  assert.equal(h.opened[0][0], 'https://example.test/signed');
  assert.equal(h.opened[0][2], 'noopener,noreferrer');
});
