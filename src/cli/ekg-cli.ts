import fs from "node:fs";
import path from "node:path";
import type { Interface } from "node:readline/promises";
import type { Brain } from "../brain.js";
import { FileBrain } from "../brain.js";
import { ekgCapabilities } from "../runtime/ekg-capabilities.js";
import { ensureEkgBootstrap } from "../runtime/bootstrap.js";
import { SelfHealingProgramLibrary, runProgramResilient } from "../runtime/resilience.js";
import { interpretComposedIntent } from "../intent/composition.js";
import { applyClarification } from "../intent/clarification.js";
import { planIntent } from "../intent/planner.js";
import { buildIntentTeacherContext } from "../intent/language-impasse.js";
import { runProgram } from "../runtime/interpreter.js";
import { teachSynonym, storeLexicalSense, lexicalSensesForText } from "../intent/lexicon.js";
import { dispatchUtterance } from "../intent/semantic-dispatch.js";
import { askTeacherStructured, isTeacherAvailable, type TeacherBlueprint } from "./teacher-transport.js";
import { assertWorldFact } from "../language/world-language.js";
import { PORTABLE_SEMANTIC_CATALOG } from "../intent/semantic-catalog.js";
import { validateProgram } from "../ir/validate.js";
import { LearnerController } from "../controller.js";
import { recordPhraseGroundingOutcome } from "../intent/phrase-grounding.js";
import type { IntentInterpretation } from "../intent/intent.js";
import type { Value, ProgramBlueprint } from "../ir/blueprint.js";
import type { Type } from "../ir/types.js";
import { formatCliValue,parseCliUtterance,parseTypedCliValue,renderType,validateCliInputs } from "./input.js";

/** Thrown to unwind out of a prompt/clarify loop when the user types /exit or /quit mid-input. */
class ExitRequested extends Error {
  constructor(){super("exit requested")}
}

function isExitCommand(raw:string):boolean{
  const t=raw.trim().toLowerCase();
  return t==="/exit"||t==="/quit";
}

export interface EkgCliOptions {
  brainPath?:string;
  brain?:Brain;
  teacherEnabled?:boolean;
  banner?:boolean;
}

export interface EkgCliIo {
  line(text:string):void;
  error(text:string):void;
  question(prompt:string):Promise<string>;
}

export class EkgCli {
  readonly brain:Brain;
  readonly caps=ekgCapabilities();
  readonly programs:SelfHealingProgramLibrary;
  readonly controller:LearnerController;
  teacherEnabled:boolean;
  private running=true;
  readonly bootstrap:{initialized:boolean;starterEnglishLessons:number;starterWorldLessons:number};

  constructor(private readonly io:EkgCliIo,options:EkgCliOptions={}){
    this.brain=options.brain??new FileBrain(options.brainPath);
    this.bootstrap=ensureEkgBootstrap(this.brain.graph,this.caps);
    this.programs=new SelfHealingProgramLibrary(this.brain.programs as any,this.brain.graph,this.caps);
    this.controller=new LearnerController(this.caps,this.programs,this.brain.episodes);
    this.teacherEnabled=options.teacherEnabled??true;
    if(options.banner!==false) this.printBanner();
  }

  get isRunning(){return this.running}

  private printBanner():void{
    this.io.line(`EKG ${this.bootstrap.initialized?"initialized":"loaded"}`);
    this.io.line(`Brain: ${this.brain.filePath}`);
    this.io.line(`Capabilities: ${this.caps.all().length} | Learned programs: ${this.brain.programs.all().length}`);
    if(this.bootstrap.initialized) this.io.line(`Starter English curriculum installed: ${this.bootstrap.starterEnglishLessons} lexical lessons`);
    this.io.line(`Type /help for commands. Use \"utterance :: [inputs]\" to supply runtime values inline.`);
  }

  async handleLine(rawLine:string):Promise<void>{
    const line=rawLine.trim();
    if(!line) return;
    try{
      if(line.startsWith("/")){ await this.handleCommand(line); return; }
      const parsed=parseCliUtterance(line);
      await this.executeUtterance(parsed.utterance,parsed.inputs);
    }catch(e){
      if(e instanceof ExitRequested){ this.brain.save(); this.running=false; this.io.line("Saved. Bye."); return; }
      this.io.error(e instanceof Error?e.message:String(e));
    }
  }

