import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";

type Props = {
  records: DevelopmentWorkstream[];
  onOpenWorkstream: (id: string) => void;
};
const statusLabels:Record<DevelopmentWorkstream["status"],string>={
  planejado:"Planejado",em_andamento:"Em andamento",bloqueado:"Bloqueado",
  em_validacao:"Em validação",concluido:"Concluído declarado",
};
const priorityLabels:Record<DevelopmentWorkstream["priority"],string>={
  baixa:"Baixa",normal:"Normal",alta:"Alta",critica:"Crítica",
};
const evidenceLabels:Record<DevelopmentWorkstream["evidence_state"],string>={
  sem_evidencia:"Sem evidência declarada",
  relatada:"Evidência relatada no M3",
  comprovada:"Comprovada declarada no M3",
};

export default function NucleoFocusPreviewV30({records,onOpenWorkstream}:Props) {
  const [previewId,setPreviewId]=useState<string|null>(null);
  const preview=records.find(record=>record.id===previewId)??records[0];
  const shortlist=records.slice(0,3);
  return (
    <section aria-label="Resumo micro do recorte" className="space-y-3 rounded-2xl border border-[#d2e3fc] bg-[#f7faff] p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Resumo rápido do foco</h3>
          <p className="text-xs text-muted-foreground">
            Consulte a próxima ação antes de abrir a ficha de edição. Exibe até três frentes do recorte.
          </p>
        </div>
        <span className="rounded-full bg-[#e8f0fe] px-3 py-1 text-xs font-semibold tabular-nums text-[#174ea6] dark:bg-blue-950 dark:text-blue-300">
          {records.length} frente(s)/subfrente(s)
        </span>
      </div>
      {preview ? <>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shortlist.map(item=>(
            <button key={item.id} type="button" aria-pressed={preview.id===item.id}
              onClick={()=>setPreviewId(item.id)}
              className={"min-w-0 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] "+
                (preview.id===item.id?"border-[#1a73e8] bg-[#e8f0fe] text-[#174ea6] dark:bg-blue-950 dark:text-blue-100":"border-[#dce5f1] bg-white hover:bg-[#edf4ff] dark:border-slate-700 dark:bg-slate-800")}>
              <p className="truncate font-mono text-xs font-semibold">{item.code}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold">{item.title}</p>
              <p className="mt-2 text-xs">{statusLabels[item.status]}</p>
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Frente selecionada para consulta</p>
              <h4 className="break-words text-sm font-semibold">{preview.code} · {preview.title}</h4>
            </div>
            <Button type="button" size="sm" className="min-h-10 rounded-full bg-[#1a73e8] text-white hover:bg-[#185abc]"
              onClick={()=>onOpenWorkstream(preview.id)}>Abrir ficha para executar</Button>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
            <div><dt className="font-semibold">Situação declarada</dt><dd>{statusLabels[preview.status]}</dd></div>
            <div><dt className="font-semibold">Prioridade registrada</dt><dd>{priorityLabels[preview.priority]}</dd></div>
            <div><dt className="font-semibold">Especialista declarado</dt><dd className="break-words">{preview.specialist.trim()||"Não informado"}</dd></div>
            <div><dt className="font-semibold">Última atualização M3</dt><dd>{new Date(preview.updated_at).toLocaleString("pt-BR")}</dd></div>
            <div><dt className="font-semibold">Classificação da evidência M3</dt><dd>{evidenceLabels[preview.evidence_state]}</dd></div>
            <div><dt className="font-semibold">Bloqueio registrado</dt><dd className="break-words">{preview.blocker.trim()||"Nenhum motivo informado"}</dd></div>
          </dl>
          <div className="rounded-lg bg-[#e8f0fe] p-3 dark:bg-blue-950/30">
            <p className="text-xs font-semibold text-[#174ea6] dark:text-blue-200">Próxima ação registrada</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{preview.next_action.trim()||"Nenhuma próxima ação registrada no M3."}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Resumo de leitura do Core M3. Evidência declarada não substitui prova técnica M4,
            decisão homologada ou publicação canônica.
          </p>
        </div>
      </>:<p role="status" className="rounded-lg bg-white p-3 text-sm text-muted-foreground">
        Nenhuma frente corresponde ao foco atual. Use Limpar foco para ampliar o recorte.
      </p>}
    </section>
  );
}
