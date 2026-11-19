import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";

/** Explicação ao gestor; não modifica a próxima ação canônica registrada no Core. */
export function managerActionExplanation(item: Pick<DevelopmentWorkstream, "code" | "next_action">): string | null {
  if (item.code !== "OPE-03" || !item.next_action.includes("planning_source=mrp") ||
      !item.next_action.includes("planning_context")) return null;
  return "Em uma compra real autorizada, conferir se o pedido foi salvo e se as informações de origem do planejamento MRP continuam disponíveis ao reabri-lo. Recebimento, estoque e financeiro exigem verificações independentes; não criar compra de teste.";
}
