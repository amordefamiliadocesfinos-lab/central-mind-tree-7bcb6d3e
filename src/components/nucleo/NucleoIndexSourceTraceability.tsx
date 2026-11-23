import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * M0 — consulta de proveniência, não editor ou catálogo canônico.
 * Os hashes abaixo identificam cópias históricas dentro de ZIPs anexados
 * à investigação. A aplicação NÃO carrega esses ZIPs nem seus conteúdos.
 */
const ARCHIVES = [
 "BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-05_V3.zip",
 "BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-22_V3_ALFAJOR_60G.zip",
] as const;
const ORIGINS = [
 {
  name: "Índice Mestre V1.2",
  path: "BASE_FINAL/00_GOVERNANCA_DA_BASE/01_INDICE_MESTRE_BASE_CONHECIMENTOS_V1_2.txt",
  sha256: "48489c7defa99271ffd644e24884323f2906868ca65c1f437f5501db1ec98e17",
  scope: "Índice macro da base, homologado e congelado segundo o documento de 03/10/2026; não indica versão comercial vigente.",
 },
 {
  name: "Mapa de Conexões V1.2",
  path: "BASE_FINAL/00_GOVERNANCA_DA_BASE/05_MAPA_DE_CONEXOES_BASE_CONHECIMENTOS_V1_2.txt",
  sha256: "93cb5bd5e590a591bee8626f58ad9a3829e4b77a8d1992249e15fbf39314e91a",
  scope: "Mapa macro declarado congelado em 03/10/2026; sem prova de que esteja servido como índice ativo no Core.",
 },
 {
  name: "Registro formal V1.1 e BC-SHOPEE-07-01",
  path: "BASE_FINAL/02_MARKETPLACES/01_METODOLOGIA_UNIVERSAL/REGISTRO_FORMAL_HOMOLOGACAO_ARQUITETURA_COMERCIAL_OPERACIONAL_V1.1_E_BC-SHOPEE-07-01.txt",
  sha256: "61cca3e588b36cb89f2494f5f38f3a8f499b3c6f32734ae9898b6d148fcf947e",
  scope: "Registro interno datado de 25/09/2026: declara V1.1 vigente/não congelada e V1 histórica. Não certifica autoria independente ou atualização do índice servido.",
 },
 {
  name: "Atualização de índice/metodologia",
  path: "BASE_FINAL/02_MARKETPLACES/01_METODOLOGIA_UNIVERSAL/ATUALIZACAO_HOMOLOGADA_INDICE_MAPA_CONEXOES_ARQUITETURA_COMERCIAL_OPERACIONAL_V1.1.txt",
  sha256: "7c9c4b499d7c78f727dfca68f9705dee990332103ecb69543216db9f4a23f5d9",
  scope: "Contém divergência histórica: a seção Módulo 14 chama V1 de vigente, mas a matriz final registra V1 histórica e V1.1 vigente. Não corrigir por inferência.",
 },
] as const;
type CoreCounts = { documents: number; revisions: number; driveReferences: number };
type State = "idle" | "checking" | "ready" | "unavailable" | "unauthorized";

