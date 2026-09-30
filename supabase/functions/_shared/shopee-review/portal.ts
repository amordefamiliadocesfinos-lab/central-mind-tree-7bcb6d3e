export const REVIEW_COOKIE_NAME = '__Host-pc-shopee-review';
export const REVIEW_TTL_SECONDS = 30 * 60;

export const reviewFixtures = {
  accounts: [
    { name: 'Loja Shopee Demonstração PJ', shopId: 'DEMO-PJ-001', status: 'Autorização pendente', scope: 'Pedidos, catálogo e logística' },
    { name: 'Loja Shopee Demonstração CPF', shopId: 'DEMO-CPF-002', status: 'Autorização simulada', scope: 'Tokens independentes por loja' },
  ],
  orders: [
    { id: 'DEMO-ORDER-1001', buyer: 'Cliente Demonstração', status: 'Aguardando separação', logistics: 'Coleta simulada' },
    { id: 'DEMO-ORDER-1002', buyer: 'Cliente Demonstração', status: 'Expedido (simulado)', logistics: 'Transportadora demonstrativa' },
  ],
  products: [
    { name: 'Alfajor 60 g', variation: 'Branco', conversion: 'Caixa com 18 unidades' },
    { name: 'Trufa 30 g', variation: 'Meio Amargo', conversion: 'Caixa com 30 unidades' },
  ],
};

export function routeFromRequestPath(pathname: string) {
  const marker = '/shopee-review-auth';
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return '/';
  const suffix = pathname.slice(markerIndex + marker.length).replace(/\/+$/u, '');
  return suffix || '/';
}

export function parseCookie(cookieHeader: string | null, name = REVIEW_COOKIE_NAME) {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const part = cookieHeader.split(';').map((value) => value.trim()).find((value) => value.startsWith(prefix));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(prefix.length)); } catch { return null; }
}

export function sessionCookie(value: string, expiresAt: string) {
  const expires = new Date(expiresAt);
  const maxAge = Math.max(0, Math.min(REVIEW_TTL_SECONDS, Math.floor((expires.getTime() - Date.now()) / 1000)));
  return `${REVIEW_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Expires=${expires.toUTCString()}`;
}

export function expiredSessionCookie() {
  return `${REVIEW_COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function securityHeaders(nonce: string, contentType: string) {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'; img-src 'self' data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}

const pageScript = `(() => {
  const byId = (id) => document.getElementById(id);
  const basePath = location.pathname.replace(/\\/$/, '');
  const request = async (path, options = {}) => {
    const response = await fetch(basePath + path, { credentials: 'same-origin', ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a solicitação.');
    return body;
  };
  const showLogin = () => { byId('login').hidden = false; byId('review').hidden = true; };
  const showReview = async () => {
    const data = await request('/data');
    byId('accounts').textContent = data.accounts.map((item) => item.name + ' — ' + item.status).join('\\n');
    byId('orders').textContent = data.orders.map((item) => item.id + ' — ' + item.status + ' — ' + item.logistics).join('\\n');
    byId('products').textContent = data.products.map((item) => item.name + ' / ' + item.variation + ' — ' + item.conversion).join('\\n');
    byId('login').hidden = true; byId('review').hidden = false;
  };
  byId('login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); byId('login-error').textContent = '';
    const form = new FormData(event.currentTarget);
    try { await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) }); await showReview(); }
    catch (error) { byId('login-error').textContent = error.message; }
  });
  byId('logout').addEventListener('click', async () => { try { await request('/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } finally { showLogin(); } });
  request('/session').then(showReview).catch(showLogin);
})();`;

export function renderPortalPage(nonce: string, portalAvailable: boolean) {
  const availability = portalAvailable ? '' : '<p class="notice">Portal temporariamente indisponível.</p>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Painel Central · Revisão Shopee</title><style nonce="${nonce}">:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0f172a;color:#e2e8f0;font:16px system-ui,sans-serif}.shell{max-width:920px;margin:auto;padding:48px 20px}.card{background:#172033;border:1px solid #334155;border-radius:14px;padding:24px;margin-top:20px}h1{margin:0;font-size:24px}h2{font-size:18px;margin-top:0}.sub,.notice{color:#cbd5e1}.notice{color:#fbbf24}label{display:block;margin:14px 0 5px}input,button{font:inherit;border-radius:8px;padding:10px}input{display:block;width:100%;border:1px solid #475569;background:#0f172a;color:#fff}button{margin-top:18px;border:0;background:#f97316;color:#171717;font-weight:700;cursor:pointer}pre{white-space:pre-wrap;line-height:1.7;background:#0f172a;padding:14px;border-radius:8px}#login-error{color:#fca5a5;min-height:1.3em}</style></head><body><main class="shell"><h1>Painel Central · Ambiente de Revisão Shopee</h1><p class="sub">Demonstração isolada, temporária e somente leitura. Nenhum dado operacional, cliente ou token real é exibido.</p>${availability}<section id="login" class="card"><h2>Acesso de revisão</h2><form id="login-form" novalidate><label for="username">Identificador de revisão</label><input id="username" name="username" autocomplete="username" required><label for="password">Senha temporária</label><input id="password" name="password" type="password" autocomplete="current-password" required><p id="login-error" role="alert"></p><button type="submit">Acessar ambiente demonstrativo</button></form></section><section id="review" class="card" hidden><div><h2>Visão demonstrativa</h2><p class="sub">Dados sintéticos · somente leitura · sem ações operacionais</p></div><h2>Contas</h2><pre id="accounts"></pre><h2>Pedidos</h2><pre id="orders"></pre><h2>Catálogo</h2><pre id="products"></pre><button id="logout" type="button">Encerrar sessão</button></section></main><script nonce="${nonce}">${pageScript}</script></body></html>`;
}
