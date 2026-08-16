import { T } from "../ir/types.js";
import type { GraphStore } from "../graph/graph.js";
import type { Intent, IntentInterpretation } from "../intent/intent.js";
import type { TaskSpec } from "../task.js";

export interface FileExtremePatternLesson {
  id:string;
  patternId:string;
  provenance:string[];
  validationExamples:Array<{
    utterance:string;
    expectedRelation:"LongestFilename"|"ShortestFilename";
  }>;
}

const PATTERN_ID="intent-pattern:file-extreme-filename";

export function hasFileExtremePattern(store:GraphStore):boolean{
  return !!store.getEntity(PATTERN_ID);
}

function parseWithPattern(raw:string):IntentInterpretation{
  const lower=raw.toLowerCase();
  const hasFilename=/\b(file\s*name|filename)\b/.test(lower);
  const hasContainer=/\b(folder|directory)\b/.test(lower);
  const extreme=/\b(longest|shortest)\b/.exec(lower)?.[1];
  if(!hasFilename||!hasContainer||!extreme)
    return {status:"teacher",reason:"file-extreme pattern does not cover this utterance",rawUtterance:raw};
  const relation=extreme==="longest"?"LongestFilename":"ShortestFilename";
  const intent:Intent={
    id:`intent:file-extreme:${relation.toLowerCase()}`,
    rawUtterance:raw,
    signals:[{id:"signal.folder",concept:"Folder",type:T.string,binding:"input",inputIndex:0,provenance:["utterance:folder"]}],
    goal:{concept:"Filename",type:T.string},
    constraints:[{relation,args:["signal.folder"],provenance:[PATTERN_ID]}],
    confidence:.9,
    provenance:["file-intent-pattern:v0.1",PATTERN_ID]
  };
  return {status:"resolved",intent,alternatives:[]};
}

export function interpretFileIntent(raw:string,store:GraphStore):IntentInterpretation{
  if(!hasFileExtremePattern(store))
    return {status:"teacher",reason:"no learned file-extreme intent pattern",rawUtterance:raw};
  return parseWithPattern(raw);
}

export function validateAndLearnFileExtremePattern(store:GraphStore,lesson:FileExtremePatternLesson){
  if(lesson.provenance.length===0) throw new Error("file intent lesson provenance is required");
  if(lesson.validationExamples.length<2) throw new Error("file intent lesson requires contrasting validation examples");
  const failures:string[]=[];
  for(const ex of lesson.validationExamples){
    const parsed=parseWithPattern(ex.utterance);
    if(parsed.status!=="resolved") failures.push(`${ex.utterance}: ${parsed.status}`);
    else if(parsed.intent.constraints[0]?.relation!==ex.expectedRelation)
      failures.push(`${ex.utterance}: relation=${parsed.intent.constraints[0]?.relation}`);
  }
  if(failures.length) return {accepted:false,failures};
  store.putEntity({
    id:PATTERN_ID,kind:"concept",labels:["intent-pattern","file","extreme","filename"],
    attrs:{patternId:lesson.patternId,provenance:[...lesson.provenance,`lesson:${lesson.id}`],validatedExamples:lesson.validationExamples.length}
  });
  return {accepted:true,failures:[]};
}

export function fileIntentToTask(
  intent:Intent,
  examples:Array<{folder:string;expectedFilename:string}>,
  id:string,
):TaskSpec{
  const relation=intent.constraints[0]?.relation;
  if(relation!=="LongestFilename"&&relation!=="ShortestFilename") throw new Error("unsupported file intent relation");
  return {
    id,
    inputs:[T.string],output:T.string,
    examples:examples.map(x=>({inputs:[x.folder],output:x.expectedFilename})),
    labels:[`semantic:${relation.toLowerCase()}`],
    family:"file-extreme-filename"
  };
}
