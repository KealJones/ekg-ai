import type { TeachingTrace } from "./teaching-trace.js";
import { validateTeachingTrace } from "./teaching-trace.js";

export interface TeacherToolDescriptor {
  name: string;
  description: string;
}

export interface TeacherRequest {
  system: string;
  context: {
    rawGoal?: string;
    taskId?: string;
    observation: string;
    impasse?: string;
    failedAttempts?: string[];
    knownStrategyIds?: string[];
  };
  tools: TeacherToolDescriptor[];
}

export interface TeacherTransport {
  invoke(request: TeacherRequest): Promise<unknown>;
}

export interface TeacherAdapterResult {
  trace: TeachingTrace;
  interventions: number;
}

export const learnerTeacherTools: TeacherToolDescriptor[] = [
  {name:"search_graph",description:"Find concepts, programs, episodes, strategies, and evidence relevant to the current impasse."},
  {name:"inspect_program",description:"Inspect a canonical portable Blueprint and its evidence."},
  {name:"inspect_episode",description:"Inspect prior attempts, outcomes, and search costs."},
  {name:"run_candidate",description:"Execute or evaluate a proposed Blueprint in the learner sandbox."},
  {name:"propose_test",description:"Propose a discriminating positive/negative/counterexample test."},
  {name:"propose_knowledge",description:"Propose reusable concept/procedure/criterion/question-strategy knowledge; proposal is not automatically truth."},
];

export const teacherSystemPrompt = `You are Teacher Mode for an executable knowledge-graph learner.
Your purpose is to make your own future intervention unnecessary.

Do not merely answer the task. Produce a structured, reproducible teaching trace.
Prefer diagnostic questions, explicit competing hypotheses, discriminating experiments,
counterexamples, decision boundaries, and reusable knowledge. Reference learner graph/program
IDs when available. Do not claim proposed knowledge is truth; the learner validates it.

Return ONLY a TeachingTrace-shaped object containing:
id, optional taskId, observation, optional impasse, teacherQuestion, hypotheses[],
experiments[], optional conclusion, optional extractedKnowledge[], optional nextQuestion,
teacherInterventions (positive integer), provenance[].

Every useful intervention should try to leave behind either learner knowledge or a reusable
question-selection/teaching strategy. Do not expose private chain-of-thought; provide concise,
reproducible premises, tests, alternatives, and conclusions instead.`;

function isObject(x:unknown):x is Record<string,unknown>{
  return !!x && typeof x==="object" && !Array.isArray(x);
}

export function parseTeacherOutput(value:unknown):TeachingTrace{
  if(!isObject(value)) throw new Error("Teacher output must be an object");
  const requiredString=(key:string)=>{
    const v=value[key]; if(typeof v!=="string") throw new Error(`Teacher output ${key} must be string`); return v;
  };
  const hypotheses=value.hypotheses;
  const experiments=value.experiments;
  const provenance=value.provenance;
  if(!Array.isArray(hypotheses)||!Array.isArray(experiments)||!Array.isArray(provenance))
    throw new Error("Teacher output hypotheses, experiments, and provenance must be arrays");
  const trace=value as unknown as TeachingTrace;
  requiredString("id"); requiredString("observation"); requiredString("teacherQuestion");
  validateTeachingTrace(trace);
  return structuredClone(trace);
}

export class TeacherAdapter {
  constructor(private readonly transport:TeacherTransport){}
  async teach(context:TeacherRequest["context"]):Promise<TeacherAdapterResult>{
    const raw=await this.transport.invoke({
      system:teacherSystemPrompt,
      context,
      tools:learnerTeacherTools,
    });
    const trace=parseTeacherOutput(raw);
    return {trace,interventions:trace.teacherInterventions};
  }
}
