import { useEffect, useState } from "react";
import { f24ApprovedAssets, selectF24BundledAssets } from "../cch/f24MediaPrototype";
import { Info } from "lucide-react";
import { HealthMovementSample } from "./HealthMovementSample";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import type { ExerciseCatalogItem } from "../hooks/useHealthCatalogs";

/** Read-only M2 reference. No new media URLs, Storage or inferred technique. */
export function HealthExerciseMovementPreview({exercise,name}:{exercise?:ExerciseCatalogItem;name:string}){
 const [open,setOpen]=useState(false);
 const [playingGif,setPlayingGif]=useState<string|null>(null);
 const [failed,setFailed]=useState<string[]>([]);
 const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
 useEffect(()=>{
  const query=window.matchMedia("(prefers-reduced-motion: reduce)");
  const sync=()=>{setReduced(query.matches);if(query.matches)setPlayingGif(null);};
  sync();query.addEventListener("change",sync);
  return ()=>query.removeEventListener("change",sync);
 },[]);
 const media=exercise?selectF24BundledAssets(exercise.id,f24ApprovedAssets):[];
 const visibleMedia=media.filter(asset=>!failed.includes(asset.mediaId));
 const muscles=[...new Set(exercise?.muscles.filter(x=>x.role==="primary"&&x.muscle).map(x=>x.muscle!.name)??[])];
 const equipment=[...new Set(exercise?.equipment.filter(x=>x.equipmentItem).map(x=>x.equipmentItem!.name)??[])];
 return <Dialog open={open} onOpenChange={next=>{setOpen(next);if(!next){setPlayingGif(null);setFailed([]);}}}>
  <DialogTrigger asChild>
   <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={"Ver movimento: "+name}>
    <Info className="h-5 w-5" aria-hidden="true"/>
   </Button>
  </DialogTrigger>
  <DialogContent className="max-h-[85dvh] w-[calc(100%-1rem)] max-w-md gap-3 overflow-y-auto rounded-xl p-4 motion-reduce:animate-none [&>button.absolute]:h-11 [&>button.absolute]:w-11 [&>button.absolute]:right-1 [&>button.absolute]:top-1 [&>button.absolute]:flex [&>button.absolute]:items-center [&>button.absolute]:justify-center">
   <div className="min-w-0 pr-10">
    <p className="text-xs font-medium text-muted-foreground">Guia visual do exercício</p>
    <DialogTitle className="mt-1 break-words text-xl">{name}</DialogTitle>
    <DialogDescription className="mt-1 text-xs">Referência geral do catálogo. O cronômetro continua funcionando.</DialogDescription>
   </div>
   <div className="space-y-3 text-sm">
    {open && exercise && visibleMedia.length===0?<HealthMovementSample key={exercise.id} exerciseId={exercise.id}/>:null}
    {open?visibleMedia.map(asset=><div key={asset.mediaId} className="space-y-2 rounded-lg border p-2">
      {asset.kind==="image"?<img src={asset.path} alt={asset.altText} className="max-h-64 w-full object-contain" loading="lazy" onError={()=>setFailed(prev=>[...prev,asset.mediaId])}/>:
        asset.kind==="video"?<video src={asset.path} controls muted playsInline preload="none" aria-label={asset.altText} className="max-h-64 w-full" onError={()=>setFailed(prev=>[...prev,asset.mediaId])}/>:
        reduced?<p className="text-xs">Animação GIF desativada pela preferência de movimento reduzido. Consulte a referência estática.</p>:
        <><Button type="button" variant="outline" className="min-h-11 w-full" onClick={()=>setPlayingGif(playingGif===asset.mediaId?null:asset.mediaId)}>{playingGif===asset.mediaId?"Parar animação":"Reproduzir animação"}</Button>
        {playingGif===asset.mediaId?<img src={asset.path} alt={asset.altText} className="max-h-64 w-full object-contain" onError={()=>setFailed(prev=>[...prev,asset.mediaId])}/>:null}</>}
      <p className="text-xs">{asset.altText}</p>
      <p className="text-xs text-muted-foreground">Demonstração geral · {asset.author} · <a className="underline" href={asset.licenseUrl} target="_blank" rel="noopener noreferrer">{asset.licenseId}</a> · <a className="underline" href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">Origem</a> · Alterações: {asset.changesDescription}</p>
    </div>):null}
    {visibleMedia.length===0?<p className="text-xs text-muted-foreground">Demonstração visual aprovada ainda não disponível.</p>:null}
    {failed.length>0?<p className="text-xs text-muted-foreground">Algumas mídias não puderam ser carregadas; consulte a referência textual.</p>:null}
    <section className="space-y-2 rounded-lg bg-muted/25 p-3" aria-label="Identificação pelo catálogo M2">
     <p className="text-xs font-semibold">Equipamentos do catálogo</p>
     {equipment.length?<div className="flex flex-wrap gap-1.5">{equipment.map(item=><span key={item} className="max-w-full break-words rounded-md border bg-background px-2 py-1 text-xs">{item}</span>)}</div>:<p className="text-xs text-muted-foreground">Informação não disponível.</p>}
     <p className="text-xs text-muted-foreground">O catálogo não confirma qual aparelho físico você está utilizando.</p>
     <p className="text-xs font-semibold">Músculos principais</p>
     <p className="text-xs">{muscles.length?muscles.join(", "):"Informação não disponível."}</p>
    </section>
    <DialogClose asChild><Button type="button" variant="outline" className="min-h-11 w-full">Voltar ao treino</Button></DialogClose>
   </div>
  </DialogContent>
 </Dialog>;
}
