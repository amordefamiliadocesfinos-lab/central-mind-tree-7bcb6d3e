/**
 * AC-02 / Núcleo 2.0 V1.3 — P1/P2: projeção documental somente leitura.
 *
 * Autoridade sobre identidade GLOBAL: deliberação explícita Camada Mestre
 * (14/11/2026), não descoberta de runtime. Estado de GitHub, preview,
 * migração e deploy devem ser lidos das fontes originais de forma independente.
 * Não cria tabelas, concessões, endpoints, secretos ou segunda fonte.
 */
export type Ac02Domain = "identidade"|"repositorio"|"servico"|"ambiente"|"diretriz";
export type Ac02Evidence = "decisao_camada_mestre"|"codigo_observado"|"provedor_consultado"|"historico";
export type Ac02Validity = "declarado_oficial"|"verificado_fonte"|"historico"|"conflitante"|"indeterminado";
export type Ac02Visibility = "publico_nao_secreto"|"restrito_referencia";
export type Ac02Item = Readonly<{
 id:string;
 domain:Ac02Domain;
 label:string;
 value:string;
 authority:"Camada Mestre"|"fonte técnica";
 evidence:Ac02Evidence;
 validity:Ac02Validity;
 source:string;
 sourceVersion:string;
 checkedAt:string|null;
 visibility:Ac02Visibility;
 notes:string;
}>;

export const AC02_GLOBAL_IDENTITY = Object.freeze({
 project:"PAINEL CENTRAL — AMOR DE FAMÍLIA",
 github:"amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e",
 githubBranch:"main",
 lovableProjectId:"1720a410-34cd-4410-995c-8c92c7edf16b",
 cloudSupabaseProjectRef:"xkskyutmtlhivvpfxkjg",
 cloudRelationship:"Supabase Cloud oficial integrado ao Lovable Cloud",
 developmentMethod:"GitHub direto; construtor visual da Lovable não autorizado",
 authority:"Camada Mestre — AC-02 aprovado em 14/11/2026",
});

const AC02_MASTER_SOURCE = "Camada Mestre — AUTORIZAÇÃO DE CONTINUIDADE AC-02 — 14/11/2026";
const frozen = (data:Omit<Ac02Item,"authority"|"evidence"|"validity"|"source"|"sourceVersion"|"checkedAt"|"visibility">):Ac02Item => Object.freeze({
 ...data,authority:"Camada Mestre",evidence:"decisao_camada_mestre",validity:"declarado_oficial",
 source:AC02_MASTER_SOURCE,sourceVersion:"AC-02 autorizado / mapa V1.3 preservado",checkedAt:null,
 visibility:"publico_nao_secreto",
});
export const AC02_GLOBAL_ITEMS:readonly Ac02Item[]=Object.freeze([
 frozen({id:"ac02.project",domain:"identidade",label:"Projeto oficial",value:AC02_GLOBAL_IDENTITY.project,
 notes:"Identidade documental do ecossistema, não identificador de sessão."}),
 frozen({id:"ac02.github",domain:"repositorio",label:"Repositório GitHub oficial",value:AC02_GLOBAL_IDENTITY.github,
 notes:"A branch main é referência de código; merge não é deploy."}),
 frozen({id:"ac02.github.branch",domain:"repositorio",label:"Branch de referência",value:"main",
 notes:"O SHA deve ser conferido no GitHub ao executar, não copiado deste registro."}),
 frozen({id:"ac02.lovable",domain:"servico",label:"Projeto Lovable vinculado",value:AC02_GLOBAL_IDENTITY.lovableProjectId,
 notes:"Vinculação de projeto, não permissão de uso do construtor."}),
 frozen({id:"ac02.supabase",domain:"servico",label:"Supabase Cloud oficial",value:AC02_GLOBAL_IDENTITY.cloudSupabaseProjectRef,
 notes:"Banco operacional integrado ao Lovable Cloud; não assumir banco externo independente."}),
 frozen({id:"ac02.core.relationship",domain:"ambiente",label:"Core produtivo",value:AC02_GLOBAL_IDENTITY.cloudRelationship,
 notes:"Identidade de ambiente declarada. Deploy, saúde e migrations exigem provas datadas."}),
 frozen({id:"ac02.ci",domain:"ambiente",label:"PostgreSQL de CI",value:"PostgreSQL 17 descartável em GitHub Actions",
 notes:"Teste isolado, não é instância produtiva, homologação ou fonte de dados reais."}),
 frozen({id:"ac02.preview",domain:"ambiente",label:"Pré-visualização Lovable",value:"Ambiente de preview do projeto vinculado",
 notes:"Não presumir isolamento de banco nem uso homologado sem verificação."}),
 frozen({id:"ac02.method",domain:"diretriz",label:"Método de desenvolvimento",value:AC02_GLOBAL_IDENTITY.developmentMethod,
 notes:"A orientação genérica do README não revoga a deliberação da Camada Mestre."}),
 frozen({id:"ac02.secrets",domain:"diretriz",label:"Credenciais",value:"Não armazenar senhas, tokens, chaves, cookies ou secrets no Núcleo",
 notes:"Referenciar apenas o gestor de segredos autorizado; nunca distribuir valores."}),
 frozen({id:"ac02.governance",domain:"diretriz",label:"Autoridade e execução",value:"Sem mandatos ou permissões automáticas; CA-01–29 e M0–M5 preservados",
 notes:"AC-02 não autoriza publicação, homologação, Entrega B ou nova fonte soberana."}),
]);

