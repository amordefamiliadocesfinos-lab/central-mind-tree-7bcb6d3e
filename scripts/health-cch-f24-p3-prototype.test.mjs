import test from "node:test";
import assert from "node:assert/strict";
import {pickF24MediaPrototype as pick} from "../.tmp-cch-f24-p3/f24MediaPrototype.js";
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
