import { useMemo } from "react";
import { BookOpen, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import { MODULE_PROVENANCE, SOURCE_AUTHORITY_LABELS } from "@/lib/nucleo/operationalProvenanceV12";
import { KNOWLEDGE_ARCHIVES, KNOWLEDGE_ARCHIVE_SOURCES, OPERACOES_ORIGINAL_RECOVERED } from "@/lib/nucleo/knowledgeArchiveSourcesV12";

/**
 * Matriz M5 de proveniência, sem gravar ou consultar documentos.
 * Montar apenas no painel que passou pelas verificações de grant/RLS M5.
 * O contrato atual M3 possui campo especialista textual, sem mandato
 * certificado. Não inferir titular, autorização ou homologação desse texto.
 */
export default function NucleoAuthorityCoverage({ modules }: { modules: DevelopmentWorkstream[] }) {
  const entries = useMemo(() => [...modules]
    .sort((a,b) => a.code.localeCompare(b.code,"pt-BR"))
    .map(module => {
      const provenance = MODULE_PROVENANCE[module.code];
      const sources = provenance?.sources ?? [];
      const declaredCurrent = sources.filter(s => s.authority === "vigente_declarada");
      const historical = sources.filter(s => s.authority === "historica");
      const codeOnly = sources.filter(s => s.authority === "codigo_verificado");
      const tier = declaredCurrent.length > 0 ? "documento_vigente_declarado"
        : historical.length > 0 ? "checkpoint_historico"
        : codeOnly.length > 0 ? "codigo" : "sem_fonte";
      const archiveSources = KNOWLEDGE_ARCHIVE_SOURCES.filter(src => src.moduleCode === module.code);
      return {module,provenance,sources,declaredCurrent,historical,codeOnly,tier,archiveSources};
    }),[modules]);

  const declaredCount = entries.filter(item=>item.tier==="documento_vigente_declarado").length;
  const historicalCount = entries.filter(item=>item.tier==="checkpoint_historico").length;
  const codeCount = entries.filter(item=>item.tier==="codigo").length;
  const missingCount = entries.filter(item=>item.tier==="sem_fonte").length;
  return (
    <section aria-label="Matriz de proveniência e autoridade dos especialistas" className="border rounded-lg p-3 md:p-4 space-y-3">
      <div className="space-y-1">
        <h4 className="inline-flex gap-2 items-center text-sm font-semibold">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          Fontes e autoridade — reconciliação assistida
        </h4>
        <p className="text-sm text-muted-foreground">
          Leitura dos módulos cadastrados na sessão M5 autorizada e do catálogo versionado no GitHub.
          Ter uma fonte não confirma o titular atual, o mandato do especialista ou o método homologado.
          O catálogo de ZIPs anexados é uma referência de localização e integridade, não certificação de vigência.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          ["Mapa que se declara vigente",declaredCount,"text-violet-700 dark:text-violet-300"],
          ["Checkpoint histórico",historicalCount,"text-amber-700 dark:text-amber-300"],
          ["Somente código",codeCount,"text-sky-700 dark:text-sky-300"],
          ["Sem fonte catalogada",missingCount,"text-rose-700 dark:text-rose-300"],
        ].map(([label,value,tone])=>(
          <div key={String(label)} className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(({module,provenance,sources,tier,archiveSources}) => (
          <article key={module.id} className="border rounded-lg p-3 space-y-2 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold">{module.code} — {module.title}</p>
              <Badge variant="outline" className="shrink-0">
                {tier==="documento_vigente_declarado" ? "Mapa declarado" :
                 tier==="checkpoint_historico" ? "Histórico" :
                 tier==="codigo" ? "Código" : "Fonte pendente"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Mandato atual do especialista: <span className="font-medium text-foreground">não certificado neste contrato M3</span>
            </p>
            <p className="text-xs text-muted-foreground">
              O campo textual de especialista não contém identificador, autoridade e vigência auditados.
            </p>
            {provenance?.ownerBoundary && <p className="text-sm">{provenance.ownerBoundary}</p>}
            {module.code === "OPE" && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 p-3 space-y-1">
                <p className="text-xs font-semibold">Mapa Norteador ORIGINAL localizado na Biblioteca</p>
                <p className="text-xs text-muted-foreground">
                  {OPERACOES_ORIGINAL_RECOVERED.documentCode} — congelado em 18/09/2026.
                  Recuperado em fonte externa ao ZIP; seu backlog não foi reclassificado como situação atual.
                </p>
                <p className="text-xs text-muted-foreground">
                  Localizador: Biblioteca do projeto (arquivo original, versão {OPERACOES_ORIGINAL_RECOVERED.sourceVersion}).
                </p>
                <p className="text-xs font-mono break-all">SHA-256: {OPERACOES_ORIGINAL_RECOVERED.sha256}</p>
                <p className="text-xs text-muted-foreground">
                  Mandato ainda não certificado. Conteúdo preservado apenas na fonte original; não importado ao Core.
                </p>
              </div>
            )}
            {archiveSources.length>0&&(
              <div className="border-t pt-2 space-y-2">
                <p className="text-xs font-semibold">Fonte de continuidade no acervo anexado (03/10/2026)</p>
                {archiveSources.map(source=>(
                  <div key={source.sha256} className="text-xs space-y-1">
                    <p className="font-semibold">{source.documentCode}</p>
                    <p className="text-muted-foreground">{source.continuityScope}</p>
                    <p className="text-muted-foreground">{source.currentAuthorityBoundary}</p>
                    <p className="break-all font-mono text-[10px]">{source.archiveInnerPath}</p>
                    <p className="text-muted-foreground">SHA-256: <span className="font-mono break-all">{source.sha256}</span></p>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Mesmo arquivo em {KNOWLEDGE_ARCHIVES.join(" e ")}. Não representa duas versões distintas nem conteúdo importado.
                </p>
              </div>
            )}
            <div className="border-t pt-2 space-y-1">
              <p className="flex gap-1.5 items-center text-xs font-semibold">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                {sources.length} fonte(s) catalogada(s)
              </p>
              {sources.map(source => (
                <div key={source.path} className="text-xs space-y-0.5">
                  <a href={source.path} target="_blank" rel="noopener noreferrer"
                     className="underline underline-offset-2 font-medium">
                    {source.label}
                  </a>
                  <p className="text-muted-foreground">
                    {SOURCE_AUTHORITY_LABELS[source.authority]}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        A matriz não cria alertas persistidos, não grava documentos e não homologa especialistas.
        Antes de promover uma fonte a método vigente, confirmar versão, autoridade, responsável e decisão na fonte soberana.
      </p>
    </section>
  );
}
