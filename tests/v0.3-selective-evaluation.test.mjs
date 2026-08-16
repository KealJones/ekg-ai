import test from "node:test";
import assert from "node:assert/strict";
import {
  gradeOutcome,
  confusionMatrix,
  riskCoverageCurve,
  aurc,
  pointAtOrAboveCoverage,
} from "../dist/index.js";

test("v0.3 outcome accounting uses mutually exclusive buckets", () => {
  const outcomes = [
    gradeOutcome({ goldAction: "ANSWER", actualAction: "ANSWER", denotationCorrect: true }),
    gradeOutcome({ goldAction: "ANSWER", actualAction: "ANSWER", denotationCorrect: false }),
    gradeOutcome({ goldAction: "ANSWER", actualAction: "ANSWER", denotationCorrect: false, effectful: true }),
    gradeOutcome({ goldAction: "ESCALATE", actualAction: "ESCALATE" }),
    gradeOutcome({ goldAction: "ANSWER", actualAction: "ESCALATE" }),
    gradeOutcome({ goldAction: "ESCALATE", actualAction: "ANSWER", denotationCorrect: true }),
    gradeOutcome({ goldAction: "CLARIFY", actualAction: "CLARIFY" }),
    gradeOutcome({ goldAction: "ANSWER", actualAction: "CLARIFY" }),
    gradeOutcome({ goldAction: "ANSWER", actualAction: "ABSTAIN" }),
    gradeOutcome({ goldAction: "ANSWER", actualAction: "TIMEOUT" }),
  ];

  const matrix = confusionMatrix(outcomes);
  assert.deepEqual(matrix, {
    correct_answer: 1,
    wrong_answer_readonly: 1,
    wrong_answer_effectful: 1,
    correct_escalation: 1,
    unnecessary_escalation: 1,
    missed_escalation: 1,
    correct_clarification: 1,
    unnecessary_clarification: 1,
    abstention: 1,
    timeout: 1,
  });
  assert.equal(Object.values(matrix).reduce((a, b) => a + b, 0), outcomes.length);
});

test("forced-choice nearest-neighbour errors can be converted into abstentions by threshold sweep", () => {
  const predictions = [
    { item: "easy-a", confidence: 0.95, correct: true },
    { item: "easy-b", confidence: 0.90, correct: true },
    { item: "dangerous-near-match", confidence: 0.40, correct: false },
    { item: "weak-match", confidence: 0.20, correct: false },
  ];
  const curve = riskCoverageCurve(predictions);

  const full = pointAtOrAboveCoverage(curve, 1);
  assert.equal(full.coverage, 1);
  assert.equal(full.risk, 0.5);

  const half = pointAtOrAboveCoverage(curve, 0.5);
  assert.equal(half.coverage, 0.5);
  assert.equal(half.risk, 0);
  assert.ok(aurc(curve) > 0);
});

test("confidence does not magically make wrong answers correct", () => {
  const curve = riskCoverageCurve([
    { item: "wrong-high-confidence", confidence: 0.99, correct: false },
    { item: "right-low-confidence", confidence: 0.10, correct: true },
  ]);
  const firstAnsweringPoint = curve.find(p => p.answered === 1);
  assert.equal(firstAnsweringPoint.risk, 1);
});

test("invalid coverage requests are rejected", () => {
  assert.throws(() => pointAtOrAboveCoverage([], -0.1), /\[0,1\]/);
  assert.throws(() => pointAtOrAboveCoverage([], 1.1), /\[0,1\]/);
});
