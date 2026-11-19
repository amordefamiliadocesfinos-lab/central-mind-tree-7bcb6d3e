import test from "node:test";
import assert from "node:assert/strict";
import {validIncrement,compareVolume,reviewPhase} from "../.tmp-health-cch-v7/motorV7Model.js";
test("equipment config requires valid increment",()=>{
 assert.equal(validIncrement(2.5,"Supino A","kg"),true);
 assert.equal(validIncrement(0,"Supino A","kg"),false);
 assert.equal(validIncrement(2.5,"","kg"),false);
 assert.equal(validIncrement(2.5,"Supino A","m"),false);
});
test("volume changes are observational",()=>{
 const x=compareVolume([{version_number:1,muscle_id:"a",observed_per_7_days:8},{version_number:2,muscle_id:"a",observed_per_7_days:10}]);
 assert.equal(x[0].trend,"more_observed");assert.match(x[0].note,/nao demonstra tolerancia/);
});
test("insufficient versions cannot prescribe periodization",()=>{
 const x=reviewPhase([{sessions:10}],"reviewable");assert.equal(x.phase,"consolidate_and_collect");assert.equal(x.autoPublish,false);
});
test("quality remains independently required across versions",()=>{
 assert.equal(reviewPhase([{sessions:10},{sessions:10}],"limited").phase,"consolidate_and_collect");
});