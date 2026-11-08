import test from "node:test";
import assert from "node:assert/strict";
import {
  availabilityFor,
  buildDashboardIssues,
  formatMinutes,
  freshnessForDate,
  isCoverageObserved,
} from "../.tmp-health-f10/dashboardModel.js";

test("unknown stays unknown instead of becoming zero", () => {
  assert.equal(
    availabilityFor({ hasData: false, explicitlyUnobserved: true }),
    "unknown",
  );
  assert.equal(formatMinutes(null), null);
});

test("historical is never labelled today", () => {
  assert.equal(freshnessForDate("2026-11-06", "2026-11-07"), "historical");
  assert.equal(freshnessForDate("2026-11-07", "2026-11-07"), "today");
  assert.equal(freshnessForDate(null, "2026-11-07"), "not_applicable");
});

test("domain error is isolated", () => {
  assert.equal(
    availabilityFor({ hasData: true, error: "network" }),
    "error",
  );
  assert.equal(
    availabilityFor({ hasData: true }),
    "available",
  );
});

test("unobserved coverage is not observed", () => {
  assert.equal(isCoverageObserved("unobserved"), false);
  assert.equal(isCoverageObserved("partial"), true);
  assert.equal(isCoverageObserved(null), false);
});

test("operational issues do not create clinical alerts", () => {
  const issues = buildDashboardIssues({
    training: { hasActiveSession: false, hasNextQueue: false },
    nutrition: { hasDailyState: false, decisionStatus: "DECISION_PAUSED" },
    body: { hasState: false, coverageStatus: null },
    recovery: { hasState: false, coverages: [] },
    exams: { pendingReviewCount: 1 },
  });

  assert.deepEqual(
    issues.map((issue) => issue.domain),
    ["training", "nutrition", "nutrition", "body", "recovery", "exams"],
  );
  assert.equal(issues.some((issue) => /diagnóstico|risco|urgência/i.test(issue.message)), false);
});

test("technical error suppresses operational issue for that domain", () => {
  const issues = buildDashboardIssues({
    training: { error: "fail", hasActiveSession: false, hasNextQueue: false },
    nutrition: { error: "fail", hasDailyState: false },
    body: { error: "fail", hasState: false },
    recovery: { error: "fail", hasState: false, coverages: [] },
    exams: { error: "fail", pendingReviewCount: 2 },
  });

  assert.equal(issues.length, 0);
});
