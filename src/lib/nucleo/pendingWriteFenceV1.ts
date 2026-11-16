import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Trava de integridade local, não evidência de gravação no Core.
 * Persistimos APENAS um marcador opaco, sem conteúdo da minuta, fontes ou tokens.
 * Na reabertura não é possível reconstruir o snapshot: a trava fica ativa
 * até reconciliação externa demonstrada. Não oferecer botão de descarte.
 */
type FenceState={ready:boolean;blocked:boolean};
const PREFIX="nucleo_pending_write_v1";
export function usePendingWriteFence(kind:"fm"|"ac01",moduleId:string){
 const [state,setState]=useState<FenceState>({ready:false,blocked:true});
 const keyRef=useRef<string|null>(null);
 const [authEpoch,setAuthEpoch]=useState(0);
 useEffect(()=>{
   const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
     if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED")setAuthEpoch(n=>n+1);
   });
   return ()=>subscription.unsubscribe();
 },[]);
 useEffect(()=>{
   let active=true;
   keyRef.current=null;
   setState({ready:false,blocked:true});
   void supabase.auth.getUser().then(({data,error})=>{
     if(!active)return;
     if(error||!data.user){setState({ready:false,blocked:true});return;}
     const key=[PREFIX,data.user.id,kind,moduleId].join(":");
     try{
       const blocked=window.localStorage.getItem(key)!==null;
       keyRef.current=key;
       setState({ready:true,blocked});
     }catch{
       keyRef.current=null;
       setState({ready:false,blocked:true});
     }
   }).catch(()=>{if(active)setState({ready:false,blocked:true});});
   return()=>{active=false;keyRef.current=null;};
 },[kind,moduleId,authEpoch]);
 const markStarted=useCallback(()=>{
   const key=keyRef.current;
   if(!key||!state.ready||state.blocked)return false;
   try{
     window.localStorage.setItem(key,"pending");
     setState({ready:true,blocked:true});
     return true;
   }catch{
     setState({ready:false,blocked:true});
     return false;
   }
 },[state.ready,state.blocked]);
 const clearConfirmed=useCallback(()=>{
   const key=keyRef.current;
   if(!key)return false;
   try{
     window.localStorage.removeItem(key);
     setState({ready:true,blocked:false});
     return true;
   }catch{
     setState({ready:false,blocked:true});
     return false;
   }
 },[]);
 return {...state,markStarted,clearConfirmed};
}
