// Account-scoped, explicit profiles: preserve Viviane as the legacy default.
export const SHOPEE_CYCLE_ACCOUNT = Object.freeze({
  account: '8a8ad166-0317-4597-8be6-e43fb46b4d1b', shop: 531736366, partner: 2047685,
});

export const ADAO_CYCLE_ACCOUNT = Object.freeze({
  account: 'b4027369-5abf-4ac1-ab24-862334fae892', shop: 1156446003, partner: 2047685,
});

export function validCycleScope(scope, expected = SHOPEE_CYCLE_ACCOUNT) {
  return scope?.account === expected.account
    && scope.shop === expected.shop && scope.partner === expected.partner
    && typeof scope.order === 'string' && /^[A-Za-z0-9]{8,100}$/.test(scope.order)
    && typeof scope.package === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(scope.package);
}
