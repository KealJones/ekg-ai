import type { GraphStore } from "../graph/graph.js";
import type { CapabilityRegistry } from "../runtime/capabilities.js";
import type { ProgramBlueprint } from "../ir/blueprint.js";
import type { ProgramLibrary } from "../program-library.js";
import type { TaskSpec } from "../task.js";
import { validateProgram } from "../ir/validate.js";
import { evaluateTask } from "../task-evaluator.js";
import { teachStarterEnglishLexicon, teachSynonym, storeLexicalSense, teachContextualSenseCues } from "../intent/lexicon.js";
import { storeGrammarRule, storePredicateDefinition, storeInferenceRule, storeEventFrameDefinition, type GrammarRule, type PredicateDefinition, type InferenceRule, type EventFrameDefinition } from "../language/world-language.js";

export interface CallableAbility {
  id:string;
  source:"host-capability"|"learned-program";
  inputs:string[];
  output:string;
  durable:boolean;
  provenance:string[];
}
const typeName=(t:any):string=>t.kind==="list"?`List<${typeName(t.item)}>`:t.kind;
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-|-$/g,"").slice(0,100)||"lesson";

export function callableAbilityCatalog(caps:CapabilityRegistry,programs:ProgramLibrary):CallableAbility[]{
  return [
    ...caps.all().map(c=>({id:c.id,source:"host-capability" as const,inputs:c.inputs.map(typeName),output:typeName(c.output),durable:true,provenance:["host:registered"]})),
    ...programs.all().map(p=>({id:p.id,source:"learned-program" as const,inputs:p.inputs.map(typeName),output:typeName(p.output),durable:true,provenance:p.provenance??["program-library"]}))
  ];
}

export interface ProgramLesson {
  id:string;
  conceptId:string;
  description:string;
  program:ProgramBlueprint;
  validationTask:TaskSpec;
  phrases?:string[];
  provenance:string[];
}
export interface EducationResult {accepted:boolean;lessonId:string;acquiredIds:string[];reason?:string}

/**
 * Normal education path. Lessons are allowed and expected. Accepted knowledge
 * becomes durable graph/library state rather than a task-local answer.
 */
export class TeacherSchool {
  constructor(private readonly graph:GraphStore,private readonly caps:CapabilityRegistry,private readonly programs:ProgramLibrary){}

  teachStarterEnglish(provenance=["teacher:starter-english-v1"]):EducationResult{
    const before=this.graph.entitiesByKind("sense").length;
    const taught=teachStarterEnglishLexicon(this.graph);
    const after=this.graph.entitiesByKind("sense").length;
    const id="curriculum:starter-english-v1";
    this.recordEpisode(id,true,{kind:"lexical-curriculum",taught,created:after-before,provenance});
    return {accepted:true,lessonId:id,acquiredIds:this.graph.entitiesByKind("sense").slice(before).map(x=>x.id)};
  }

  teachSynonym(form:string,knownForm:string,provenance:string[]):EducationResult{
    try{
      const learned=teachSynonym(this.graph,{form,knownForm,provenance});
      const id=`lesson:synonym:${safe(form)}`;
      this.recordEpisode(id,true,{kind:"synonym",form,knownForm,relation:learned.relation,provenance});
      return {accepted:true,lessonId:id,acquiredIds:[`lexeme:en:${safe(form.toLowerCase())}`]};
    }catch(e){
      const id=`lesson:synonym:${safe(form)}`; this.recordEpisode(id,false,{kind:"synonym",form,knownForm,provenance,error:String(e)});
      return {accepted:false,lessonId:id,acquiredIds:[],reason:String(e)};
    }
  }

  teachContext(form:string,relation:string,cues:string[],provenance:string[],frameId?:string):EducationResult{
    const id=`lesson:context:${safe(form)}:${safe(relation)}`;
    try{
      const learned=teachContextualSenseCues(this.graph,{form,relation,cues,frameId,provenance});
      this.recordEpisode(id,true,{kind:"contextual-sense",form,relation,cues,frameId,provenance});
      return {accepted:true,lessonId:id,acquiredIds:[`sense:${safe(learned.senseId)}`]};
    }catch(e){
      this.recordEpisode(id,false,{kind:"contextual-sense",form,relation,cues,frameId,provenance,error:String(e)});
      return {accepted:false,lessonId:id,acquiredIds:[],reason:String(e)};
    }
  }

  teachFrame(def:EventFrameDefinition):EducationResult{
    const id=`lesson:frame:${safe(def.id)}`;
    try{storeEventFrameDefinition(this.graph,def);this.recordEpisode(id,true,{kind:"semantic-frame",...def});return {accepted:true,lessonId:id,acquiredIds:[`frame:${safe(def.id)}`]};}
    catch(e){this.recordEpisode(id,false,{kind:"semantic-frame",id:def.id,error:String(e),provenance:def.provenance});return {accepted:false,lessonId:id,acquiredIds:[],reason:String(e)}}
  }

  teachPredicate(def:PredicateDefinition):EducationResult{
    const id=`lesson:predicate:${safe(def.id)}`;
    try{storePredicateDefinition(this.graph,def);this.recordEpisode(id,true,{kind:"predicate",...def});return {accepted:true,lessonId:id,acquiredIds:[`predicate:${safe(def.id)}`]};}
    catch(e){this.recordEpisode(id,false,{kind:"predicate",id:def.id,error:String(e),provenance:def.provenance});return {accepted:false,lessonId:id,acquiredIds:[],reason:String(e)}}
  }