export type Ac02DynamicEvidence=Readonly<{
 id:string;
 recordId:string;
 value:string;
 observedAt:string;
 source:string;
 sourceVersion:string;
 status:"observado"|"falha"|"indeterminado";
 visibility:Ac02Visibility;
}>;

export type Ac02Projection=Readonly<{
 kind:"nucleo_ac02_registro_mestre_consultivo";
 contractVersion:"1.0-proposta";
 identity:typeof AC02_GLOBAL_IDENTITY;
 stable:readonly Ac02Item[];
 observations:readonly Ac02DynamicEvidence[];
 conflicts:readonly string[];
 missingChecks:readonly string[];
 usageLimit:string;
}>;

// Segurança conservadora: não serializar entradas que pareçam segredos,
// inclusive se forem fornecidas por erro por outra fonte ou componente.
const SECRET_MARKER=/(?:\b(?:password|passwd|senha|token|secret|cookie|private[_ -]?key|service[_ -]?role|api[_ -]?key)\b\s*(?:[:=]|%3[dD]))|(?:-----BEGIN [A-Z ]*PRIVATE KEY-----)|(?:postgres(?:ql)?:\/\/[^\s]+)/i;
export const hasAc02Secret = (value:string):boolean=>SECRET_MARKER.test(value);

const validDate = (input:string)=>!Number.isNaN(Date.parse(input))&&/\d{4}-\d{2}-\d{2}T/.test(input);

