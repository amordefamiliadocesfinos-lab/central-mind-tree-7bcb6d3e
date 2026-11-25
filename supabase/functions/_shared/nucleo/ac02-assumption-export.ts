/**
 * AC-02 / CA-29 — contrato de exportação de um RASCUNHO de assunção.
 * O exportador só recebe uma projeção previamente autorizada do endpoint
 * nucleo-knowledge-read. NÃO consulta banco, assina documento, concede
 * acesso, publica fontes ou transmite para outro chat.
 */
import { summarizeAc02Continuity } from "./ac02-continuity-summary.ts";
import { buildAc02AssumptionGuide } from "./ac02-assumption-guide.ts";
import { inventoryAc02KnowledgeGaps, summarizeAc02DocumentaryReadiness } from "./ac02-knowledge-gaps.ts";
import { describeAc02DocumentaryCoverage, type Ac02DocumentaryRevision } from "./ac02-documentary-coverage.ts";
import {
 AC02_GLOBAL_ITEMS, AC02_GLOBAL_IDENTITY,
 type Ac02Projection, type Ac02SpecialistContext,
} from "./ac02-registry-contract.ts";

export type Ac02HandoffTechnicalContext=Readonly<{
 fronts:readonly Readonly<{id:string;code:string;status:string}>[];
 evidence:readonly Readonly<{id:string;workstreamId:string;kind:string;observedState:string}>[];
 evidenceRead:"completa"|"indeterminada";
}>;

export type Ac02Ac01Status=Readonly<{id:string;lineageId:string;versionNo:number;authorityState:string}>;
export type Ac02AssumptionInput=Readonly<{
 projection:Ac02Projection;
 specialist:Ac02SpecialistContext;
 moduleTitle:string;
 preparedAt:string;
 technical?:Ac02HandoffTechnicalContext;
 documentary?:readonly Ac02DocumentaryRevision[];
 documentaryReadComplete?:boolean;
 ac01?:Readonly<{rows:readonly Ac02Ac01Status[];readComplete:boolean}>;
}>;
export type Ac02AssumptionExport=Readonly<{
 kind:"nucleo_ac02_pacote_oficial_assuncao_rascunho";
 status:"rascunho_nao_homologado";
 version:"1.0";
 text:string;
 unresolved:readonly string[];
 privateSourcesIncluded:false;
}>;

// Field-level allowlist. Never put untrusted names, URLs, notes, JWTs,
// original Ficha Viva bodies or raw evidence records into a portable package.
const safeCode=(value:string):string|null=>
 /^[A-Z]{3}$/.test(value)?value:null;
const safeRevision=(value:string|null,section:string):string|null=>{
 if(!value)return null;
 const pattern=new RegExp("^"+section+" \\/ Core revision ([a-f0-9-]{36}) v([1-9][0-9]{0,5}) \\((rascunho|proposta|homologado|historico|vigente|em_evolucao)\\)$");
 const match=value.match(pattern);
 return match?section+" / revisão "+match[1]+" / v"+match[2]+" / estado declarado "+match[3]:null;
};

