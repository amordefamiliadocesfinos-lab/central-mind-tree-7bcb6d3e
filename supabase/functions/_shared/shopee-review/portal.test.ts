import { createNonce, expiredSessionCookie, parseCookie, renderPortalPage, REVIEW_COOKIE_NAME, routeFromRequestPath, securityHeaders, sessionCookie } from './portal.ts';

Deno.test('portal first-party produz cookie host-only seguro e com duração limitada', () => {
  const cookie = sessionCookie('opaque-session', new Date(Date.now() + 45 * 60 * 1000).toISOString());
  for (const clause of [`${REVIEW_COOKIE_NAME}=`, 'Path=/', 'Secure', 'HttpOnly', 'SameSite=Strict']) {
    if (!cookie.includes(clause)) throw new Error(`Cookie sem ${clause}`);
  }
  const maxAge = Number(cookie.match(/Max-Age=(\d+)/u)?.[1]);
  if (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > 1800) throw new Error('Cookie excede a duração máxima da sessão');
  if (cookie.includes('Domain=')) throw new Error('Cookie da revisão não pode definir Domain');
  if (parseCookie(`${cookie}; unrelated=value`) !== 'opaque-session') throw new Error('Sessão não foi lida exclusivamente do cookie');
  const expired = expiredSessionCookie();
  if (!expired.includes('Max-Age=0') || !expired.includes('HttpOnly')) throw new Error('Logout deve expirar cookie HttpOnly');
});

Deno.test('portal entrega HTML com CSP por nonce e sem dados de fixtures no HTML', () => {
  const nonce = createNonce();
  const headers = securityHeaders(nonce, 'text/html; charset=utf-8');
  const csp = headers['Content-Security-Policy'];
  for (const clause of ["default-src 'none'", "frame-ancestors 'none'", `script-src 'nonce-${nonce}'`, `style-src 'nonce-${nonce}'`]) {
    if (!csp.includes(clause)) throw new Error(`CSP sem ${clause}`);
  }
  const html = renderPortalPage(nonce, false);
  if (html.includes('DEMO-ORDER-1001') || html.includes('Loja Shopee Demonstração PJ')) throw new Error('Fixture não pode ser exposta sem sessão');
  if (html.includes('sessionStorage') || html.includes('localStorage') || html.includes('Authorization')) throw new Error('HTML contém transporte legado de sessão');
});

Deno.test('roteamento preserva o caminho base real da Edge Function', () => {
  if (routeFromRequestPath('/functions/v1/shopee-review-auth') !== '/') throw new Error('Raiz não reconhecida');
  if (routeFromRequestPath('/functions/v1/shopee-review-auth/login') !== '/login') throw new Error('Login não reconhecido');
  if (routeFromRequestPath('/functions/v1/shopee-review-auth/data/') !== '/data') throw new Error('Dados não reconhecidos');
});
