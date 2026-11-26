import { useState } from "react";
import { f24ApprovedAssets, selectF24BundledAssets } from "../cch/f24MediaPrototype";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ExerciseCatalogItem } from "../hooks/useHealthCatalogs";

/** Read-only M2 reference. No media URLs, storage or inferred technique. */
export function HealthExerciseMovementPreview({exercise,name}:{exercise?:ExerciseCatalogItem;name:string}){
 const [open,setOpen]=useState(false);
 const [playingGif,setPlayingGif]=useState<string|null>(null);
 const [failed,setFailed]=useState<string[]>([]);
 const media=exercise?selectF24BundledAssets(exercise.id,f24ApprovedAssets):[];
 const muscles=exercise?.muscles.filter(x=>x.role==="primary"&&x.muscle).map(x=>x.muscle!.name)??[];
 const equipment=exercise?.equipment.filter(x=>x.equipmentItem).map(x=>x.equipmentItem!.name)??[];
 return <Dialog open={open} onOpenChange={next=>{setOpen(next);if(!next){setPlayingGif(null);setFailed([]);}}}>
  <DialogTrigger asChild>
   <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={"Ver movimento: "+name}>
    <Info className="h-5 w-5" aria-hidden="true"/>
   </Button>
  </DialogTrigger>
  <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl motion-reduce:animate-none">
   <DialogTitle>{name}</DialogTitle>
   <DialogDescription>Referência geral do catálogo de exercícios. O cronômetro continua funcionando.</DialogDescription>
   <div className="space-y-3 text-sm">
    <p><strong>Músculos principais:</strong> {muscles.length?muscles.join(", "):"Informação não disponível."}</p>
    <p><strong>Equipamentos do catálogo:</strong> {equipment.length?equipment.join(", "):"Informação não disponível."}</p>
    {open?media.filter(asset=>!failed.includes(asset.mediaId)).map(asset=><div key={asset.mediaId} className="space-y-2">
      {asset.kind==="image"?<img src={asset.path} alt={asset.altText} className="max-h-64 w-full object-contain" loading="lazy" onError={()=>setFailed(prev=>[...prev,asset.mediaId])}/>:
        asset.kind==="video"?<video src={asset.path} controls muted playsInline preload="none" aria-label={asset.altText} className="max-h-64 w-full" onError={()=>setFailed(prev=>[...prev,asset.mediaId])}/>:
        <><Button type="button" variant="outline" className="min-h-11" onClick={()=>setPlayingGif(playingGif===asset.mediaId?null:asset.mediaId)}>{playingGif===asset.mediaId?"Parar animação":"Reproduzir animação"}</Button>
        {playingGif===asset.mediaId?<img src={asset.path} alt={asset.altText} className="max-h-64 w-full object-contain" onError={()=>setFailed(prev=>[...prev,asset.mediaId])}/>:null}</>}
      <p className="text-xs">{asset.altText}</p>
      <p className="text-xs text-muted-foreground">Demonstração geral · {asset.author} · <a className="underline" href={asset.licenseUrl} target="_blank" rel="noopener noreferrer">{asset.licenseId}</a> · <a className="underline" href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">Origem</a> · Alterações: {asset.changesDescription}</p>
    </div>):null}
    <p className="text-xs text-muted-foreground">O catálogo não confirma qual aparelho físico você está utilizando. {media.length===0?"Demonstração visual aprovada ainda não disponível.":failed.length?"Algumas mídias não puderam ser carregadas; consulte a referência textual.":""}</p>
   </div>
  </DialogContent>
 </Dialog>;
}
