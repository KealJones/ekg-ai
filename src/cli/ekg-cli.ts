import fs from "node:fs";
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
import { teachSynonym } from "../intent/lexicon.js";
import type { IntentInterpretation } from "../intent/intent.js";
import type { Value } from "../ir/blueprint.js";
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
  teacherEnabled:boolean;
  private running=true;
  readonly bootstrap:{initialized:boolean;starterEnglishLessons:number};

  constructor(private readonly io:EkgCliIo,options:EkgCliOptions={}){
    this.brain=options.brain??new FileBrain(options.brainPath);
    this.bootstrap=ensureEkgBootstrap(this.brain.graph,this.caps);
    this.programs=new SelfHealingProgramLibrary(this.brain.programs as any,this.brain.graph,this.caps);
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
    let interpreted:IntentInterpretation=interpretComposedIntent(rawUtterance,this.brain.graph);
    while(interpreted.status==="clarify"){
      const answer=await this.io.question(`${interpreted.question}\nclarify> `);
      if(isExitCommand(answer)) throw new ExitRequested();
      interpreted=applyClarification(interpreted,answer.trim());
    }
    if(interpreted.status==="teacher"){
      if(!this.teacherEnabled){
        this.io.line(`Unresolved (Teacher OFF): ${interpreted.reason}`);
        return;
      }
      const context=buildIntentTeacherContext(rawUtterance,interpreted,this.caps);
      this.io.line(`Teacher needed: ${interpreted.reason}`);
      if(context?.impasse) this.io.line(`Impasse: ${context.impasse}`);
      this.io.line(`No external Teacher transport is configured in the local CLI yet. Use /teach synonym <new> = <known> for a simple validated lexical lesson.`);
      return;
    }

    const inputTypes=interpreted.intent.signals
      .filter(s=>s.binding==="input")
      .sort((a,b)=>(a.inputIndex??0)-(b.inputIndex??0))
      .map(s=>s.type);
    const inputs=providedInputs??await this.promptInputs(inputTypes);
    validateCliInputs(inputs,inputTypes);
    const plan=planIntent(interpreted.intent,this.caps,this.brain.graph,this.programs);
    if(plan.status!=="planned" || !plan.program){
      this.io.line(`Unsupported: ${plan.reason??"could not construct a plan"}`);
      return;
    }
    const output=runProgram(plan.program,inputs,this.caps,this.programs);
    this.io.line(formatCliValue(output));
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
      "  /save                         Force-save brain.json",
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
