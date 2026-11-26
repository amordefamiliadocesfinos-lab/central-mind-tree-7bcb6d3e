import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ExerciseCatalogItem } from "../hooks/useHealthCatalogs";

/** Read-only M2 reference. No media URLs, storage or inferred technique. */
export function HealthExerciseMovementPreview({exercise,name}:{exercise?:ExerciseCatalogItem;name:string}){
 const muscles=exercise?.muscles.filter(x=>x.role==="primary"&&x.muscle).map(x=>x.muscle!.name)??[];
 const equipment=exercise?.equipment.filter(x=>x.equipmentItem).map(x=>x.equipmentItem!.name)??[];
 return <Dialog>
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
    <p className="text-xs text-muted-foreground">O catálogo não confirma qual aparelho físico você está utilizando. Demonstração visual aprovada ainda não disponível.</p>
   </div>
  </DialogContent>
 </Dialog>;
}
