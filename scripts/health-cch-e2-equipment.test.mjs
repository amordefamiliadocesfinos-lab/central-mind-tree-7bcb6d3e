import test from "node:test";
import assert from "node:assert/strict";
import {confirmedEquipmentChoices} from "../.tmp-cch-e2-equipment/equipmentChoices.js";
const a={exercise_id:"exercise-A",equipment_label:"Máquina Supino 1",load_unit:"kg",exposures:3,candidate_load:null};
test("no equipment confirmation means no selectable machine",()=>{
 assert.deepEqual(confirmedEquipmentChoices([]),[]);
 assert.deepEqual(confirmedEquipmentChoices(undefined),[]);
});
test("verified machine can be selected even when no numerical progression is justified",()=>{
 const result=confirmedEquipmentChoices([a]);assert.equal(result.length,1);
 assert.equal(result[0].label,"Máquina Supino 1");assert.equal(result[0].unit,"kg");
});
test("distinct confirmed machines remain distinct and unit cannot be inferred",()=>{
 const result=confirmedEquipmentChoices([a,{...a,equipment_label:"Máquina Supino 2"},
  {...a,load_unit:"lb"}]);assert.equal(result.length,3);
});
test("multiple evidence entries for same machine are deduplicated",()=>{
 const result=confirmedEquipmentChoices([a,{...a,exposures:5}]);
 assert.equal(result.length,1);assert.equal(result[0].exposures,5);
});
test("reject unknown equipment labels, units and exposure counts",()=>{
 assert.deepEqual(confirmedEquipmentChoices([
 {...a,equipment_label:" "},{...a,load_unit:"units"},
 {...a,exposures:0},{...a,exposures:Number.NaN}]),[]);
});
test("normalizes display label but never synthesizes equipment",()=>{
 const result=confirmedEquipmentChoices([{...a,equipment_label:"  Máquina Supino 1  "}]);
 assert.equal(result[0].label,"Máquina Supino 1");
});