  private async executeUtterance(rawUtterance:string,providedInputs?:Value[]):Promise<void>{
    const MAX_LEARN_ROUNDS = 3;

    for(let round=0; round<=MAX_LEARN_ROUNDS; round++){
      // 1. PARSE: semantic parser + construction grammar
      const dispatch=dispatchUtterance(this.brain.graph,this.caps,this.programs,rawUtterance,providedInputs);

      // 2. DIRECT RESULTS: facts, queries, conversational - no synthesis needed
      if(dispatch.status==="fact-recorded"){ this.io.line(dispatch.message); return; }
      if(dispatch.status==="answer"){ this.io.line(formatCliValue(dispatch.value)); return; }
      if(dispatch.status==="conversational"){ this.io.line(dispatch.response); return; }

      // 3. EXECUTED: semantic parser handled it directly (inline values, zero-arg caps)
      if(dispatch.status==="executed"){
        this.io.line(formatCliValue(dispatch.value));
        this.persistLearnedProgram(dispatch.program,`semantic:${rawUtterance.toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,80)}`,rawUtterance);
        return;
      }

      // 4. INTENT RESOLVED: run through full RUN -> ADAPT -> BUILD -> TEACH controller
      if(dispatch.status==="intent" && dispatch.interpretation.status==="resolved"){
        const interpreted=dispatch.interpretation;
        const inputTypes=interpreted.intent.signals.filter(s=>s.binding==="input").sort((a,b)=>(a.inputIndex??0)-(b.inputIndex??0)).map(s=>s.type);
        const inputs=providedInputs??await this.promptInputs(inputTypes);
        validateCliInputs(inputs,inputTypes);

        const plan=planIntent(interpreted.intent,this.caps,this.brain.graph,this.programs);
        if(plan.status==="planned" && plan.program){
          const output=runProgram(plan.program,inputs,this.caps,this.programs);
          this.io.line(formatCliValue(output));
          this.persistLearnedProgram(plan.program,interpreted.intent.id,rawUtterance,interpreted.intent.constraints.map(c=>c.relation));
          try{recordPhraseGroundingOutcome(this.brain.graph,rawUtterance,true);}catch{}
          return;
        }
      }

      // 5. UNRESOLVED: ask Teacher, learn, retry
      if(!this.teacherEnabled || !isTeacherAvailable() || round >= MAX_LEARN_ROUNDS) break;

      const renderType=(t:any):string=>t.kind==="list"?`List<${renderType(t.item)}>`:t.kind;
      const hostCaps=this.caps.all().map(c=>`${c.id}(${c.inputs.map(renderType).join(",")}) -> ${renderType(c.output)}`);
      const learnedProgs=this.brain.programs.all().map(p=>`${p.id}(${p.inputs.map(renderType).join(",")}) -> ${renderType(p.output)} [learned, use program_call]`);
      const allCaps=[...hostCaps,...learnedProgs];
      const capSummary=allCaps.length>50?allCaps.slice(0,50).join("\n")+`\n... and ${allCaps.length-50} more`:allCaps.join("\n");
      const knownRelations=[...new Set(PORTABLE_SEMANTIC_CATALOG.map(d=>d.relation))];

      this.io.line(round===0?"Asking Teacher...":"Retrying with new knowledge...");
      const lesson=askTeacherStructured(rawUtterance,capSummary,knownRelations);
      if(!lesson) break;

      const learned=this.learnFromTeacher(lesson,rawUtterance);
      if(learned.length===0){ this.io.line(lesson.answer); return; }
      this.io.line(`Learned: ${learned.join(", ")}`);
    }

    // 6. FINAL FALLBACK: legacy intent with clarification
    let interpreted:IntentInterpretation = interpretComposedIntent(rawUtterance,this.brain.graph);
    while(interpreted.status==="clarify"){
      const answer=await this.io.question(`${interpreted.question}\nclarify> `);
      if(isExitCommand(answer)) throw new ExitRequested();
      interpreted=applyClarification(interpreted,answer.trim());
    }
    if(interpreted.status!=="resolved"){
      this.io.line(this.teacherEnabled?`Could not resolve: ${(interpreted as any).reason??rawUtterance}`:`Unresolved (Teacher OFF): ${(interpreted as any).reason??rawUtterance}`);
      return;
    }
    const inputTypes=interpreted.intent.signals.filter(s=>s.binding==="input").sort((a,b)=>(a.inputIndex??0)-(b.inputIndex??0)).map(s=>s.type);
    const inputs=providedInputs??await this.promptInputs(inputTypes);
    validateCliInputs(inputs,inputTypes);
    const plan=planIntent(interpreted.intent,this.caps,this.brain.graph,this.programs);
    if(plan.status!=="planned"||!plan.program){ this.io.line(`Unsupported: ${plan.reason??"could not plan"}`); return; }
    const output=runProgram(plan.program,inputs,this.caps,this.programs);
    this.io.line(formatCliValue(output));
    this.persistLearnedProgram(plan.program,interpreted.intent.id,rawUtterance,interpreted.intent.constraints.map(c=>c.relation));
    try{recordPhraseGroundingOutcome(this.brain.graph,rawUtterance,true);}catch{}
  }

