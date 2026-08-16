export interface SearchArmMeasurement {
  solved: boolean;
  candidates: number;
}

export interface ActivationEvidence {
  primitive: SearchArmMeasurement;
  learned: SearchArmMeasurement;
}

export interface ActivationDecision {
  mode: "primitive-only" | "learned-first";
  reason: "learned-improves-solve-rate" | "learned-reduces-search" | "abstain-no-benefit" | "abstain-regression";
  candidateSavings: number;
}

/**
 * Conservative oracle used for offline evaluation/training data.
 * It is NOT the online predictor: it labels which arm should have been chosen
 * after both have been measured.
 */
export function labelActivationOutcome(evidence: ActivationEvidence): ActivationDecision {
  const candidateSavings=evidence.primitive.candidates-evidence.learned.candidates;
  if(evidence.learned.solved && !evidence.primitive.solved)
    return {mode:"learned-first",reason:"learned-improves-solve-rate",candidateSavings};
  if(!evidence.learned.solved && evidence.primitive.solved)
    return {mode:"primitive-only",reason:"abstain-regression",candidateSavings};
  if(evidence.learned.solved===evidence.primitive.solved && evidence.learned.solved && candidateSavings>0)
    return {mode:"learned-first",reason:"learned-reduces-search",candidateSavings};
  return {mode:"primitive-only",reason:"abstain-no-benefit",candidateSavings};
}

export interface ActivationFeatures {
  primitiveDepthHint: number;
  retrievedScore: number;
  librarySize: number;
  retrievedCount: number;
  /** Prior measured savings for this task-family/program pair, if any. */
  priorMeanSavings?: number;
  priorObservations?: number;
}

export interface ActivationPolicyDecision {
  mode: "primitive-only" | "learned-first";
  confidence: number;
  reasons: string[];
}

/**
 * v0 online policy. Conservative by design: abstain unless there is direct
 * historical evidence, or a harder search plus a strongly contextual retrieval.
 * This can later be replaced by a learned classifier/bandit without changing
 * the controller/search contract.
 */
export function chooseActivation(features: ActivationFeatures): ActivationPolicyDecision {
  const reasons:string[]=[];
  if((features.priorObservations??0)>=2){
    const mean=features.priorMeanSavings??0;
    if(mean>0) return {mode:"learned-first",confidence:Math.min(.95,.6+Math.min(.35,mean/100)),reasons:[`prior-positive-savings:${mean}`]};
    return {mode:"primitive-only",confidence:.9,reasons:[`prior-nonpositive-savings:${mean}`]};
  }
  if(features.primitiveDepthHint>=3 && features.retrievedScore>=140 && features.retrievedCount<=2){
    reasons.push("harder-search","strong-context-match","small-retrieved-set");
    return {mode:"learned-first",confidence:.65,reasons};
  }
  reasons.push("insufficient-evidence");
  return {mode:"primitive-only",confidence:.7,reasons};
}
