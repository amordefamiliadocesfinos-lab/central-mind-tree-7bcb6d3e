/** F24 G3 isolated MEDIA PROTOTYPE: editorial eligibility only.
 * Does not resolve URLs, call Supabase, access Storage or approve publication.
 */
export type F24MediaDraft={
  mediaId:string;
  exerciseId:string;
  equipmentId:string|null;
  locale:string;
  kind:"image"|"video"|"gif";
  mime:string;
  status:"draft"|"in_review"|"approved"|"retired";
  licenseProof:boolean;
  technicalReview:boolean;
  altText:string;
  hasAudio:boolean;
};
export type F24MediaSelection={mediaId:string;kind:F24MediaDraft["kind"];generalDemonstration:boolean};
const allowed:Record<F24MediaDraft["kind"],readonly string[]>={
 image:["image/webp","image/avif","image/png","image/jpeg"],
 video:["video/mp4","video/webm"],
 gif:["image/gif"]
};
function eligible(media:F24MediaDraft,exerciseId:string){
 return Boolean(media.mediaId.trim()&&media.exerciseId===exerciseId&&media.locale==="pt-BR"&&
  media.status==="approved"&&media.licenseProof&&media.technicalReview&&
  media.altText.trim()&&!media.hasAudio&&allowed[media.kind].includes(media.mime));
}
/** Prefer proven M2 equipment variant, then a generic approved exercise demo.
 * Do NOT normalize labels from workout-equipment free text into M2 identities.
 * Returning a media ID is not authorization to fetch bytes from a backend.
 */
export function pickF24MediaPrototype(exerciseId:string,equipmentId:string|null,
 media:F24MediaDraft[]):F24MediaSelection[]{
 if(!exerciseId.trim())return [];
 // A duplicated identity is ambiguous even when one record is retired or
 // unlicensed. Never allow input order to choose an editorial revision.
 const counts=new Map<string,number>();
 for(const m of media)counts.set(m.mediaId,(counts.get(m.mediaId)??0)+1);
 const candidate=media.filter(m=>counts.get(m.mediaId)===1&&eligible(m,exerciseId));
 const choose=(items:F24MediaDraft[])=>items.length===1?items[0]:undefined;
 const seen=new Set<F24MediaDraft["kind"]>();
 const result:F24MediaSelection[]=[];
 // Preserve separate image + one motion format for a compact preview.
 for(const kind of ["image","video","gif"] as const){
  if((kind==="gif"&&seen.has("video"))||seen.has(kind))continue;
  const exact=equipmentId?choose(candidate.filter(m=>m.kind===kind&&m.equipmentId===equipmentId)):undefined;
  const general=choose(candidate.filter(m=>m.kind===kind&&m.equipmentId===null));
  const chosen=exact??general;
  if(chosen){
   result.push({mediaId:chosen.mediaId,kind,generalDemonstration:chosen.equipmentId===null});
   seen.add(kind);
  }
 }
 return result;
}
