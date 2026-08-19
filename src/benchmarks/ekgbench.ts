import type { JsonValue } from "../ir/blueprint.js";
import { CapabilityRegistry } from "../runtime/capabilities.js";
import { T } from "../ir/types.js";
import { synthesizeDetailed } from "../search/synthesizer.js";
import type { TaskSpec } from "../task.js";
import type { ProgramLibrary } from "../program-library.js";
import { runProgram } from "../runtime/interpreter.js";

export interface DevelopmentalProbe {
  id:string;
  family:string;
  skill:string;
  source:string;
  story:string[];
  question:string;
  expected:JsonValue;
  prerequisites:string[];
  aspirational:boolean;
}

export const BABI_SOURCE="Weston et al. (2015), Towards AI-Complete Question Answering: A Set of Prerequisite Toy Tasks, arXiv:1502.05698";

/**
 * Original EKG-authored examples for the twenty bAbI skill families. We preserve
 * the task taxonomy, not the original dataset sentences. These are developmental
 * probes: red is information, not a CI failure.
 */
export const ekgBenchBabi20:DevelopmentalProbe[]=[
  {id:"BABI-01",family:"single-supporting-fact",skill:"retrieve one relevant fact",source:BABI_SOURCE,story:["Ava went to the kitchen."],question:"Where is Ava?",expected:"kitchen",prerequisites:["entity","location","fact-retrieval"],aspirational:true},
  {id:"BABI-02",family:"two-supporting-facts",skill:"chain two facts",source:BABI_SOURCE,story:["Ava picked up the apple.","Ava went to the garden."],question:"Where is the apple?",expected:"garden",prerequisites:["fact-retrieval","possession","movement"],aspirational:true},
  {id:"BABI-03",family:"three-supporting-facts",skill:"chain three facts",source:BABI_SOURCE,story:["Ava picked up the key.","Ava went to the hall.","Ava went to the office."],question:"Where is the key?",expected:"office",prerequisites:["multi-hop","state-update"],aspirational:true},
  {id:"BABI-04",family:"two-argument-relations",skill:"invert a binary relation",source:BABI_SOURCE,story:["The office is north of the kitchen."],question:"What direction is the kitchen from the office?",expected:"south",prerequisites:["relation","inverse-relation"],aspirational:true},
  {id:"BABI-05",family:"three-argument-relations",skill:"resolve subject/object/recipient roles",source:BABI_SOURCE,story:["Liam gave the book to Maya."],question:"Who did Liam give the book to?",expected:"maya",prerequisites:["semantic-roles"],aspirational:true},
  {id:"BABI-06",family:"yes-no-questions",skill:"answer proposition truth",source:BABI_SOURCE,story:["Ava is in the kitchen."],question:"Is Ava in the kitchen?",expected:"yes",prerequisites:["proposition","truth"],aspirational:true},
  {id:"BABI-07",family:"counting",skill:"count members of a set",source:BABI_SOURCE,story:["Ava is carrying a coin.","Ava is carrying a key."],question:"How many things is Ava carrying?",expected:2,prerequisites:["set","count"],aspirational:true},
  {id:"BABI-08",family:"lists-sets",skill:"return set members",source:BABI_SOURCE,story:["Ava is carrying a coin.","Ava is carrying a key."],question:"What is Ava carrying?",expected:["coin","key"],prerequisites:["set","enumeration"],aspirational:true},
  {id:"BABI-09",family:"simple-negation",skill:"represent explicit negation",source:BABI_SOURCE,story:["Ava is not in the kitchen."],question:"Is Ava in the kitchen?",expected:"no",prerequisites:["negation","truth"],aspirational:true},
  {id:"BABI-10",family:"indefinite-knowledge",skill:"preserve uncertainty",source:BABI_SOURCE,story:["Ava is either in the kitchen or the garden."],question:"Is Ava in the kitchen?",expected:"maybe",prerequisites:["uncertainty","disjunction"],aspirational:true},
  {id:"BABI-11",family:"basic-coreference",skill:"resolve pronoun to entity",source:BABI_SOURCE,story:["Ava picked up the milk.","She went to the pantry."],question:"Where is Ava?",expected:"pantry",prerequisites:["coreference"],aspirational:true},
  {id:"BABI-12",family:"conjunction",skill:"apply predicate to conjoined entities",source:BABI_SOURCE,story:["Ava and Liam went to the kitchen."],question:"Where is Liam?",expected:"kitchen",prerequisites:["conjunction"],aspirational:true},
  {id:"BABI-13",family:"compound-coreference",skill:"resolve plural coreference",source:BABI_SOURCE,story:["Ava and Liam went to the kitchen.","They picked up the ball."],question:"Who picked up the ball?",expected:["Ava","Liam"],prerequisites:["conjunction","coreference"],aspirational:true},
  {id:"BABI-14",family:"time-reasoning",skill:"reason over event order",source:BABI_SOURCE,story:["Ava went to the kitchen before Liam went to the garden.","Liam went to the garden before Noor went to the office."],question:"Who moved first?",expected:"Ava",prerequisites:["temporal-order"],aspirational:true},
  {id:"BABI-15",family:"basic-deduction",skill:"apply universal rule",source:BABI_SOURCE,story:["All swans are white.","Pip is a swan."],question:"What color is Pip?",expected:"white",prerequisites:["is-a","deduction"],aspirational:true},
  {id:"BABI-16",family:"basic-induction",skill:"induce class property from examples",source:BABI_SOURCE,story:["Pip is a swan and Pip is white.","Luma is a swan and Luma is white.","Kiko is a swan."],question:"What color is Kiko likely to be?",expected:"white",prerequisites:["induction","class-property"],aspirational:true},
  {id:"BABI-17",family:"positional-reasoning",skill:"compose spatial relations",source:BABI_SOURCE,story:["The triangle is left of the square.","The square is left of the circle."],question:"Where is the triangle relative to the circle?",expected:"left",prerequisites:["spatial-relation","transitivity"],aspirational:true},
  {id:"BABI-18",family:"size-reasoning",skill:"compose comparative size relations",source:BABI_SOURCE,story:["The chest is bigger than the box.","The box is bigger than the cup."],question:"How is the chest sized relative to the cup?",expected:"bigger",prerequisites:["comparison","transitivity"],aspirational:true},
  {id:"BABI-19",family:"path-finding",skill:"compose directional path",source:BABI_SOURCE,story:["The kitchen is east of the hall.","The garden is north of the kitchen."],question:"How do you travel from the hall to the garden?",expected:["east","north"],prerequisites:["spatial-relation","path-composition"],aspirational:true},
  {id:"BABI-20",family:"agents-motivations",skill:"infer motivation for action",source:BABI_SOURCE,story:["Ava is hungry.","Ava went to the kitchen."],question:"Why did Ava go to the kitchen?",expected:"hungry",prerequisites:["goal","motivation"],aspirational:true},
];