/** Exibir apenas na Biblioteca, sem gravar nada nem inferir vigência pela contagem. */
export default function NucleoIndexSourceTraceability({ localPageCount }: { localPageCount: number }) {
 const { session } = useAuth();
 const [state, setState] = useState<State>("idle");
 const [counts, setCounts] = useState<CoreCounts | null>(null);
 const [checkedAt, setCheckedAt] = useState("");
 const [reload, setReload] = useState(0);
 useEffect(() => {
  let cancelled = false;
  setCounts(null); setCheckedAt("");
  if (!session?.user?.id) { setState("unauthorized"); return; }
  setState("checking");
  void (async () => {
   try {
    const grant = await supabase.from("app_admin_capabilities")
     .select("capability").eq("auth_user_id", session.user.id)
     .eq("capability", "nucleo_manage").eq("active", true)
     .is("revoked_at", null).maybeSingle();
    if (grant.error || !grant.data) {
     if (!cancelled) setState("unauthorized");
     return;
    }
    const [docs, revisions, refs] = await Promise.all([
     supabase.from("nucleo_documents").select("id", {count:"exact",head:true}),
     supabase.from("nucleo_document_revisions").select("id", {count:"exact",head:true}),
     supabase.from("nucleo_source_references").select("id", {count:"exact",head:true}),
    ]);
    if (cancelled) return;
    if (docs.error || revisions.error || refs.error ||
        docs.count === null || revisions.count === null || refs.count === null) {
     setState("unavailable"); return;
    }
    setCounts({documents:docs.count,revisions:revisions.count,driveReferences:refs.count});
    setCheckedAt(new Date().toLocaleString("pt-BR"));
    setState("ready");
   } catch { if (!cancelled) setState("unavailable"); }
  })();
  return () => { cancelled = true; };
 }, [session?.user?.id, reload]);

 if (state === "unauthorized") return null;
 return <section className="mt-5 rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Rastreabilidade da fonte do Índice Mestre">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="text-sm font-semibold">M0 · De onde vem o Índice Mestre?</h2>
   <Button type="button" size="sm" variant="outline" disabled={state==="checking"} onClick={()=>setReload(v=>v+1)}>Atualizar leitura do Core</Button>
  </div>
  <p className="text-xs text-muted-foreground">
   Não há um índice único certificado como fonte ativa nesta tela. A Biblioteca local, o catálogo de referências Drive e os documentos governados no Core são superfícies distintas.
   O inventário ZIP é uma referência documental histórica, não conteúdo carregado ou sincronizado pela aplicação.
  </p>
  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
   <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Biblioteca deste navegador</p><p className="text-lg font-semibold">{localPageCount}</p><p>Páginas em armazenamento local; não indica cobertura global ou vigência.</p></div>
   <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Documentos do Core</p><p className="text-lg font-semibold">{state==="ready"?counts?.documents:"—"}</p><p>Contagem visível sob a sessão autorizada.</p></div>
   <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Revisões do Core</p><p className="text-lg font-semibold">{state==="ready"?counts?.revisions:"—"}</p><p>Não inclui versões que residem somente no navegador ou ZIP.</p></div>
   <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Referências externas</p><p className="text-lg font-semibold">{state==="ready"?counts?.driveReferences:"—"}</p><p>Somente metadados, não arquivos importados.</p></div>
  </div>
  <p role="status" className="text-xs text-muted-foreground">
   {state==="checking"?"Consultando contagens protegidas…":state==="unavailable"?"Leitura incompleta ou negada; sem conclusão sobre os registros do Core.":state==="ready"
    ?`Leitura do Core em ${checkedAt}. Contagens mostram apenas o que é visível nesta sessão, não certificam o índice servido ou ausência global.`:""}
  </p>
  <details className="rounded-lg border p-3 text-xs">
   <summary className="cursor-pointer font-semibold">Proveniência documental dos índices e da metodologia (inventário M0)</summary>
   <p className="my-2 text-muted-foreground">As quatro entradas abaixo foram identificadas com o mesmo SHA-256 nos ZIPs de 05/10 e 22/10/2026, não consultadas diretamente a partir do Core. Caminhos internos não são links para GitHub.</p>
   <ul className="list-disc space-y-1 pl-5">
    {ARCHIVES.map(name=><li key={name} className="break-all">{name}</li>)}
   </ul>
   <div className="mt-3 space-y-2">
    {ORIGINS.map(item=><article key={item.sha256} className="rounded-md border p-2 space-y-1">
     <p className="font-semibold">{item.name}</p>
     <p>{item.scope}</p>
     <p className="break-all text-muted-foreground">Caminho ZIP: {item.path}</p>
     <p className="break-all font-mono text-[11px]">SHA-256: {item.sha256}</p>
    </article>)}
   </div>
   <p className="mt-3 text-muted-foreground">Rota auxiliar para consulta histórica: índice macro V1.2 → metodologia comercial V1.1 (vigência declarada no registro 25/09) → BC-SHOPEE-07-01 → produto → adaptador de canal. V1 permanece histórica segundo esse registro. Não constitui alteração dos documentos congelados, do Índice Mestre no Core ou ato de homologação.</p>
  </details>
 </section>;
}
