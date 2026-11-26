import test from "node:test";
import assert from "node:assert/strict";
import {pickF24MediaPrototype as pick, selectF24BundledAssets, f24ApprovedAssets} from "../.tmp-cch-f24-p3/f24MediaPrototype.js";
const item=(x={})=>({mediaId:"img-1",exerciseId:"exercise-1",equipmentId:null,
 locale:"pt-BR",kind:"image",mime:"image/webp",status:"approved",
 licenseProof:true,technicalReview:true,altText:"Aparelho de treino",hasAudio:false,...x});
test("approved licensed and technically reviewed photo plus silent video are selected",()=>{
 const out=pick("exercise-1",null,[item(),item({mediaId:"vid-1",kind:"video",mime:"video/mp4"})]);
 assert.deepEqual(out.map(x=>x.kind),["image","video"]);
});
test("reject unlicensed, unreviewed, invalid format, audio, or retired material",()=>{
 for(const x of [{licenseProof:false},{technicalReview:false},{status:"draft"},
 {status:"retired"},{mime:"image/svg+xml"},{hasAudio:true},{altText:" "},{exerciseId:"other"}]){
  assert.deepEqual(pick("exercise-1",null,[item(x)]),[]);
 }
});
test("different machines do not inherit each other's media; generic fallback is marked",()=>{
 const named=item({mediaId:"machine-a",equipmentId:"machine-a"});
 assert.deepEqual(pick("exercise-1","machine-b",[named]),[]);
 const out=pick("exercise-1","machine-b",[named,item({mediaId:"generic"})]);
 assert.equal(out[0].mediaId,"generic");
 assert.equal(out[0].generalDemonstration,true);
 const exact=pick("exercise-1","machine-a",[named,item({mediaId:"generic"})]);
 assert.equal(exact[0].mediaId,"machine-a");
 assert.equal(exact[0].generalDemonstration,false);
});
test("empty exercise and unverified GIF are rejected; video takes precedence over gif",()=>{
 assert.deepEqual(pick("",null,[item()]),[]);
 const out=pick("exercise-1",null,[item({mediaId:"gif",kind:"gif",mime:"image/gif"}),
 item({mediaId:"vid",kind:"video",mime:"video/webm"})]);
 assert.deepEqual(out.map(x=>x.mediaId),["vid"]);
});

test("duplicate identity cannot revive retired or unlicensed media",()=>{
 const approved=item();
 for(const conflicting of [item({status:"retired"}),item({licenseProof:false}),item({exerciseId:"other"})]){
  for(const rows of [[approved,conflicting],[conflicting,approved]]){
   assert.deepEqual(pick("exercise-1",null,rows),[]);
  }
 }
});
test("ambiguous specific variant falls back only to a unique general image",()=>{
 const a=item({mediaId:"a",equipmentId:"machine-a"});
 const b=item({mediaId:"b",equipmentId:"machine-a"});
 const general=item({mediaId:"general"});
 for(const rows of [[a,b,general],[general,b,a]]){
  assert.deepEqual(pick("exercise-1","machine-a",rows),[{mediaId:"general",kind:"image",generalDemonstration:true}]);
 }
 assert.deepEqual(pick("exercise-1","machine-a",[a,b]),[]);
});
test("ambiguous general media does not select by ordering",()=>{
 const a=item({mediaId:"a"}),b=item({mediaId:"b"});
 assert.deepEqual(pick("exercise-1",null,[a,b]),[]);
 assert.deepEqual(pick("exercise-1",null,[b,a]),[]);
 assert.deepEqual(pick(" ",null,[item({exerciseId:" "})]),[]);
});

test("bundled media requires local path, valid metadata and explicit approval",()=>{
 const row=item({path:"/health-media/example.webp",bytes:1000,width:640,height:360,durationMs:null,sha256:"a".repeat(64),author:"Synthetic author",licenseId:"test",sourceUrl:"https://example.org/source",rightsProofRef:"synthetic-proof",reviewedBy:"synthetic-reviewer",reviewedAt:"2026-11-25T12:00:00Z",safetyReviewedAt:"2026-11-25T12:00:00Z",version:1});
 assert.equal(selectF24BundledAssets("exercise-1",[row]).length,1);
 for(const patch of [{path:"https://example.org/a.webp"},{path:"/health-media/../a.webp"},{bytes:600000},{sha256:""},{reviewedBy:""},{status:"draft"},{equipmentId:"not-confirmed"}]){
  assert.deepEqual(selectF24BundledAssets("exercise-1",[{...row,...patch}]),[]);
 }
 assert.deepEqual(f24ApprovedAssets,[]);
});