export interface DevelopmentalAnswer {answer?:JsonValue; abstained?:boolean; evidence?:string[]}
export type DevelopmentalAgent=(probe:DevelopmentalProbe)=>DevelopmentalAnswer|Promise<DevelopmentalAnswer>;
export interface DevelopmentalResult {id:string;family:string;passed:boolean;abstained:boolean;answer?:JsonValue;expected:JsonValue}
const canonical=(x:JsonValue)=>JSON.stringify(x);

export async function evaluateDevelopmentalProbes(agent:DevelopmentalAgent,probes:DevelopmentalProbe[]=ekgBenchBabi20):Promise<DevelopmentalResult[]>{
  const out:DevelopmentalResult[]=[];
  for(const probe of probes){
    const got=await agent(probe);
    out.push({id:probe.id,family:probe.family,passed:got.answer!==undefined&&canonical(got.answer)===canonical(probe.expected),abstained:!!got.abstained,answer:got.answer,expected:probe.expected});
  }
  return out;
}

export interface ProgramMilestone {id:string;description:string;expectedEventually:boolean;task:TaskSpec;searchDepth:number}
export const objectProgramMilestones:ProgramMilestone[]=[
  {
    id:"OBJECT-001-single-property",
    description:"Given an object and one property/key, synthesize a program that returns that property value.",
    expectedEventually:true,searchDepth:1,
    task:{id:"ekg.object.single-property",inputs:[T.json,T.string],output:T.json,examples:[
      {inputs:[{foo:"bar"},"foo"],output:"bar"},
      {inputs:[{name:"Dash",age:5},"name"],output:"Dash"},
      {inputs:[{count:7},"count"],output:7},
    ]}
  },
  {
    id:"OBJECT-PATH-001-dot-nested",
    description:'Given a recursive object and dot path such as "foo.bar", synthesize a program returning the nested value.',
    expectedEventually:true,searchDepth:2,
    task:{id:"ekg.object.dot-path",inputs:[T.json,T.string],output:T.json,examples:[
      {inputs:[{foo:{bar:"baz"}},"foo.bar"],output:"baz"},
      {inputs:[{user:{name:"Ava"}},"user.name"],output:"Ava"},
      {inputs:[{a:{b:42}},"a.b"],output:42},
    ]}
  },
  {
    id:"OBJECT-PATH-002-variable-depth",
    description:"Generalize nested property access across previously unseen path depths without a task-specific host primitive.",
    expectedEventually:true,searchDepth:2,
    task:{id:"ekg.object.variable-dot-path",inputs:[T.json,T.string],output:T.json,examples:[
      {inputs:[{a:{b:{c:"deep"}}},"a.b.c"],output:"deep"},
      {inputs:[{x:{y:"two"}},"x.y"],output:"two"},
      {inputs:[{top:"one"},"top"],output:"one"},
    ]}
  }
];

export function pureDeterministicCapabilities(caps:CapabilityRegistry):CapabilityRegistry{
  const safe=new CapabilityRegistry();
  for(const cap of caps.all()) if(cap.pure&&cap.deterministic) safe.register(cap);
  return safe;
}

export function runObjectProgramMilestones(caps:CapabilityRegistry,programs?:ProgramLibrary){
  const safe=pureDeterministicCapabilities(caps);
  return objectProgramMilestones.map(m=>{
    const known=programs?.all().find(p=>JSON.stringify(p.inputs)===JSON.stringify(m.task.inputs)&&JSON.stringify(p.output)===JSON.stringify(m.task.output)&&m.task.examples.every(ex=>{try{return JSON.stringify(runProgram(p,ex.inputs,caps,programs))===JSON.stringify(ex.output)}catch{return false}}));
    if(known) return {id:m.id,passed:true,candidatesExplored:0,maxDepthReached:0,program:known,source:"learned-program"};
    const result=synthesizeDetailed(m.task,safe,{maxDepth:m.searchDepth,callablePrograms:programs?.all()??[],programs});
    return {id:m.id,passed:!!result.program,candidatesExplored:result.candidatesExplored,maxDepthReached:result.maxDepthReached,program:result.program,source:result.program?"synthesized":"unsolved"};
  });
}
