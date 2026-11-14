/**
 * AC-02 / CA-29 — projeção somente leitura do futuro ledger de repasses.
 * Contrato de apresentação para UX: nenhum banco, envio ou decisão.
 * A existência dos eventos no Core não é inferida por esta função.
 */
export type Ac02EventKind=
 "preparado"|"disponibilizado"|"entregue"|"recebido"|"aceito"|
 "falha"|"expirado"|"retificado";
export type Ac02EvidenceClass=
 "declaracao_gestor"|"confirmacao_destinatario"|"referencia_externa";
export type Ac02HandoffEvent=Readonly<{
 id:string;package_id:string;package_version:string;package_sha256:string;
 module_id:string;specialist_role_code:string;
 recipient_kind:"sucessor_humano"|"novo_chat_ia";
 recipient_auth_uid:string|null;event_kind:Ac02EventKind;
 previous_event_id:string|null;evidence_class:Ac02EvidenceClass;
 evidence_ref:string|null;source_ref:string;
 expires_at:string;request_id:string;actor_auth_uid:string;recorded_at:string;
}>;
export type Ac02HandoffProjection=Readonly<{
 kind:"nucleo_ac02_historico_consultivo";
 status:"sem_eventos"|"cadeia_consistente"|"cadeia_inconsistente";
 stages:readonly Readonly<{
  kind:Ac02EventKind;eventId:string;recordedAt:string;
  assertedBy:"gestor"|"destinatario_humano";
  classification:"declaracao"|"confirmacao_humana";
 }>[];
 latest:Ac02EventKind|null;
 warnings:readonly string[];
 caveat:string;
}>;

const transitions:Readonly<Record<Ac02EventKind,readonly Ac02EventKind[]>>={
 preparado:["disponibilizado","falha","expirado","retificado"],
 disponibilizado:["entregue","falha","expirado","retificado"],
 entregue:["recebido","falha","expirado","retificado"],
 recebido:["aceito","retificado"],
 aceito:["retificado"],
 falha:["retificado"],
 expirado:["retificado"],
 retificado:[],
};
export function projectAc02HandoffHistory(events:readonly Ac02HandoffEvent[]):Ac02HandoffProjection{
 const warnings:string[]=[];
 const empty={kind:"nucleo_ac02_historico_consultivo" as const,
  status:"sem_eventos" as const,stages:[] as const,latest:null,
  warnings:[] as const,caveat:"Consulta não equivale a transferência de sessão, mandato, documento privado ou homologação."};
 if(events.length===0)return empty;
 // A resposta deve vir de consulta autorizada; nunca promover um array externo
 // não verificado a evidência de recebimento ou aceite.
 const root=events.filter(e=>e.previous_event_id===null);
 if(root.length!==1||events.length>100)warnings.push("Histórico não possui raiz única ou excede o limite");
 const byId=new Map(events.map(e=>[e.id,e]));
 if(byId.size!==events.length)warnings.push("Identificadores de eventos repetidos");
 const packageId=events[0].package_id;
 const seenRequests=new Set<string>();
 const expiry=Date.parse(events[0].expires_at);
 if(!Number.isFinite(expiry))warnings.push("Data de validade inválida");
 if(!/^[0-9a-f]{64}$/.test(events[0].package_sha256))
  warnings.push("Hash do pacote fora do formato SHA-256");
 for(const e of events){
  if(!e.request_id||seenRequests.has(e.request_id))
   warnings.push("Identificador de solicitação ausente ou repetido");
  seenRequests.add(e.request_id);
  const observed=Date.parse(e.recorded_at);
  if(!Number.isFinite(observed))warnings.push("Data de evento inválida");
  else if(Number.isFinite(expiry)){
   if(e.event_kind==="expirado"&&observed<expiry)
    warnings.push("Expiração registrada antes do prazo");
   if(!["falha","expirado","retificado"].includes(e.event_kind)&&observed>expiry)
    warnings.push("Evento operacional registrado após vencimento");
  }
  if(e.evidence_class==="referencia_externa"&&!e.evidence_ref)
   warnings.push("Evidência externa sem referência");
  if(e.package_id!==packageId||e.package_sha256!==events[0].package_sha256||
   e.package_version!==events[0].package_version||e.module_id!==events[0].module_id||
   e.recipient_kind!==events[0].recipient_kind||
   e.recipient_auth_uid!==events[0].recipient_auth_uid||
   e.specialist_role_code!==events[0].specialist_role_code||
   e.source_ref!==events[0].source_ref||e.expires_at!==events[0].expires_at)
   warnings.push("Identidade ou versão do pacote divergente");
  if(e.event_kind==="recebido"||e.event_kind==="aceito"){
   if(e.recipient_kind!=="sucessor_humano"||e.actor_auth_uid!==e.recipient_auth_uid||
      e.evidence_class!=="confirmacao_destinatario")
    warnings.push("Confirmação sem autoria humana verificável no registro");
  }else if(e.evidence_class==="confirmacao_destinatario"){
   warnings.push("Declaração foi classificada indevidamente como confirmação");
  }
 }
 const stages:Ac02HandoffProjection["stages"][number][]=[];
 const used=new Set<string>();
 let current=root[0];
 while(current&&!used.has(current.id)&&used.size<=100){
  used.add(current.id);
  if(stages.length===0&&current.event_kind!=="preparado")
   warnings.push("A cadeia não começa por preparado");
  if(stages.length>0){
   const prev=stages[stages.length-1].kind;
   if(!transitions[prev].includes(current.event_kind))warnings.push("Transição inválida: "+prev+" → "+current.event_kind);
   if(Date.parse(current.recorded_at)<Date.parse(stages[stages.length-1].recordedAt))
    warnings.push("Cronologia da cadeia invertida");
  }
  stages.push({
   kind:current.event_kind,eventId:current.id,recordedAt:current.recorded_at,
   assertedBy:current.event_kind==="recebido"||current.event_kind==="aceito"?"destinatario_humano":"gestor",
   classification:current.event_kind==="recebido"||current.event_kind==="aceito"?"confirmacao_humana":"declaracao",
  });
  const next=events.filter(e=>e.previous_event_id===current!.id);
  if(next.length>1)warnings.push("Cadeia com eventos sucessores concorrentes");
  current=next[0];
 }
 if(current)warnings.push("Ciclo no histórico");
 if(used.size!==events.length)warnings.push("Eventos órfãos ou não relacionados à cadeia");
 const consistent=warnings.length===0;
 return {
  kind:"nucleo_ac02_historico_consultivo",
  status:consistent?"cadeia_consistente":"cadeia_inconsistente",
  stages,latest:consistent?stages[stages.length-1]?.kind??null:null,
  warnings:Array.from(new Set(warnings)),
  caveat:"Estados são eventos registrados, não certificação de entrega externa; recibo humano exige autenticação do destinatário e fonte consultada sob RLS.",
 };
}
