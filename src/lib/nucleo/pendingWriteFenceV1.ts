import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {fingerprint,isWriteWitness,type WriteWitness} from "@/lib/nucleo/writeRecoveryWitnessV1";

/**
 * Trava de integridade local, não evidência de gravação no Core.
 * Persistimos APENAS um marcador opaco, sem conteúdo da minuta, fontes ou tokens.
 * Na reabertura não é possível reconstruir o snapshot: a trava fica ativa
 * até reconciliação externa demonstrada. Não oferecer botão de descarte.
 */
type FenceState={ready:boolean;blocked:boolean;witness:WriteWitness|null};
const PREFIX="nucleo_pending_write_v1";
export function usePendingWriteFence(kind:"fm"|"ac01",moduleId:string){
 const [state,setState]=useState<FenceState>({ready:false,blocked:true,witness:null});
 const keyRef=useRef<string|null>(null);
 const witnessRef=useRef<WriteWitness|null>(null);
 const [authEpoch,setAuthEpoch]=useState(0);
 useEffect(()=>{
   const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
     if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED"){
       keyRef.current=null;witnessRef.current=null;
       setState({ready:false,blocked:true,witness:null});setAuthEpoch(n=>n+1);
     }
   });
   return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
   let active=true;
   keyRef.current=null;
   witnessRef.current=null;
   setState({ready:false,blocked:true,witness:null});
   void supabase.auth.getUser().then(({data,error})=>{
     if(!active)return;
     if(error||!data.user){setState({ready:false,blocked:true,witness:null});return;}
     const key=[PREFIX,data.user.id,kind,moduleId].join(":");
     try{
       const raw=window.localStorage.getItem(key);
       const blocked=raw!==null;
       let candidate:unknown=null;
       if(raw&&raw!=="pending"){try{candidate=JSON.parse(raw);}catch{/* legacy fail-closed */}}
       const witness=isWriteWitness(candidate)&&candidate.kind===kind&&candidate.moduleId===moduleId?candidate:null;
       keyRef.current=key;
       witnessRef.current=witness;
       setState({ready:true,blocked,witness});
     }catch{
       keyRef.current=null;
       setState({ready:false,blocked:true,witness:null});
     }
   }).catch(()=>{if(active)setState({ready:false,blocked:true,witness:null});});
   return()=>{active=false;keyRef.current=null;witnessRef.current=null;};
 },[kind,moduleId,authEpoch]);
 // Uma segunda aba pode criar/alterar uma pendência enquanto esta está aberta.
 // Os eventos de storage atualizam a UI; a escrita também reconsulta a chave.
 useEffect(()=>{
   const handleStorage=(event:StorageEvent)=>{
     const key=keyRef.current;
     if(!key||event.storageArea!==window.localStorage||
       (event.key!==key&&event.key!==null))return;
     try{
       const raw=window.localStorage.getItem(key);
       let candidate:unknown=null;
       if(raw&&raw!=="pending"){try{candidate=JSON.parse(raw);}catch{/* fail-closed */}}
       const witness=isWriteWitness(candidate)&&candidate.kind===kind&&candidate.moduleId===moduleId?candidate:null;
       witnessRef.current=witness;
       setState({ready:true,blocked:raw!==null,witness});
     }catch{setState({ready:false,blocked:true,witness:null});}
   };
   window.addEventListener("storage",handleStorage);
   return()=>window.removeEventListener("storage",handleStorage);
 },[kind,moduleId,authEpoch]);
 const markStarted=useCallback((witness?:WriteWitness)=>{
   const key=keyRef.current;
   if(!key||!state.ready||state.blocked|| (witness&&(witness.kind!==kind||witness.moduleId!==moduleId||!isWriteWitness(witness))))return false;
   if(witness?.authUid&&key!==[PREFIX,witness.authUid,kind,moduleId].join(":"))return false;
   try{
     // A leitura do React pode estar obsoleta após gravação em outra aba.
     // Nunca sobrescrever a pendência anterior, mesmo com state.blocked falso.
     if(window.localStorage.getItem(key)!==null){
       setState({ready:true,blocked:true,witness:null});
       return false;
     }
     window.localStorage.setItem(key,witness?JSON.stringify(witness):"pending");
     witnessRef.current=witness??null;
     setState({ready:true,blocked:true,witness:witness??null});
     return true;
   }catch{
     setState({ready:false,blocked:true,witness:null});
     return false;
   }
 },[state.ready,state.blocked,kind,moduleId]);
 const clearConfirmed=useCallback((expected:WriteWitness|undefined)=>{
   const key=keyRef.current;
   if(!key||!expected)return false;
   try{
     const current=window.localStorage.getItem(key);
     // O marcador pode ter mudado em outra aba ou entre a gravação e o readback.
     if(current===null)return false;
     const witness=witnessRef.current;
     if(JSON.stringify(expected)!==JSON.stringify(witness))return false;
     if(witness?current!==JSON.stringify(witness):current!=="pending")return false;
     window.localStorage.removeItem(key);
     witnessRef.current=null;
     setState({ready:true,blocked:false,witness:null});
     return true;
   }catch{
     setState({ready:false,blocked:true,witness:null});
     return false;
   }
 },[]);
 const verifyAndClear=useCallback(async(fields:unknown[],identity:{requestId?:string;section?:string;version?:number})=>{
   const key=keyRef.current;
   const witness=witnessRef.current;
   if(!key||!state.ready||!state.blocked||!witness)return false;
   if(witness.kind!==kind||witness.moduleId!==moduleId)return false;
   if(kind==="fm"&&(identity.section!==witness.section||identity.version!==witness.version))return false;
   if(kind==="ac01"&&identity.requestId!==witness.requestId)return false;
   try{
     if(await fingerprint(fields,witness.salt)!==witness.digest)return false;
     if(keyRef.current!==key||witnessRef.current!==witness)return false;
     // Evitar liberar trava alterada por outra aba enquanto a leitura ocorria.
     if(window.localStorage.getItem(key)!==JSON.stringify(witness))return false;
     window.localStorage.removeItem(key);
     witnessRef.current=null;
     setState({ready:true,blocked:false,witness:null});
     return true;
   }catch{return false;}
 },[state.witness,state.ready,state.blocked,kind,moduleId]);
 return {...state,markStarted,clearConfirmed,verifyAndClear};
}