  private learnFromTeacher(lesson:{groundings:Array<{form:string;relation:string;definition?:string;impliedValue?:number;questionFor?:string}>;capabilityMappings?:Array<{form:string;capabilityId:string;relation:string;definition?:string}>;blueprints?:Array<TeacherBlueprint>;facts:Array<{subject:string;predicate:string;object:string}>;synonyms:Array<{newForm:string;knownForm:string}>},utterance:string):string[]{
    const learned:string[]=[];
    const safe=(s:string)=>s.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
    for(const bp of lesson.blueprints??[]){
      try{
        const program={id:bp.id,name:bp.description,inputs:bp.inputs as any[],output:bp.output as any,body:bp.body,provenance:["teacher:llm-blueprint",`utterance:${utterance}`]};
        validateProgram(program,this.caps,this.programs);
        this.persistLearnedProgram(program,bp.id,utterance);
        for(const phrase of bp.phrases??[]){
          storeLexicalSense(this.brain.graph,{form:phrase,senseId:`teacher:${safe(phrase)}:${safe(bp.id)}`,relation:`Learned:${bp.id}`,definition:bp.description,confidence:.9,provenance:["teacher:llm-blueprint",`utterance:${utterance}`]});
        }
        learned.push(`program: ${bp.id} (${bp.description})`);
      }catch(e){
        learned.push(`blueprint rejected: ${bp.id} (${e instanceof Error?e.message:String(e)})`);
      }
    }
    for(const m of lesson.capabilityMappings??[]){
      try{
        this.caps.get(m.capabilityId);
        const relationId=`relation:${m.relation.toLowerCase()}`;
        const conceptId=`concept:semantic:teacher.${safe(m.relation)}`;
        const capabilityId=`capability:${m.capabilityId}`;
        if(!this.brain.graph.getEntity(relationId)) this.brain.graph.putEntity({id:relationId,kind:"concept",labels:["semantic-relation",m.relation],attrs:{relation:m.relation,concept:`teacher.${m.relation}`,gloss:m.definition}});
        if(!this.brain.graph.getEntity(conceptId)) this.brain.graph.putEntity({id:conceptId,kind:"concept",labels:["semantic-concept",`teacher.${m.relation}`],attrs:{concept:`teacher.${m.relation}`,gloss:m.definition}});
        if(!this.brain.graph.getEntity(capabilityId)) this.brain.graph.putEntity({id:capabilityId,kind:"capability",labels:[m.capabilityId],attrs:{capabilityId:m.capabilityId}});
        if(!this.brain.graph.outgoing(relationId,"denotes_concept").some(r=>r.to===conceptId)) this.brain.graph.putRelation({id:`${relationId}:denotes:${conceptId}`,kind:"denotes_concept",from:relationId,to:conceptId,confidence:1});
        if(!this.brain.graph.outgoing(conceptId,"implemented_by").some(r=>r.to===capabilityId)) this.brain.graph.putRelation({id:`${conceptId}:implemented:${capabilityId}`,kind:"implemented_by",from:conceptId,to:capabilityId,confidence:1});
        storeLexicalSense(this.brain.graph,{form:m.form,senseId:`teacher:${safe(m.form)}:${safe(m.relation)}`,relation:m.relation,definition:m.definition,confidence:.9,provenance:["teacher:llm-capability-mapping",`utterance:${utterance}`]});
        learned.push(`${m.form} -> ${m.capabilityId}`);
      }catch{}
    }
    for(const g of lesson.groundings){
      try{
        const existing=lexicalSensesForText(this.brain.graph,g.form);
        if(existing.some(s=>s.relation===g.relation)) continue;
        storeLexicalSense(this.brain.graph,{
          form:g.form, senseId:`teacher:${safe(g.form)}:${safe(g.relation)}`, relation:g.relation,
          definition:g.definition, impliedValue:g.impliedValue, questionFor:g.questionFor,
          confidence:.85, provenance:["teacher:llm-structured",`utterance:${utterance}`]
        });
        learned.push(`${g.form} -> ${g.relation}`);
      }catch{}
    }
    for(const f of lesson.facts){
      try{
        assertWorldFact(this.brain.graph,{subject:f.subject,predicate:f.predicate,object:f.object,provenance:["teacher:llm-structured",`utterance:${utterance}`]});
        learned.push(`fact: ${f.subject} ${f.predicate} ${f.object}`);
      }catch{}
    }
    for(const s of lesson.synonyms){
      try{
        const existing=lexicalSensesForText(this.brain.graph,s.newForm);
        if(existing.length>0) continue;
        teachSynonym(this.brain.graph,{form:s.newForm,knownForm:s.knownForm,provenance:["teacher:llm-structured",`utterance:${utterance}`]});
        learned.push(`synonym: ${s.newForm} = ${s.knownForm}`);
      }catch{}
    }
    return learned;
  }