export function composeAc02AssumptionExport(input:Ac02AssumptionInput):Ac02AssumptionExport {
 const {projection,specialist}=input;
 if(projection.kind!=="nucleo_ac02_registro_mestre_consultivo"||
  projection.identity.github!==AC02_GLOBAL_IDENTITY.github||
  projection.identity.lovableProjectId!==AC02_GLOBAL_IDENTITY.lovableProjectId||
  projection.identity.cloudSupabaseProjectRef!==AC02_GLOBAL_IDENTITY.cloudSupabaseProjectRef||
  projection.stable.length!==AC02_GLOBAL_ITEMS.length||
  projection.stable.some((v,i)=>v.id!==AC02_GLOBAL_ITEMS[i].id||v.value!==AC02_GLOBAL_ITEMS[i].value))
   throw new Error("AC02: inconsistent source projection — export blocked");
 if(!Number.isFinite(Date.parse(input.preparedAt))||
  !/^\d{4}-\d{2}-\d{2}T/.test(input.preparedAt))
   throw new Error("AC02: invalid preparation timestamp");
 const code=safeCode(specialist.moduleCode);
 if(!code||!/^[-a-f0-9]{36}$/i.test(specialist.moduleId))
   throw new Error("AC02: functional module identity invalid");
 const method=safeRevision(specialist.methodRef,"FM-08");
 const ecosystem=safeRevision(specialist.ecosystemRef,"FM-08");
 const scope=safeRevision(specialist.scopeRef,"FM-03");
 const checkpoint=safeRevision(specialist.checkpointRef,"FM-09");
 const unresolved:string[]=[];
 if(!method)unresolved.push("Método: referência FM-08 não comprovada");
 if(!ecosystem)unresolved.push("Ecossistema: documento distinto e vigência não comprovados");
 else if(method===ecosystem)unresolved.push("FM-08 é referência compartilhada; não comprova dois documentos distintos");
 if(!scope)unresolved.push("Escopo: referência FM-03 não comprovada");
 if(!checkpoint)unresolved.push("Checkpoint: referência FM-09 não comprovada");
 unresolved.push("Titular/mandato do especialista: não certificado pelo AC-02");
 unresolved.push("Acesso a arquivos externos: não transferido; requer autorização individual");
 unresolved.push("Validação humana do pacote e das fontes: pendente");
 if(projection.conflicts.length)unresolved.push("Conflitos na leitura técnica: reconciliação necessária");
 if(projection.missingChecks.length)unresolved.push("Observações técnicas não verificadas/expiradas");
 const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const technical=input.technical;
 const frontList:string[]=[];
 const evidenceList:string[]=[];
 if(technical){
  const frontIds=new Set<string>();
  for(const f of technical.fronts.slice(0,50)){
   if(isUuid(f.id)&&/^[A-Z0-9_-]{3,50}$/.test(f.code)&&
    ["planejado","em_andamento","bloqueado","em_validacao","concluido"].includes(f.status)&&
    !frontIds.has(f.id)){
     frontIds.add(f.id);
     frontList.push("- "+f.code+" / "+f.id+" / status M3 declarado "+f.status);
   }
  }
  for(const e of technical.evidence.slice(0,80)){
   if(isUuid(e.id)&&frontIds.has(e.workstreamId)&&
      ["pull_request","commit","workflow_run","ci_run","migration","deployment","manual","outro"].includes(e.kind)&&
      ["verificado","relatado","nao_verificado","indeterminado"].includes(e.observedState)){
      evidenceList.push("- M4 "+e.id+" / frente "+e.workstreamId+
       " / tipo "+e.kind+" / estado M4 declarado "+e.observedState);
   }
  }
  if(technical.fronts.length>50||technical.evidence.length>80)
   unresolved.push("Inventário técnico excedeu o recorte máximo; continuidade parcial");
  if(technical.evidenceRead!=="completa")
   unresolved.push("Evidências M4: leitura não comprovadamente completa");
 }else unresolved.push("Frentes e evidências M3/M4: não incluídas nesta leitura");
 if(frontList.length===0)unresolved.push("Frentes M3: nenhuma referência estruturada recuperada");
 if(evidenceList.length===0)unresolved.push("Provas M4: nenhuma referência estruturada autorizada recuperada");

 const ac01Lines:string[]=[];
 const ac01=input.ac01;
 if(!ac01||!ac01.readComplete){
  unresolved.push("AC-01: recorte de revisões não confirmado; consultar propostas e decisões no Core");
  ac01Lines.push("- Leitura AC-01 incompleta ou ausente; nenhuma conclusão sobre decisões.");
 }else{
  const latest=new Map<string,Ac02Ac01Status>();
  let invalid=false;
  for(const r of ac01.rows){
   if(!isUuid(r.id)||!isUuid(r.lineageId)||!Number.isSafeInteger(r.versionNo)||r.versionNo<1||
    !["proposta","em_evolucao"].includes(r.authorityState)){invalid=true;break;}
   const prior=latest.get(r.lineageId);
   if(!prior||r.versionNo>prior.versionNo)latest.set(r.lineageId,r);
   else if(prior.versionNo===r.versionNo&&prior.id!==r.id)invalid=true;
  }
  if(invalid||latest.size>40){
   unresolved.push("AC-01: registros inconsistentes ou recorte amplo demais; consultar Core");
   ac01Lines.push("- Identificadores AC-01 indeterminados; exportação de linhas bloqueada.");
  }else if(!latest.size){
   ac01Lines.push("- Nenhuma contribuição AC-01 retornada no módulo; outras fontes não examinadas.");
  }else{
   for(const r of [...latest.values()].sort((a,b)=>a.lineageId.localeCompare(b.lineageId))){
    ac01Lines.push("- Linhagem "+r.lineageId+" / contribuição "+r.id+" / v"+r.versionNo+
     " / estado declarado "+r.authorityState+" / decisão e publicação NÃO verificadas neste pacote.");
   }
   unresolved.push("AC-01: conferir decisões, revisões pendentes e comparação na origem; estados de contribuição não comprovam aprovação");
  }
 }
 const continuity=technical?summarizeAc02Continuity(technical.fronts.slice(0,50),technical.evidence.slice(0,80),technical.fronts.length>50||technical.evidence.length>80?"indeterminada":technical.evidenceRead):null;
 if(continuity?.completeness==="recorte_incompleto")
  unresolved.push("Resumo de continuidade M3/M4: recorte incompleto");
 const summaryText=continuity?[
  "- Fonte: estados M3/M4 declarados no Core; não equivale a mandato, homologação ou próximo passo aprovado.",
  "- Planejadas: "+continuity.counts.planejado+
    " | Em andamento: "+continuity.counts.em_andamento+
    " | Bloqueadas: "+continuity.counts.bloqueado+
    " | Em validação: "+continuity.counts.em_validacao+
    " | Concluídas (declaradas): "+continuity.counts.concluido,
  "- Frentes com referência M4 no recorte: "+continuity.frontsWithEvidence+
    " | Sem referência M4 no recorte: "+continuity.frontsWithoutEvidence,
  "- Próximas frentes para CONFERÊNCIA, não ordens de execução:",
  ...continuity.nextCandidates.map(item=>"- "+item.code+" / "+item.status+" — "+item.reason),
  ...continuity.warnings.map(w=>"- Ressalva: "+w),
 ]:["- Sem inventário suficiente para gerar síntese operacional."];

 const coverage=input.documentary?describeAc02DocumentaryCoverage(input.documentary,input.documentaryReadComplete===true):null;
 if(!coverage)unresolved.push("Cobertura de FM-03/FM-08/FM-09/FM-10: metadados de revisão não disponibilizados");
 else if(coverage.warnings.length)unresolved.push("Cobertura documental: revisar ressalvas, origem e último checkpoint operacional");
 const coverageLines=coverage?[
  "- Fonte: metadados de revisão do Core; documentos e referências privadas não incluídos.",
  ...coverage.entries.map(e=>"- "+e.sectionCode+": "+e.status+
   " / versão "+(e.versionNo??"NÃO COMPROVADA")+
   " / id "+(e.revisionId??"NÃO COMPROVADO")+
   " / autoridade declarada "+(e.authorityState??"NÃO COMPROVADA")+
   " / registro "+(e.recordedAt??"NÃO COMPROVADO")+
   " / referência de fonte "+e.sourceReference),
  ...coverage.warnings.map(w=>"- Ressalva: "+w),
  "- Último checkpoint operacional comprovado: NÃO. FM-09 é referência documental, não prova de conclusão real.",
  "- Aprendizagem FM-10: recuperar a fonte e confrontar erro/acerto com evidência M3/M4; metadados não comprovam lição homologada.",
  "- Método e ecossistema distintos comprovados: NÃO. FM-08 é uma seção compartilhada.",
 ]:["- Cobertura documental não recuperada; não inferir fonte, versão ou checkpoint."];

 const guide=buildAc02AssumptionGuide(code,coverage,continuity,unresolved);
 const guideLines=[
  "- Ordem sugerida apenas para leitura/conferência, não para execução automática:",
  ...guide.steps.map(step=>"- "+step.order+". "+step.subject+
   " / "+step.state+" — "+step.action+" ["+step.evidence+"]"),
  ...guide.caveats.map(c=>"- Limite: "+c),
 ];

 const gaps=inventoryAc02KnowledgeGaps(code,coverage,continuity,guide);
 const readiness=summarizeAc02DocumentaryReadiness(gaps);
 const readinessLines=[
  "- Escopo: prontidão de REFERÊNCIAS PARA CONSULTA; não é pontuação, certificação ou autorização.",
  "- Referências disponíveis para consulta: "+readiness.coverage.referencias_presentes_para_consulta,
  "- Referências não localizadas no recorte: "+readiness.coverage.referencias_ausentes_no_recorte,
  "- Leituras indeterminadas: "+readiness.coverage.recortes_indeterminados,
  "- Comprovações externas pendentes: "+readiness.coverage.comprovacoes_externas_pendentes,
  "- Fases formalmente adiadas: "+readiness.coverage.fases_adiadas,
  "- Identificadores, categorias, estados, fontes e ações individuais: ver inventário G01–G08 na seção 10.",
  "- Pronto para assunção operacional: NÃO COMPROVADO. Conferir documentos, mandato, fontes e checkpoint original.",
  "- Ordem de conferência (sem itens adiados e sem autorização de execução): "+readiness.reviewOrder.join(", "),
 ];
 const gapLines=[
  "- Lacunas identificadas neste recorte; não significam ausência no projeto inteiro.",
  "- Documentais: "+gaps.summary.documental+" | Operacionais: "+gaps.summary.operacional+
    " | Governança: "+gaps.summary.governanca+" | Implantação adiada: "+gaps.summary.implantacao,
  ...gaps.gaps.map(g=>"- "+g.id+" / "+g.category+" / "+g.state+" / "+g.evidence+": "+g.action),
  "- Ações acima são consultas ao acervo, não instruções de execução; não concedem autoridade ao sucessor.",
 ];

 // Deliberately don't include arbitrary strings from moduleTitle,
 // specialistRole, sourceRefs, evidence, warnings or external document bodies.
 const title="Módulo "+code;
 const section=(label:string,value:string|null)=>"- "+label+": "+(value??"NÃO COMPROVADO");
 const lines=[
  "# PACOTE OFICIAL DE ASSUNÇÃO — RASCUNHO CONSULTIVO AC-02",
  "",
  "Status: NÃO HOMOLOGADO — não é mandato, autorização, credencial ou publicação.",
  "Preparado em: "+input.preparedAt,
  "",
  "## 1. Identidade global — diretriz da Camada Mestre",
  section("Projeto",AC02_GLOBAL_IDENTITY.project),
  section("GitHub oficial",AC02_GLOBAL_IDENTITY.github),
  section("Branch oficial",AC02_GLOBAL_IDENTITY.githubBranch),
  section("Lovable oficial",AC02_GLOBAL_IDENTITY.lovableProjectId),
  section("Supabase Cloud oficial",AC02_GLOBAL_IDENTITY.cloudSupabaseProjectRef),
  section("Arquitetura de banco",AC02_GLOBAL_IDENTITY.cloudRelationship),
  section("Método de desenvolvimento",AC02_GLOBAL_IDENTITY.developmentMethod),
  "",
  "## 2. Ambientes e limites",
  "- Produção: Core Supabase Cloud vinculado ao Lovable; deploy e disponibilidade exigem verificação independente.",
  "- CI: PostgreSQL descartável; não é fonte produtiva.",
  "- Preview Lovable: isolamento de dados e homologação não presumidos.",
  "",
  "## 3. Contexto da especialidade",
  section("Módulo",title),
  section("Identificador funcional no Core",specialist.moduleId),
  "- Especialista: papel e titular dependem de mandato certificado; este rascunho não atribui identidade humana.",
  section("Método (FM-08)",method),
  section("Ecossistema (FM-08)",ecosystem),
  section("Escopo (FM-03)",scope),
  section("Checkpoint (FM-09)",checkpoint),
  "- Fontes privadas: não incluídas neste pacote; consultar no Núcleo sob acesso autorizado.",
  "",
  "## 4. Frentes e evidências técnicas (identificadores, não conteúdos)",
  ...(frontList.length?frontList:["- Sem frentes M3 no recorte"]),
  ...(evidenceList.length?evidenceList:["- Sem provas M4 no recorte"]),
  "- Estados M3/M4 declarados no Core; não demonstram CI/deploy/homologação atual.",
  "",
  "## 5. Síntese operacional da continuidade (consultiva)",
  ...summaryText,
  "",
  "## 6. Cobertura documental e checkpoint",
  ...coverageLines,
  "",
  "## 6A. Revisões AC-01 e conferência de pendências",
  "- Somente metadados sob JWT/RLS. Consultar as pendências e atos reais na área AC-01; não inferir decisão.",
  ...ac01Lines,
  "",
  "## 7. Estado de verificação",
  "- Identidade global: aprovada como diretriz; não equivale a deploy/CI atual.",
  "- Evidências técnicas mutáveis: NÃO transmitidas neste pacote; conferir GitHub, Core e provedores antes de executar.",
  "",
  "## 8. Pendências obrigatórias antes da assunção operacional",
  ...unresolved.map(item=>"- "+item),
  "",
  "## 9. Roteiro de recuperação de contexto para o sucessor",
  ...guideLines,
  "",
  "## 10. Inventário de lacunas de conhecimento (consultivo)",
  ...gapLines,
  "",
  "## 11. Visão de prontidão documental — somente leitura",
  ...readinessLines,
  "",
  "## 12. Condições de continuidade",
  "- Abrir fontes originais somente sob permissões próprias; este texto não transfere acessos.",
  "- Conferir mapa soberano Núcleo 2.0 V1.3, mandatos, escopo e versões com a Camada Mestre.",
  "- Não utilizar construtor visual Lovable por padrão; exceções exigem autorização específica.",
  "- Não iniciar Entrega B, homologar automaticamente nem criar banco Supabase externo independente.",
  "- O destinatário deve confirmar sua identidade e os acessos no novo chat.",
 ];
 return Object.freeze({
  kind:"nucleo_ac02_pacote_oficial_assuncao_rascunho",
  status:"rascunho_nao_homologado",version:"1.0",
  text:lines.join("\n"),unresolved:Object.freeze(unresolved),
  privateSourcesIncluded:false as const,
 });
}
