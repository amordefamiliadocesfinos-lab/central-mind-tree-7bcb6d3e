// Architecture remains account-scoped; this rollout admits only Viviane.
export const SHOPEE_CYCLE_ACCOUNT = Object.freeze({
  account: '8a8ad166-0317-4597-8be6-e43fb46b4d1b', shop: 531736366, partner: 2047685,
});

export function validCycleScope(scope) {
  return scope?.account === SHOPEE_CYCLE_ACCOUNT.account
    && scope.shop === SHOPEE_CYCLE_ACCOUNT.shop && scope.partner === SHOPEE_CYCLE_ACCOUNT.partner
    && typeof scope.order === 'string' && /^[A-Za-z0-9]{8,100}$/.test(scope.order)
    && typeof scope.package === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(scope.package);
}
