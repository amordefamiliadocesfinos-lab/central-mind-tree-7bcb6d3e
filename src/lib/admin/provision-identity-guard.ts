/**
 * Pure preflight for administrator-initiated external user access.
 * Must run BEFORE any Auth Admin create/invite call.
 */
export type ProvisionIdentityPreflight = {
  requestedRole?: string | null;
  existingAppRole?: string | null;
  existingAppAuthId?: string | null;
  existingAthleteAuthId?: string | null;
  resolvedAuthId?: string | null;
  healthAthleteSelected: boolean;
  modules: readonly string[];
};

export function assertScopedProvisionIdentity(input: ProvisionIdentityPreflight): void {
  const requestedRole = (input.requestedRole ?? "").trim().toLocaleUpperCase("pt-BR");
  const currentRole = (input.existingAppRole ?? "").trim().toLocaleUpperCase("pt-BR");
  if (requestedRole && requestedRole !== "EXTERNO") {
    throw new Error("Atribuição de função operacional não é permitida neste fluxo de acesso restrito.");
  }
  if (currentRole && currentRole !== "EXTERNO") {
    throw new Error("O cadastro existente possui papel operacional. Não convertê-lo automaticamente em acesso restrito.");
  }
  if (input.healthAthleteSelected && !input.modules.includes("saude")) {
    throw new Error("Vincular atleta exige a seleção explícita do módulo Saúde.");
  }
  if (input.existingAppAuthId &&
      (!input.resolvedAuthId || input.existingAppAuthId !== input.resolvedAuthId)) {
    throw new Error("O cadastro já pertence a outro Auth ou o Auth correspondente não foi localizado.");
  }
  if (input.existingAthleteAuthId &&
      (!input.resolvedAuthId || input.existingAthleteAuthId !== input.resolvedAuthId)) {
    throw new Error("O atleta já pertence a outro Auth ou o Auth correspondente não foi localizado.");
  }
}
