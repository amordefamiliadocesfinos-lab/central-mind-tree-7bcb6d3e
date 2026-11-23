import test from "node:test";
import assert from "node:assert/strict";
import { canOfferExtraSeries, preserveF24ExtraChoice } from "../.tmp-cch-f24/f24ExtraSeriesChoice.js";

test("3 planned sets explicitly permit series 4 and 5, not auto progression", () => {
  assert.equal(canOfferExtraSeries(2, 3, "active"), false);
  assert.equal(canOfferExtraSeries(3, 3, "active"), true);
  assert.equal(canOfferExtraSeries(4, 3, "active"), true);
  assert.equal(canOfferExtraSeries(5, 3, "active"), true);
});
test("F24 follows existing set number cap without altering the plan", () => {
  assert.equal(canOfferExtraSeries(99, 3, "active"), true);
  assert.equal(canOfferExtraSeries(100, 3, "active"), false);
  assert.equal(canOfferExtraSeries(101, 3, "active"), false);
  assert.equal(canOfferExtraSeries(3, 3, "skipped"), false);
  assert.equal(canOfferExtraSeries(3, 3, "replaced"), false);
  assert.equal(canOfferExtraSeries(3, 3, "completed"), false);
  assert.equal(canOfferExtraSeries(NaN, 3, "active"), false);
});

test("reselecting the same exercise during rest preserves only an explicit extra choice",()=>{
  assert.equal(preserveF24ExtraChoice("a","a",3,3,"active"),true);
  assert.equal(preserveF24ExtraChoice("a",null,3,3,"active"),false);
  assert.equal(preserveF24ExtraChoice("a","b",3,3,"active"),false);
  assert.equal(preserveF24ExtraChoice("a","a",2,3,"active"),false);
  assert.equal(preserveF24ExtraChoice("a","a",100,3,"active"),false);
  assert.equal(preserveF24ExtraChoice("a","a",3,3,"skipped"),false);
});
