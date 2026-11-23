/**
 * Núcleo V1.3 CA-25/26 — preparação de consolidação SEM execução.
 * Compara SOMENTE os metadados realmente lidos no Core.
 * Não possui textos dos arquivos externos nem corpo FM; não inventar diff.
 */
import type { Ac01Record, Ac01FM } from "./ac01DocumentGovernance";
import { compareAc01FmSource } from "./ac01FmSourceMatchV13";

export type MetadataChangeKind="incluido"|"removido"|"alterado"|"mantido"|"indeterminado";
export type MetadataDifference=Readonly<{
 label:string;previous:string;current:string;changed:boolean;kind:MetadataChangeKind;
}>;
const shown=(value:string|null|undefined)=>value?.trim()||"não informado";
function classifyMetadata(previous:string|null|undefined,current:string|null|undefined,comparable:boolean):MetadataChangeKind{
 if(!comparable)return "indeterminado";
 const from=previous?.trim()??"",to=current?.trim()??"";
 if(!from&&to)return "incluido";
 if(from&&!to)return "removido";
 return from===to?"mantido":"alterado";
}
function metadataRow(label:string,previous:string|null|undefined,current:string|null|undefined,comparable:boolean):MetadataDifference{
 const kind=classifyMetadata(previous,current,comparable);
 return {label,previous:shown(previous),current:shown(current),
  changed:kind==="incluido"||kind==="removido"||kind==="alterado",kind};
}
export function prepareAc01AssistedComparison(
 current:Ac01Record,
 contributions:readonly Ac01Record[],
 fm:Ac01FM|null,
){
 const previous=current.parent_revision_id
   ?contributions.find(item=>item.id===current.parent_revision_id
      &&item.module_id===current.module_id&&item.lineage_id===current.lineage_id)??null
   :null;
 const issues:string[]=[];
 if(current.parent_revision_id&&!previous)
  issues.push("Versão anterior não disponível na cadeia consultada");
 if(previous&&previous.version_no+1!==current.version_no)
  issues.push("Sequência de versões inconsistente no recorte");
 if(fm&&fm.module_id!==current.module_id)
  issues.push("Destino FM pertence a outro módulo e não pode ser comparado");
 if(!fm)issues.push("Nenhuma revisão FM de destino selecionada");
 const validFM=fm?.module_id===current.module_id?fm:null;
 const comparable=!!previous&&previous.version_no+1===current.version_no;
 const rows:MetadataDifference[]=[
  metadataRow("Título",previous?.title,current.title,comparable),
  metadataRow("Localizador original",previous?.source_locator,current.source_locator,comparable),
  metadataRow("Tipo da fonte",previous?.source_kind,current.source_kind,comparable),
  metadataRow("Especialidade declarada",previous?.specialist_role,current.specialist_role,comparable),
  metadataRow("Categoria documental",previous?.contribution_kind,current.contribution_kind,comparable),
  metadataRow("Estado documental AC-01",previous?.authority_state,current.authority_state,comparable),
 ];
 const summary={
  included:rows.filter(x=>x.kind==="incluido").length,
  removed:rows.filter(x=>x.kind==="removido").length,
  changed:rows.filter(x=>x.kind==="alterado").length,
  maintained:rows.filter(x=>x.kind==="mantido").length,
  indeterminate:rows.filter(x=>x.kind==="indeterminado").length,
 };
 const originMatch=validFM?compareAc01FmSource(current,validFM):null;
 return {
  current:{id:current.id,version:current.version_no,title:current.title,
   source:current.source_locator,kind:current.source_kind,authority:current.authority_state},
  previous:previous?{id:previous.id,version:previous.version_no}:null,
  differences:rows,summary,
  destination:validFM?{id:validFM.id,section:validFM.section_code,version:validFM.version_no,
    title:validFM.title,source:validFM.source_reference,authority:validFM.authority_state}:null,
  originMatch,
  issues,
  externalContentDiffAvailable:false as const,
  fmBodyDiffAvailable:false as const,
  canonicalWriteAllowed:false as const,
 };
}