  private persistLearnedProgram(program:ProgramBlueprint,intentId:string,utterance:string,relations:string[]=[]):void{
    const safe=(s:string)=>s.replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^-|-$/g,"").slice(0,120);
    const stored=this.programs.put({...program,provenance:[...(program.provenance??[]),"cli:interactive-execution"]});
    const programEntityId=`program:${stored.id}`;
    const conceptId=`concept:learned:${safe(intentId)}`;
    const abilityId=`capability:learned:${stored.id}`;
    const typeName=(t:any):string=>t.kind==="list"?`List<${typeName(t.item)}>`:t.kind;
    if(!this.brain.graph.getEntity(programEntityId)){
      this.brain.graph.putEntity({id:programEntityId,kind:"program",labels:["learned-program",stored.id],attrs:{programId:stored.id,description:`Learned from: ${utterance}`,inputs:stored.inputs.map(typeName),output:typeName(stored.output),provenance:stored.provenance,blueprintSnapshot:structuredClone(stored),inputTypeSnapshots:structuredClone(stored.inputs),outputTypeSnapshot:structuredClone(stored.output),snapshotStatus:"validated"}});
    }
    if(!this.brain.graph.getEntity(conceptId)){
      this.brain.graph.putEntity({id:conceptId,kind:"concept",labels:["learned-concept",intentId],attrs:{concept:intentId,description:`Learned from: ${utterance}`}});
    }
    if(!this.brain.graph.getEntity(abilityId)){
      this.brain.graph.putEntity({id:abilityId,kind:"capability",labels:["learned-capability",stored.id],attrs:{programId:stored.id,learned:true,durable:true,status:"active",inputs:stored.inputs.map(typeName),output:typeName(stored.output),provenance:stored.provenance}});
      this.brain.graph.putRelation({id:`${conceptId}:implemented:${abilityId}`,kind:"implemented_by",from:conceptId,to:abilityId,confidence:1});
      this.brain.graph.putRelation({id:`${abilityId}:program:${programEntityId}`,kind:"implemented_by_program",from:abilityId,to:programEntityId,confidence:1});
      this.brain.graph.putRelation({id:`${programEntityId}:acquired:${abilityId}`,kind:"acquired_as_capability",from:programEntityId,to:abilityId,confidence:1});
    }
    for(const relation of relations){
      const rid=`relation:${relation.toLowerCase()}`;
      if(!this.brain.graph.getEntity(rid)) this.brain.graph.putEntity({id:rid,kind:"concept",labels:["semantic-relation",relation],attrs:{relation}});
      if(!this.brain.graph.outgoing(rid,"denotes_concept").some(r=>r.to===conceptId)) this.brain.graph.putRelation({id:`${rid}:denotes:${conceptId}`,kind:"denotes_concept",from:rid,to:conceptId,confidence:1});
    }
  }

  private async promptInputs(types:Type[]):Promise<Value[]>{
    const out:Value[]=[];
    for(let i=0;i<types.length;i++){
      const type=types[i]!;
      const raw=await this.io.question(`input[${i}] (${renderType(type)})> `);
      if(isExitCommand(raw)) throw new ExitRequested();
      out.push(parseTypedCliValue(raw,type));
    }
    return out;
  }

  private async handleCommand(line:string):Promise<void>{
    const [command,...rest]=line.split(/\s+/);
    const args=rest.join(" ").trim();
    switch(command.toLowerCase()){
      case "/help": return this.help();
      case "/brain": return this.brainStatus();
      case "/capabilities": return this.capabilities(args);
      case "/programs": return this.listPrograms(args);
      case "/experience": return this.experience(args);
      case "/save": this.brain.save(); this.io.line(`Saved ${this.brain.filePath}`); return;
      case "/export-seed": return this.exportSeed(args);
      case "/teacher": return this.teacher(args);
      case "/teach": return this.teach(args);
      case "/run": return this.runLearned(args);
      case "/exit":
      case "/quit": this.brain.save(); this.running=false; this.io.line("Saved. Bye."); return;
      default: this.io.error(`Unknown command ${command}. Type /help.`); return;
    }
  }

  private help():void{
    this.io.line([
      "Commands:",
      "  /help                         Show this help",
      "  /brain                        Show persisted brain counts/path",
      "  /capabilities [filter]        List host/core capabilities",
      "  /programs [filter]            List learned executable procedures",
      "  /experience [subject-id]      Show recent successful/failed execution traces",
      "  /run <program-id> :: [args]   Execute a learned procedure directly",
      "  /teach synonym NEW = KNOWN    Persist a synonym lesson using known language",
      "  /teacher on|off|status        Control Teacher escalation display",
      "  /save                         Force-save brain",
      "  /export-seed [path]           Export current brain as a seed-brain.json",
      "  /exit                         Save and quit",
      "",
      "Natural-language input:",
      "  deduct six from this number",
      "  deduct six from this number :: [20]",
      "",
      "The :: suffix is a JSON array of runtime inputs. For one list input, nest it: :: [[1,2,3]]"
    ].join("\n"));
  }

  private brainStatus():void{
    const snap=this.brain.snapshot();
    const graphSnap=snap.graph;
    const experiences=graphSnap.entities.filter(e=>e.kind==="episode"&&e.labels?.includes("execution-experience"));
    let bytes=0; try{bytes=fs.statSync(this.brain.filePath).size}catch{}
    this.io.line([
      `Brain: ${this.brain.filePath}`,
      `File: ${bytes} bytes`,
      `Graph: ${graphSnap.entities.length} entities, ${graphSnap.relations.length} relations`,
      `Learned programs: ${snap.programs.programs.length}`,
      `Execution experiences: ${experiences.length}`,
      `Controller episodes: ${snap.episodes.episodes.length}`,
      `Teacher display: ${this.teacherEnabled?"ON":"OFF"}`
    ].join("\n"));
  }

  private capabilities(filter:string):void{
    const needle=filter.toLowerCase();
    const caps=this.caps.all().filter(c=>!needle||c.id.toLowerCase().includes(needle));
    if(!caps.length){this.io.line("No matching capabilities.");return}
    this.io.line(caps.map(c=>`${c.id} (${c.inputs.map(renderType).join(", ")}) -> ${renderType(c.output)} [${c.pure?"pure":"effectful"}${c.searchSafe===false?", no-search":""}]`).join("\n"));
  }

  private listPrograms(filter:string):void{
    const needle=filter.toLowerCase();
    const programs=this.brain.programs.all().filter(p=>!needle||p.id.toLowerCase().includes(needle)||(p.name??"").toLowerCase().includes(needle));
    if(!programs.length){this.io.line("No learned programs.");return}
    this.io.line(programs.map(p=>`${p.id}${p.name?` — ${p.name}`:""} (${p.inputs.map(renderType).join(", ")}) -> ${renderType(p.output)}`).join("\n"));
  }

  private experience(subject:string):void{
    const graphExperiences=this.brain.graph.entitiesByKind("episode")
      .filter(e=>e.labels?.includes("execution-experience") && (!subject||e.attrs?.subjectId===subject))
      .map(e=>e.attrs as Record<string,unknown>);
    const all=[...graphExperiences]
      .sort((a,b)=>String(a.timestamp??"").localeCompare(String(b.timestamp??"")))
      .slice(-10);
    if(!all.length){this.io.line("No matching execution experience.");return}
    this.io.line(all.map(e=>`${String(e.timestamp??"")} ${String(e.status??"")} ${String(e.subjectKind??"")}:${String(e.subjectId??"")}${e.error?` — ${String(e.error)}`:""}`).join("\n"));
  }

  private teacher(args:string):void{
    const mode=args.trim().toLowerCase();
    if(!mode||mode==="status"){this.io.line(`Teacher display is ${this.teacherEnabled?"ON":"OFF"}.`);return}
    if(mode==="on"){this.teacherEnabled=true;this.io.line("Teacher display ON.");return}
    if(mode==="off"){this.teacherEnabled=false;this.io.line("Teacher display OFF.");return}
    this.io.error("Usage: /teacher on|off|status");
  }

  private teach(args:string):void{
    const m=/^synonym\s+(.+?)\s*=\s*(.+)$/i.exec(args);
    if(!m){this.io.error("Usage: /teach synonym NEW = KNOWN");return}
    const form=m[1]!.trim(),knownForm=m[2]!.trim();
    const learned=teachSynonym(this.brain.graph,{form,knownForm,provenance:["teacher:local-cli","manual-synonym-lesson"]});
    this.io.line(`Learned: ${learned.form} -> ${learned.relation} (via ${knownForm})`);
  }

  private exportSeed(args:string):void{
    const dest=args.trim()||path.join(path.dirname(this.brain.filePath),"seed-brain.json");
    this.brain.save();
    const snap=this.brain.snapshot();
    const seed={format:"ekg-brain" as const,version:1 as const,savedAt:new Date().toISOString(),graph:snap.graph,programs:snap.programs,episodes:{episodes:[]}};
    const dir=path.dirname(dest);
    fs.mkdirSync(dir,{recursive:true});
    const temp=`${dest}.${process.pid}.tmp`;
    fs.writeFileSync(temp,JSON.stringify(seed,null,2),"utf8");
    fs.renameSync(temp,dest);
    this.io.line(`Seed exported: ${dest} (${snap.graph.entities.length} entities, ${snap.graph.relations.length} relations, ${snap.programs.programs.length} programs)`);
  }

  private runLearned(args:string):void{
    const parsed=parseCliUtterance(args);
    const programId=parsed.utterance.trim();
    if(!programId){this.io.error("Usage: /run <program-id> :: [args]");return}
    if(!parsed.inputs){this.io.error("/run requires :: [args]");return}
    const program=this.programs.get(programId);
    if(!program){this.io.error(`Unknown learned program: ${programId}`);return}
    validateCliInputs(parsed.inputs,program.inputs);
    const result=runProgramResilient(program,parsed.inputs,this.caps,this.programs);
    this.io.line(formatCliValue(result.value));
    if(result.retries) this.io.line(`Self-healed and retried ${result.retries} time(s).`);
  }
}

export function readlineIo(rl:Interface):EkgCliIo{
  return {
    line:text=>process.stdout.write(`${text}\n`),
    error:text=>process.stderr.write(`Error: ${text}\n`),
    question:prompt=>rl.question(prompt)
  };
}
