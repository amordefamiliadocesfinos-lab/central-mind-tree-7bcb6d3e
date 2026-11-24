import type { DevelopmentWorkstream } from "./development.types";

// Consultative ordering only; never changes declared priority or status.
export function selectAttention(items: readonly DevelopmentWorkstream[]): DevelopmentWorkstream | null {
  const pending=items.filter(item=>item.status!=="concluido");
  return pending.find(item=>item.status==="bloqueado")
    ?? pending.find(item=>item.priority==="critica")
    ?? pending.find(item=>item.priority==="alta")
    ?? pending.find(item=>item.next_action.trim())
    ?? pending[0] ?? null;
}

export function orderPending(items: readonly DevelopmentWorkstream[]): DevelopmentWorkstream[] {
  const rank={critica:0,alta:1,normal:2,baixa:3};
  return items.filter(item=>item.status!=="concluido").sort((a,b)=>
    Number(b.status==="bloqueado")-Number(a.status==="bloqueado") ||
    rank[a.priority]-rank[b.priority] || a.code.localeCompare(b.code,"pt-BR"));
}