export function buildAc02Registry(
 observed:readonly Ac02DynamicEvidence[],
 nowIso:string,
 maxAgeHours=24,
):Ac02Projection {
 if(!validDate(nowIso))throw new Error("AC02: reference time invalid");
 if(!Number.isFinite(maxAgeHours)||maxAgeHours<=0)throw new Error("AC02: maxAgeHours invalid");
 const clean:Ac02DynamicEvidence[]=[];
 const conflicts:string[]=[];
 const missingChecks:string[]=[];
 const known=new Map(AC02_GLOBAL_ITEMS.map(item=>[item.id,item]));
 const seen=new Set<string>();
 for(const row of observed){
  if(!known.has(row.recordId)){conflicts.push("Observação sem identidade global reconhecida: "+row.id);continue;}
  if(!row.id||seen.has(row.id)){conflicts.push("ID de evidência ausente ou repetido");continue;}
  seen.add(row.id);
  if(row.visibility!=="publico_nao_secreto"||hasAc02Secret(row.value)||
    hasAc02Secret(row.source)||hasAc02Secret(row.sourceVersion)||hasAc02Secret(row.id)||!validDate(row.observedAt)||!row.source.trim()||!row.sourceVersion.trim()){
   conflicts.push("Observação inválida ou sensível bloqueada: "+row.id);continue;
  }
  const age=Date.parse(nowIso)-Date.parse(row.observedAt);
  if(age<0||age>maxAgeHours*3600000){
   missingChecks.push("Verificação vencida/futura: "+row.recordId+" ("+row.id+")");
   continue;
  }
  if(row.status!=="observado")missingChecks.push("Verificação não concluída: "+row.recordId+" ("+row.id+")");
  // Observação NÃO substitui decisão estável, mesmo quando divergente.
  const base=known.get(row.recordId)!;
  if(row.status==="observado"&&
    ["ac02.github","ac02.github.branch","ac02.lovable","ac02.supabase"].includes(base.id)&&
    row.value!==base.value)conflicts.push("Divergência de identidade declarada: "+base.id+" ("+row.id+")");
  clean.push(Object.freeze({...row}));
 }
 return Object.freeze({
  kind:"nucleo_ac02_registro_mestre_consultivo",contractVersion:"1.0-proposta",
  identity:AC02_GLOBAL_IDENTITY,stable:AC02_GLOBAL_ITEMS,
  observations:Object.freeze(clean),conflicts:Object.freeze(conflicts),missingChecks:Object.freeze(missingChecks),
  usageLimit:"Apenas metadados não secretos; autoridade = Camada Mestre, estado técnico exige consulta ao provedor; não concede acesso, mandato, deploy nem homologação.",
 });
}

export type Ac02SpecialistContext=Readonly<{
 moduleId:string;moduleCode:string;specialistRole:string;
 methodRef:string|null;ecosystemRef:string|null;scopeRef:string|null;
 checkpointRef:string|null;sourceRefs:readonly string[];
 checkedAt:string|null;
 access:"autorizado_consulta"|"nao_verificado";
}>;

export function prepareAc02AssumptionDraft(
 projection:Ac02Projection,
 context:Ac02SpecialistContext,
):Readonly<{kind:"nucleo_ac02_assuncao_rascunho";global:Ac02Projection;specialist:Ac02SpecialistContext;warnings:readonly string[]}> {
 const warnings:string[]=[
 "Pacote consultivo: não concede autoridade, conexão, credencial ou acesso.",
 "Conferir a fonte original, o mandato e a Ficha Viva antes de declarar método vigente.",
 ];
 if(context.access!=="autorizado_consulta")warnings.push("Permissão específica do especialista não verificada; não distribuir fontes privadas.");
 if(!context.moduleId||!context.moduleCode||!context.specialistRole)
   warnings.push("Identidade funcional incompleta: não usar para assunção automática.");
 if(!context.methodRef||!context.ecosystemRef||!context.scopeRef||!context.checkpointRef)
   warnings.push("Método, ecossistema, escopo ou checkpoint sem referência confirmada.");
 if(projection.conflicts.length||projection.missingChecks.length)
   warnings.push("Registro global possui divergências ou estados técnicos vencidos; exigir reconciliação.");
 const safeSources=context.access==="autorizado_consulta"
  ?context.sourceRefs.filter(s=>!hasAc02Secret(s)):[] as string[];
 const safe={...context,
  methodRef:context.methodRef&&!hasAc02Secret(context.methodRef)?context.methodRef:null,
  ecosystemRef:context.ecosystemRef&&!hasAc02Secret(context.ecosystemRef)?context.ecosystemRef:null,
  scopeRef:context.scopeRef&&!hasAc02Secret(context.scopeRef)?context.scopeRef:null,
  checkpointRef:context.checkpointRef&&!hasAc02Secret(context.checkpointRef)?context.checkpointRef:null,
  sourceRefs:Object.freeze(safeSources)};
 return Object.freeze({kind:"nucleo_ac02_assuncao_rascunho",global:projection,
  specialist:Object.freeze(safe),warnings:Object.freeze(warnings)});
}
