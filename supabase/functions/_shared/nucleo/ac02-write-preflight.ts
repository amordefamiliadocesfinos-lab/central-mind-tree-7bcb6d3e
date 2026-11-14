/**
 * AC-02 — schema do CANDIDATO à escrita, não decisão de autorização.
 * Sem banco, Auth, fetch, secrets nem submissão. Só pré-validação de dados.
 * Mesmo um candidato válido tem de passar pelo gateway server-side e por
 * fonte autoritativa de sessões, capability/identidade e RLS.
 */
import type { Ac02PackageManifest } from "./ac02-package-manifest.ts";
import type { Ac02EventKind, Ac02EvidenceClass } from "./ac02-handoff-ledger-contract.ts";

export type Ac02WriteCandidate=Readonly<{
 packageId:string;
 packageVersion:"1.0";
 packageSha256:string;
 moduleId:string;
 specialistRoleCode:string;
 recipientKind:"sucessor_humano"|"novo_chat_ia";
 recipientAuthUid:string|null;
 eventKind:Ac02EventKind;
 previousEventId:string|null;
 evidenceClass:Ac02EvidenceClass;
 evidenceRef:string|null;
 sourceRef:string;
 expiresAt:string;
 requestId:string;
}>;
export type Ac02WritePreflight=Readonly<{
 kind:"nucleo_ac02_write_preflight";
 state:"candidate_only_no_authority"|"rejected";
 reasons:readonly string[];
 sessionVerified:false;
 capabilityVerified:false;
 evidenceVerified:false;
 packageOriginVerified:false;
 writesPerformed:false;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// UUID v4/other accepted by DB; must be 8-4-4-4-12, not the shortened pattern above.
const uuidExact=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref=/^[a-zA-Z0-9][a-zA-Z0-9_./:-]{2,179}$/;
const timestamp=(v:string)=>Number.isFinite(Date.parse(v))&&/^\d{4}-\d\d-\d\dT/.test(v);
const needsProof=new Set<Ac02EventKind>(["entregue","falha","retificado"]);
const humanConfirmation=new Set<Ac02EventKind>(["recebido","aceito"]);
const kinds=new Set<Ac02EventKind>(["preparado","disponibilizado","entregue","recebido","aceito","falha","expirado","retificado"]);
const classes=new Set<Ac02EvidenceClass>(["declaracao_gestor","confirmacao_destinatario","referencia_externa"]);

/**
 * A função não recebe JWT, user id alegado, indicador de sessão ou
 * autorização digitada pelo usuário. Tais verificações exigem servidor.
 */
export function preflightAc02WriteCandidate(
 event:Ac02WriteCandidate,
 manifest:Ac02PackageManifest,
):Ac02WritePreflight{
 const errors:string[]=[];
 if(!uuidExact.test(event.packageId)||!uuidExact.test(event.moduleId)||
    !uuidExact.test(event.requestId)||
    (event.previousEventId!==null&&!uuidExact.test(event.previousEventId)))
  errors.push("IDs do Core inválidos");
 if(event.packageVersion!=="1.0"||!/^[a-f0-9]{64}$/.test(event.packageSha256)||
    event.packageId!==manifest.packageId||
    event.packageSha256!==manifest.packageSha256||
    event.packageVersion!==manifest.packageVersion)
  errors.push("Versão/identidade do manifesto divergente");
 if(manifest.kind!=="nucleo_ac02_package_manifest"||
    manifest.provenance!=="local_computed_not_authenticated"||
    manifest.delivered!==false||manifest.accepted!==false)
  errors.push("Manifesto não corresponde ao contrato");
 if(!/^[a-z][a-z0-9_]{2,49}$/.test(event.specialistRoleCode)||
    !ref.test(event.sourceRef)||!timestamp(event.expiresAt))
  errors.push("Identidade funcional, fonte ou validade inválida");
 if(event.recipientKind!==manifest.recipientKind||
    event.recipientAuthUid!==manifest.recipientAuthUid||
    (event.recipientKind==="sucessor_humano"&&!event.recipientAuthUid)||
    (event.recipientKind==="novo_chat_ia"&&event.recipientAuthUid!==null))
  errors.push("Destinatário divergente");
 if(!kinds.has(event.eventKind)||!classes.has(event.evidenceClass))
  errors.push("Tipo de evento/evidência inválido");
 if(event.eventKind==="preparado"&&event.previousEventId!==null||
    event.eventKind!=="preparado"&&event.previousEventId===null)
  errors.push("Antecessor incompatível");
 if(needsProof.has(event.eventKind)||event.evidenceClass==="referencia_externa"){
  if(!event.evidenceRef||!ref.test(event.evidenceRef))
   errors.push("Evento exige referência de evidência");
 }else if(event.evidenceRef!==null&&!ref.test(event.evidenceRef)){
  errors.push("Referência de evidência inválida");
 }
 if(humanConfirmation.has(event.eventKind)){
  if(event.recipientKind!=="sucessor_humano"||
     event.evidenceClass!=="confirmacao_destinatario")
   errors.push("Confirmação humana incompatível");
 }else if(event.evidenceClass==="confirmacao_destinatario"){
  errors.push("Declaração não é confirmação humana");
 }
 return Object.freeze({
  kind:"nucleo_ac02_write_preflight" as const,
  state:errors.length?"rejected" as const:"candidate_only_no_authority" as const,
  reasons:Object.freeze(errors),
  sessionVerified:false as const,
  capabilityVerified:false as const,
  evidenceVerified:false as const,
  packageOriginVerified:false as const,
  writesPerformed:false as const,
 });
}
