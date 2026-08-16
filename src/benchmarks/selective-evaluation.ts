export type BenchmarkAction = "ANSWER" | "CLARIFY" | "ESCALATE" | "ABSTAIN" | "TIMEOUT";

export type OutcomeKind =
  | "correct_answer"
  | "wrong_answer_readonly"
  | "wrong_answer_effectful"
  | "correct_escalation"
  | "unnecessary_escalation"
  | "missed_escalation"
  | "correct_clarification"
  | "unnecessary_clarification"
  | "abstention"
  | "timeout";

export interface GradedOutcome {
  kind: OutcomeKind;
  correct: boolean;
  answered: boolean;
  risk: number;
}

export function gradeOutcome(input: {
  goldAction: Exclude<BenchmarkAction, "ABSTAIN" | "TIMEOUT">;
  actualAction: BenchmarkAction;
  denotationCorrect?: boolean;
  effectful?: boolean;
}): GradedOutcome {
  const { goldAction, actualAction, denotationCorrect = false, effectful = false } = input;

  if (actualAction === "TIMEOUT") return { kind: "timeout", correct: false, answered: false, risk: 0 };
  if (actualAction === "ABSTAIN") return { kind: "abstention", correct: false, answered: false, risk: 0 };

  if (actualAction === "ESCALATE") {
    const correct = goldAction === "ESCALATE";
    return { kind: correct ? "correct_escalation" : "unnecessary_escalation", correct, answered: false, risk: 0 };
  }

  if (actualAction === "CLARIFY") {
    const correct = goldAction === "CLARIFY";
    return { kind: correct ? "correct_clarification" : "unnecessary_clarification", correct, answered: false, risk: 0 };
  }

  // ANSWER
  if (goldAction === "ESCALATE" || goldAction === "CLARIFY") {
    return { kind: "missed_escalation", correct: false, answered: true, risk: 1 };
  }

  if (denotationCorrect) return { kind: "correct_answer", correct: true, answered: true, risk: 0 };
  return {
    kind: effectful ? "wrong_answer_effectful" : "wrong_answer_readonly",
    correct: false,
    answered: true,
    risk: 1,
  };
}

export function confusionMatrix(outcomes: GradedOutcome[]): Record<OutcomeKind, number> {
  const result: Record<OutcomeKind, number> = {
    correct_answer: 0,
    wrong_answer_readonly: 0,
    wrong_answer_effectful: 0,
    correct_escalation: 0,
    unnecessary_escalation: 0,
    missed_escalation: 0,
    correct_clarification: 0,
    unnecessary_clarification: 0,
    abstention: 0,
    timeout: 0,
  };
  for (const outcome of outcomes) result[outcome.kind]++;
  return result;
}

export interface SelectivePrediction<T = unknown> {
  item: T;
  confidence: number;
  correct: boolean;
}

export interface RiskCoveragePoint {
  threshold: number;
  coverage: number;
  risk: number;
  answered: number;
  wrong: number;
}

/**
 * Sweep every distinct observed confidence plus an answer-nothing point.
 * A prediction answers iff confidence >= threshold. This makes abstention a
 * capability of the baseline rather than forcing every nearest neighbour to win.
 */
export function riskCoverageCurve<T>(predictions: SelectivePrediction<T>[]): RiskCoveragePoint[] {
  if (predictions.length === 0) return [{ threshold: Number.POSITIVE_INFINITY, coverage: 0, risk: 0, answered: 0, wrong: 0 }];

  const thresholds = [
    Number.POSITIVE_INFINITY,
    ...[...new Set(predictions.map(p => p.confidence))].sort((a, b) => b - a),
  ];

  return thresholds.map(threshold => {
    const selected = predictions.filter(p => p.confidence >= threshold);
    const wrong = selected.filter(p => !p.correct).length;
    return {
      threshold,
      coverage: selected.length / predictions.length,
      risk: selected.length ? wrong / selected.length : 0,
      answered: selected.length,
      wrong,
    };
  });
}

/** Area under risk-vs-coverage using right-continuous rectangular integration. */
export function aurc(points: RiskCoveragePoint[]): number {
  const sorted = [...points].sort((a, b) => a.coverage - b.coverage);
  let area = 0;
  let previousCoverage = 0;
  for (const point of sorted) {
    const width = Math.max(0, point.coverage - previousCoverage);
    area += width * point.risk;
    previousCoverage = Math.max(previousCoverage, point.coverage);
  }
  return area;
}

export function pointAtOrAboveCoverage(points: RiskCoveragePoint[], targetCoverage: number): RiskCoveragePoint | undefined {
  if (targetCoverage < 0 || targetCoverage > 1) throw new Error("targetCoverage must be within [0,1]");
  return [...points]
    .filter(p => p.coverage >= targetCoverage)
    .sort((a, b) => a.coverage - b.coverage || a.risk - b.risk)[0];
}
