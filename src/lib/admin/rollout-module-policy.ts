/**
 * Rollout gate independent of the database catalog.
 * Only Health is eligible for scoped onboarding after the complete
 * RLS / API / Storage approval. Enterprise modules are future-ready labels,
 * not presently active access grants.
 */
export const ROLLOUT_READY_MODULE_KEYS = ["saude"] as const;

export function assertRolloutModules(modules: readonly string[]): void {
  if (modules.some((key) => !(ROLLOUT_READY_MODULE_KEYS as readonly string[]).includes(key))) {
    throw new Error("O módulo selecionado ainda não possui isolamento homologado.");
  }
}
