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

/** Bundled editorial assets only. No network resolver or Storage credentials. */
export type F24ApprovedAsset=F24MediaDraft&{
 path:string; bytes:number; width:number;height:number;durationMs:number|null;
 sha256:string;author:string;licenseId:string;licenseUrl:string;changesDescription:string;sourceUrl:string;rightsProofRef:string;
 reviewedBy:string;reviewedAt:string;safetyReviewedAt:string;version:number;
};
export function selectF24BundledAssets(exerciseId:string,rows:F24ApprovedAsset[]):F24ApprovedAsset[]{
 // Count identities before filtering metadata so conflicts never revive an asset.
 const counts=new Map<string,number>();
 for(const row of rows)counts.set(row.mediaId,(counts.get(row.mediaId)??0)+1);
 const verified=rows.filter(row=>{
  if(counts.get(row.mediaId)!==1)return false;
  const extensions:Record<string,string>={"image/webp":"webp","image/avif":"avif","image/png":"png","image/jpeg":"jpg","video/mp4":"mp4","video/webm":"webm","image/gif":"gif"};
  const ext=extensions[row.mime];
  if(!ext||!/^\/health-media\/[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(row.path)||!row.path.endsWith("."+ext))return false;
  const limit=row.kind==="image"?500*1024:row.kind==="video"?4*1024*1024:1.5*1024*1024;
  if(!Number.isInteger(row.bytes)||row.bytes<=0||row.bytes>limit||
    !Number.isInteger(row.width)||!Number.isInteger(row.height)||row.width<=0||row.height<=0||
    Math.max(row.width,row.height)>1280||Math.min(row.width,row.height)>720)return false;
  if(row.kind==="image"?row.durationMs!==null:(!Number.isInteger(row.durationMs)||row.durationMs!<=0||row.durationMs!>(row.kind==="video"?12000:6000)))return false;
  if(!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isInteger(row.version)||row.version<1||
   ![row.author,row.licenseId,row.licenseUrl,row.changesDescription,row.rightsProofRef,row.reviewedBy,row.reviewedAt,row.safetyReviewedAt].every(x=>typeof x==="string"&&x.trim())||
   !Number.isFinite(Date.parse(row.reviewedAt))||!Number.isFinite(Date.parse(row.safetyReviewedAt)))return false;
  try{if(new URL(row.sourceUrl).protocol!=="https:"||new URL(row.licenseUrl).protocol!=="https:")return false;}catch{return false;}
  return true;
 });
 const selected=pickF24MediaPrototype(exerciseId,null,verified);
 return selected.map(selection=>verified.find(row=>row.mediaId===selection.mediaId)!);
}
// Deliberately empty until asset bytes, rights and professional review are approved.
export const f24ApprovedAssets: F24ApprovedAsset[]=[];
