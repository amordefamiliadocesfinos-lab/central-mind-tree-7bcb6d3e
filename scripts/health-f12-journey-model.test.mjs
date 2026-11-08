import test from "node:test";
import assert from "node:assert/strict";
import {
  buildJourneyModel,
  buildJourneyStages,
} from "../.tmp-health-f12/journeyModel.js";

function base() {
  return {
    profile: { hasProfile: true, hasActiveGoal: true },
    program: {
      hasProgram: true,
      programStatus: "active",
      hasPublishedCurrentVersion: true,
      hasUsableQueue: true,
    },
    execution: { hasOpenSession: false, hasCompletedSession: true },
    nutrition: {
      hasCurrentRolling: true,
      rollingCoverage: "complete",
      hasCurrentDecision: true,
      decisionStatus: "ready",
    },
    body: {
      hasCurrentState: true,
      coverageStatus: "complete",
      observationCount: 3,
    },
    recovery: {
      hasCurrentState: true,
      contextObserved: true,
    },
    integrated: {
      backendAvailable: true,
      hasCurrentRun: true,
      runStatus: "complete",
      hasDecisions: true,
    },
  };
}

test("complete process does not create a score and routes to integrated review", () => {
  const model = buildJourneyModel(base());
  assert.equal(model.stages.length, 7);
  assert.equal(model.hasReachedIntegratedEvaluation, true);
  assert.equal(model.nextAction?.code, "review_integrated_decision");
  assert.equal("score" in model, false);
  assert.equal("percentage" in model, false);
});

test("profile is the first operational gap", () => {
  const input = base();
  input.profile = { hasProfile: false, hasActiveGoal: false };
  const model = buildJourneyModel(input);
  assert.equal(model.nextAction?.code, "complete_profile");
});

test("draft program is in progress and blocks execution completion", () => {
  const input = base();
  input.program = {
    hasProgram: true,
    programStatus: "draft",
    hasPublishedCurrentVersion: false,
    hasUsableQueue: false,
  };
  input.execution = { hasOpenSession: false, hasCompletedSession: false };
  const model = buildJourneyModel(input);
  const program = model.stages.find((stage) => stage.code === "program");
  const execution = model.stages.find((stage) => stage.code === "execution");
  assert.equal(program?.journeyState, "in_progress");
  assert.equal(execution?.journeyState, "blocked");
  assert.equal(model.nextAction?.code, "publish_program");
});

test("open workout is in progress, not complete", () => {
  const input = base();
  input.execution = { hasOpenSession: true, hasCompletedSession: false };
  const model = buildJourneyModel(input);
  const execution = model.stages.find((stage) => stage.code === "execution");
  assert.equal(execution?.journeyState, "in_progress");
  assert.equal(model.nextAction?.code, "execute_workout");
});

test("paused M7 is a valid observed nutrition result", () => {
  const input = base();
  input.nutrition.decisionStatus = "paused";
  const stages = buildJourneyStages(input);
  const nutrition = stages.find((stage) => stage.code === "nutrition");
  assert.equal(nutrition?.journeyState, "complete");
  assert.match(nutrition?.evidence ?? "", /pausada/i);
});

test("body sparse state remains waiting data", () => {
  const input = base();
  input.body = {
    hasCurrentState: true,
    coverageStatus: "sparse",
    observationCount: 1,
  };
  const model = buildJourneyModel(input);
  const body = model.stages.find((stage) => stage.code === "body");
  assert.equal(body?.journeyState, "waiting_data");
  assert.equal(model.nextAction?.code, "record_body");
});

test("recovery requires actual usable context", () => {
  const input = base();
  input.recovery = { hasCurrentState: true, contextObserved: false };
  const model = buildJourneyModel(input);
  assert.equal(model.nextAction?.code, "record_recovery");
});

test("F11 paused still proves that integrated evaluation occurred", () => {
  const input = base();
  input.integrated.runStatus = "paused";
  const model = buildJourneyModel(input);
  const integrated = model.stages.find((stage) => stage.code === "integrated_decision");
  assert.equal(integrated?.journeyState, "evaluated_paused");
  assert.equal(model.hasReachedIntegratedEvaluation, true);
  assert.equal(model.nextAction?.code, "review_integrated_decision");
});

test("missing current F11 run leads to explicit evaluate action", () => {
  const input = base();
  input.integrated = {
    backendAvailable: true,
    hasCurrentRun: false,
    hasDecisions: false,
  };
  const model = buildJourneyModel(input);
  assert.equal(model.nextAction?.code, "evaluate_integration");
  assert.equal(model.nextAction?.href, undefined);
});

test("unavailable F11 backend is not misreported as absent decision", () => {
  const input = base();
  input.integrated = {
    backendAvailable: false,
    hasCurrentRun: false,
    hasDecisions: false,
    error: "relation does not exist",
  };
  const model = buildJourneyModel(input);
  const integrated = model.stages.find((stage) => stage.code === "integrated_decision");
  assert.equal(integrated?.journeyState, "blocked");
  assert.match(integrated?.evidence ?? "", /não está disponível neste ambiente/i);
  assert.equal(model.nextAction, null);
});

test("technical error stops next-action inference when precedence is ambiguous", () => {
  const input = base();
  input.program.error = "network";
  input.execution = { hasOpenSession: false, hasCompletedSession: false };
  const model = buildJourneyModel(input);
  assert.equal(model.hasTechnicalError, true);
  assert.equal(model.nextAction, null);
});

test("unknown values never become numerical zero", () => {
  const input = base();
  input.body = {
    hasCurrentState: false,
    coverageStatus: null,
    observationCount: 0,
  };
  const model = buildJourneyModel(input);
  const body = model.stages.find((stage) => stage.code === "body");
  assert.equal(body?.evidenceState, "absent");
  assert.equal(body?.evidence.includes("0"), false);
});