  teachInference(rule:InferenceRule):EducationResult{
    const id=`lesson:inference:${safe(rule.id)}`;
    try{storeInferenceRule(this.graph,rule);this.recordEpisode(id,true,{kind:"inference-rule",ruleId:rule.id,premises:rule.premises,conclusion:rule.conclusion,provenance:rule.provenance});return {accepted:true,lessonId:id,acquiredIds:[`inference:${safe(rule.id)}`]};}
    catch(e){this.recordEpisode(id,false,{kind:"inference-rule",ruleId:rule.id,error:String(e),provenance:rule.provenance});return {accepted:false,lessonId:id,acquiredIds:[],reason:String(e)}}
  }

  teachGrammar(rule:GrammarRule):EducationResult{
    const id=`lesson:grammar:${safe(rule.id)}`;
    try{
      storeGrammarRule(this.graph,rule);
      this.recordEpisode(id,true,{kind:"grammar-rule",ruleId:rule.id,pattern:rule.pattern,semantics:rule.semantics,provenance:rule.provenance});
      return {accepted:true,lessonId:id,acquiredIds:[`grammar:${safe(rule.id)}`]};
    }catch(e){
      this.recordEpisode(id,false,{kind:"grammar-rule",ruleId:rule.id,error:String(e),provenance:rule.provenance});
      return {accepted:false,lessonId:id,acquiredIds:[],reason:String(e)};
    }
  }

  teachProgram(lesson:ProgramLesson):EducationResult{
    if(lesson.provenance.length===0) throw new Error("program lesson provenance is required");
    try{
      validateProgram(lesson.program,this.caps,this.programs);
      const evaluation=evaluateTask(lesson.program,lesson.validationTask,this.caps,this.programs);
      if(!evaluation.passed){
        this.recordEpisode(lesson.id,false,{kind:"program",conceptId:lesson.conceptId,description:lesson.description,evaluation,provenance:lesson.provenance});
        return {accepted:false,lessonId:lesson.id,acquiredIds:[],reason:"Teacher program failed validation task"};
      }
      const stored=this.programs.put({...lesson.program,provenance:[...(lesson.program.provenance??[]),...lesson.provenance,`education:${lesson.id}`]});
      const programId=`program:${stored.id}`;
      const conceptId=`concept:learned:${lesson.conceptId}`;
      const abilityId=`capability:learned:${stored.id}`;
      this.graph.putEntity({id:programId,kind:"program",labels:["learned-program",stored.id],attrs:{programId:stored.id,description:lesson.description,inputs:stored.inputs.map(typeName),output:typeName(stored.output),provenance:stored.provenance,blueprintSnapshot:structuredClone(stored),inputTypeSnapshots:structuredClone(stored.inputs),outputTypeSnapshot:structuredClone(stored.output),snapshotStatus:"validated"}});
      this.graph.putEntity({id:conceptId,kind:"concept",labels:["learned-concept",lesson.conceptId],attrs:{concept:lesson.conceptId,description:lesson.description}});
      this.graph.putEntity({id:abilityId,kind:"capability",labels:["learned-capability",stored.id],attrs:{programId:stored.id,learned:true,durable:true,status:"active",inputs:stored.inputs.map(typeName),output:typeName(stored.output),provenance:stored.provenance,blueprintSnapshot:structuredClone(stored),inputTypeSnapshots:structuredClone(stored.inputs),outputTypeSnapshot:structuredClone(stored.output),snapshotStatus:"validated"}});
      this.graph.putRelation({id:`${conceptId}:implemented:${abilityId}`,kind:"implemented_by",from:conceptId,to:abilityId,confidence:1});
      this.graph.putRelation({id:`${abilityId}:program:${programId}`,kind:"implemented_by_program",from:abilityId,to:programId,confidence:1});
      this.graph.putRelation({id:`${programId}:acquired:${abilityId}`,kind:"acquired_as_capability",from:programId,to:abilityId,confidence:1});
      for(const phrase of lesson.phrases??[]){
        storeLexicalSense(this.graph,{form:phrase,senseId:`learned:${lesson.conceptId}:${safe(phrase)}`,relation:`Learned:${lesson.conceptId}`,definition:lesson.description,confidence:.9,provenance:[...lesson.provenance,`education:${lesson.id}`]});
        const rid=`relation:learned:${lesson.conceptId.toLowerCase()}`;
        if(!this.graph.getEntity(rid)) this.graph.putEntity({id:rid,kind:"concept",labels:["semantic-relation",`Learned:${lesson.conceptId}`],attrs:{relation:`Learned:${lesson.conceptId}`,concept:lesson.conceptId}});
        if(!this.graph.outgoing(rid,"denotes_concept").some(r=>r.to===conceptId)) this.graph.putRelation({id:`${rid}:denotes:${conceptId}`,kind:"denotes_concept",from:rid,to:conceptId,confidence:1});
      }
      this.recordEpisode(lesson.id,true,{kind:"program",conceptId:lesson.conceptId,description:lesson.description,programId:stored.id,abilityId,evaluation,provenance:lesson.provenance});
      return {accepted:true,lessonId:lesson.id,acquiredIds:[programId,conceptId,abilityId]};
    }catch(e){
      this.recordEpisode(lesson.id,false,{kind:"program",conceptId:lesson.conceptId,description:lesson.description,error:String(e),provenance:lesson.provenance});
      return {accepted:false,lessonId:lesson.id,acquiredIds:[],reason:String(e)};
    }
  }

  private recordEpisode(id:string,success:boolean,attrs:Record<string,unknown>):void{
    const eid=`education:${safe(id)}`;
    this.graph.putEntity({id:eid,kind:"episode",labels:["education",success?"accepted":"rejected"],attrs:{lessonId:id,success,...attrs}});
  }
}
