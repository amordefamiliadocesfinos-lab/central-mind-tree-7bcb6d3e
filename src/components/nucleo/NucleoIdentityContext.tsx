import {useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {useAuth} from '@/contexts/AuthContext';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {isIdentityAssignments,isIdentityContext,type IdentityAssignment,type IdentityContext} from '@/lib/nucleo/identityContext';

// Candidate RPCs are optional. No DDL/deploy is triggered by this component.
type CandidateDB={public:{Tables:Record<string,never>;Views:Record<string,never>;Enums:Record<string,never>;CompositeTypes:Record<string,never>;
 Functions:{nucleo_identity_assignments_read:{Args:{module_id:string};Returns:unknown};nucleo_identity_context_read:{Args:{assignment_id:string};Returns:unknown}}}};
const client=supabase as unknown as SupabaseClient<CandidateDB>;
export default function NucleoIdentityContext({moduleId,frontId}:{moduleId:string;frontId:string|null}){
 const {session,loading}=useAuth();const uid=loading?null:session?.user.id??null;
 const owner=useRef('');owner.current=[uid,moduleId,frontId].join('|');
 const [rows,setRows]=useState<IdentityAssignment[]>([]),[context,setContext]=useState<IdentityContext|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[snapshotOwner,setSnapshotOwner]=useState('');
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setRows([]);setContext(null);setError('');setBusy(false);setSnapshotOwner('');},[uid,moduleId,frontId]);
 useEffect(()=>{
  if(!context)return;
  // Recheck every second to avoid displaying content past its grant expiry.
  const timer=setInterval(()=>{if(Date.parse(context.valid_until)<=Date.now()){setContext(null);setRows([]);setError('Prazo da consulta encerrado. Consulte novamente.');}},1000);
  return()=>clearInterval(timer);
 },[context]);
 async function read(assignmentId?:string){
  if(!uid||busy)return;const request=++generation.current,requestOwner=owner.current;
  setBusy(true);setError('');setContext(null);setRows([]);setSnapshotOwner('');
  try{
   const user=await supabase.auth.getUser();if(user.error||user.data.user?.id!==uid)throw new Error('Sessão pessoal não comprovada.');
   const response=assignmentId
    ?await client.rpc('nucleo_identity_context_read',{assignment_id:assignmentId})
    :await client.rpc('nucleo_identity_assignments_read',{module_id:moduleId});
   if(response.error)throw new Error('Consulta relacional indisponível ou não autorizada. O contrato candidato depende de implantação específica.');
   const current=await supabase.auth.getUser();
   if(current.error||current.data.user?.id!==uid||owner.current!==requestOwner||request!==generation.current)return;
   if(assignmentId){
    if(!isIdentityContext(response.data,uid,moduleId,assignmentId)||
      (frontId!==null&&response.data.front_id!==frontId&&response.data.front_id!==null))
      throw new Error('Contexto negado, expirado ou incompatível com esta ficha.');
    setContext(response.data);
   }else{
    if(!isIdentityAssignments(response.data))throw new Error('Lista relacional incompleta ou inválida.');
    setRows(response.data.filter(x=>frontId===null||x.front_id===null||x.front_id===frontId));
    if(response.data.length===0)setError('Nenhum vínculo com leitura autorizada neste recorte. O responsável textual permanece uma declaração.');
   }
   setSnapshotOwner(requestOwner);
  }catch(e){if(owner.current===requestOwner&&request===generation.current)setError(e instanceof Error?e.message:'Consulta indisponível.');}
  finally{if(owner.current===requestOwner&&request===generation.current)setBusy(false);}
 }
 const visible=snapshotOwner===owner.current&&context&&Date.parse(context.valid_until)>Date.now()?context:null;
 return <details className="rounded-lg border p-3 space-y-3" aria-label="Especialidades e vínculos relacionais">
  <summary className="cursor-pointer text-sm font-semibold">Especialidades e vínculos de atuação</summary>
  <p className="mt-3 text-xs text-muted-foreground">Consulta opcional do cadastro relacional. O nome declarado na ficha não comprova identidade ou mandato.</p>
  <Button type="button" size="sm" variant="outline" disabled={!uid||busy} onClick={()=>void read()}>{busy?'Consultando…':'Consultar meus vínculos neste módulo'}</Button>
  {error&&<p role="status" className="text-xs text-muted-foreground">{error}</p>}
  {snapshotOwner===owner.current&&rows.map(row=><Button key={row.assignment_id} type="button" size="sm" variant="outline"
   className="m-1 h-auto min-h-11 whitespace-normal" onClick={()=>void read(row.assignment_id)}>{row.specialty_title} · {row.responsibility==='primary'?'responsável principal':'colaborador'}</Button>)}
  {visible&&<div className="space-y-3 text-xs">
   <h5 className="font-semibold">{visible.specialty_title} · {visible.specialty_code}</h5>
   <dl className="grid gap-3 sm:grid-cols-2 break-words">
    <div><dt>Método geral · referência</dt><dd>{visible.general_method_ref}</dd></div>
    <div><dt>Adaptação contextual · referência</dt><dd>{visible.local_method_ref??'Não vinculada'}</dd></div>
    <div><dt>Origem do vínculo</dt><dd>{visible.provenance_ref}</dd></div>
    <div><dt>Consulta</dt><dd>{new Date(visible.checked_at).toLocaleString('pt-BR')} · válida até {new Date(visible.valid_until).toLocaleString('pt-BR')}</dd></div>
   </dl>
   <p>Leitura consultiva, sem mandato ou vigência certificada. Revogações são verificadas em cada nova consulta.</p>
   {visible.references.map(ref=><article key={ref.id} className="rounded border p-2 space-y-1 break-words">
    <p className="font-medium">{ref.label}</p><p>{ref.source_ref}</p>
    <p className="break-all">{ref.contribution_id?'AC-01':ref.fm_id?'FM':ref.evidence_id?'M4':'Checkpoint M3/F5'}: {ref.contribution_id??ref.fm_id??ref.evidence_id??ref.event_id}</p>
   </article>)}
   {visible.references.length===0&&<p>Nenhuma referência revisada disponível. Não significa ausência de histórico.</p>}
  </div>}
 </details>;
}
