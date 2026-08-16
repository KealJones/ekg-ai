export interface TeachingHypothesis {
  statement: string;
  status: "proposed" | "rejected" | "supported" | "unknown";
  reason?: string;
}

export interface TeachingExperiment {
  question: string;
  expectedDiscrimination?: string;
  result?: string;
}

export interface TeachingTrace {
  id: string;
  taskId?: string;
  observation: string;
  impasse?: string;
  teacherQuestion: string;
  hypotheses: TeachingHypothesis[];
  experiments: TeachingExperiment[];
  conclusion?: string;
  extractedKnowledge?: {
    kind: "procedure" | "concept" | "criterion" | "question-strategy";
    id?: string;
    description: string;
  }[];
  nextQuestion?: string;
  teacherInterventions: number;
  provenance: string[];
}

export function validateTeachingTrace(trace: TeachingTrace): void {
  if(!trace.id.trim()) throw new Error("TeachingTrace id is required");
  if(!trace.observation.trim()) throw new Error("TeachingTrace observation is required");
  if(!trace.teacherQuestion.trim()) throw new Error("TeachingTrace teacherQuestion is required");
  if(trace.teacherInterventions < 1 || !Number.isInteger(trace.teacherInterventions))
    throw new Error("teacherInterventions must be a positive integer");
  if(trace.provenance.length===0) throw new Error("TeachingTrace provenance is required");
  for(const h of trace.hypotheses){
    if(!h.statement.trim()) throw new Error("Teaching hypothesis statement is required");
  }
}
