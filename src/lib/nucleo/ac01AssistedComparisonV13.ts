/**
 * Núcleo V1.3 CA-25/26 — preparação de consolidação SEM execução.
 * Compara SOMENTE os metadados realmente lidos no Core.
 * Não possui textos dos arquivos externos nem corpo FM; não inventar diff.
 */
import type { Ac01Record, Ac01FM } from "./ac01DocumentGovernance";
import { compareAc01FmSource } from "./ac01FmSourceMatchV13";

export type MetadataDifference=Readonly<{
 label:string;previous:string;current:string;changed:boolean;
}>;
const shown=(value:string|null|undefined)=>value?.trim()||"não informado";
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
 const rows:MetadataDifference[]=[
  {label:"Título",previous:shown(previous?.title),current:shown(current.title),changed:!!previous&&previous.title!==current.title},
  {label:"Localizador original",previous:shown(previous?.source_locator),current:shown(current.source_locator),changed:!!previous&&previous.source_locator!==current.source_locator},
  {label:"Tipo da fonte",previous:shown(previous?.source_kind),current:shown(current.source_kind),changed:!!previous&&previous.source_kind!==current.source_kind},
  {label:"Especialidade declarada",previous:shown(previous?.specialist_role),current:shown(current.specialist_role),changed:!!previous&&previous.specialist_role!==current.specialist_role},
  {label:"Categoria documental",previous:shown(previous?.contribution_kind),current:shown(current.contribution_kind),changed:!!previous&&previous.contribution_kind!==current.contribution_kind},
  {label:"Estado documental AC-01",previous:shown(previous?.authority_state),current:shown(current.authority_state),changed:!!previous&&previous.authority_state!==current.authority_state},
 ];
 const originMatch=validFM?compareAc01FmSource(current,validFM):null;
 return {
  current:{id:current.id,version:current.version_no,title:current.title,
   source:current.source_locator,kind:current.source_kind,authority:current.authority_state},
  previous:previous?{id:previous.id,version:previous.version_no}:null,
  differences:rows,
  destination:validFM?{id:validFM.id,section:validFM.section_code,version:validFM.version_no,
    title:validFM.title,source:validFM.source_reference,authority:validFM.authority_state}:null,
  originMatch,
  issues,
  externalContentDiffAvailable:false as const,
  fmBodyDiffAvailable:false as const,
  canonicalWriteAllowed:false as const,
 };
}
