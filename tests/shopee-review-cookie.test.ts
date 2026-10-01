import assert from "node:assert/strict";
import { technicalCookie } from "../src/routes/api/shopee-review/cookie-test";

const httpCookie = technicalCookie("synthetic", 60, new Request("http://localhost/api/shopee-review/cookie-test"));
const httpsCookie = technicalCookie(
  "synthetic",
  60,
  new Request("https://central-mind-tree.lovable.app/api/shopee-review/cookie-test"),
);
const httpsDeletion = technicalCookie("", 0, new Request("https://central-mind-tree.lovable.app/api/shopee-review/cookie-test"));

assert.match(httpCookie, /^pc-shopee-review-test-dev=synthetic;/);
assert.doesNotMatch(httpCookie, /; Secure/);
assert.doesNotMatch(httpCookie, /Domain=/);

assert.match(httpsCookie, /^__Host-pc-shopee-review-test=synthetic;/);
assert.match(httpsCookie, /; Secure/);
assert.doesNotMatch(httpsCookie, /Domain=/);

assert.match(httpsDeletion, /^__Host-pc-shopee-review-test=;/);
assert.match(httpsDeletion, /Max-Age=0/);
assert.match(httpsDeletion, /; Secure/);
assert.doesNotMatch(httpsDeletion, /Domain=/);

console.log("shopee review cookie test passed");
