/**
 * AC-02 / CA-29 — contrato de exportação de um RASCUNHO de assunção.
 * O exportador só recebe uma projeção previamente autorizada do endpoint
 * nucleo-knowledge-read. NÃO consulta banco, assina documento, concede
 * acesso, publica fontes ou transmite para outro chat.
 */
import {
 AC02_GLOBAL_ITEMS, AC02_GLOBAL_IDENTITY,
 type Ac02Projection, type Ac02SpecialistContext,
} from "./ac02-registry-contract.ts";

export type Ac02AssumptionInput=Readonly<{
 projection:Ac02Projection;
 specialist:Ac02SpecialistContext;
 moduleTitle:string;
 preparedAt:string;
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
  !/^\\d{4}-\\d{2}-\\d{2}T/.test(input.preparedAt))
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
  "## 4. Estado de verificação",
  "- Identidade global: aprovada como diretriz; não equivale a deploy/CI atual.",
  "- Evidências técnicas mutáveis: NÃO transmitidas neste pacote; conferir GitHub, Core e provedores antes de executar.",
  "",
  "## 5. Pendências obrigatórias antes da assunção operacional",
  ...unresolved.map(item=>"- "+item),
  "",
  "## 6. Condições de continuidade",
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
