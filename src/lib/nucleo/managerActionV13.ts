import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";

/** Explicação ao gestor; não modifica a próxima ação canônica registrada no Core. */
export function managerActionExplanation(item: Pick<DevelopmentWorkstream, "code" | "next_action">): string | null {
  if (item.code !== "OPE-03" || !item.next_action.includes("planning_source=mrp") ||
      !item.next_action.includes("planning_context")) return null;
  return "Em uma compra real autorizada, conferir se o pedido foi salvo e se as informações de origem do planejamento MRP continuam disponíveis ao reabri-lo. Recebimento, estoque e financeiro exigem verificações independentes; não criar compra de teste.";
}


/** Literal excerpt from an explicit marker; the complete record remains accessible. */
export function explicitNextActionExcerpt(value: string): string | null {
  const text=value.trim();
  // A ação explicitamente declarada vigente prevalece sobre marcadores históricos.
  // Se houver ambiguidade, exibir o registro integral, sem escolher por inferência.
  const current=[...text.matchAll(/(?:^|[.!?;\n]\s*)Ação vigente:\s*/giu)];
  const matches=current.length>0?current:[...text.matchAll(/(?:^|[.!?;\n]\s*)Próxima ação:\s*/giu)];
  if(matches.length!==1)return null;
  const match=matches[0];
  const start=(match.index??0)+match[0].length;
  const excerpt=text.slice(start).split(/\r?\n\s*\r?\n/,1)[0].trim();
  if(excerpt.length<10)return null;
  if(!text.slice(0,match.index??0).trim()&&!text.slice(start+excerpt.length).trim())return null;
  return excerpt;
}
