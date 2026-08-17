import { T } from "../ir/types.js";
import type { Expr, ProgramBlueprint } from "../ir/blueprint.js";
import type { ProgramLesson } from "./teacher-school.js";

const input=(index:number,type:any):Expr=>({kind:"input",index,type});
const constant=(value:any,type:any):Expr=>({kind:"const",value,type});
const call=(capabilityId:string,args:Expr[],type:any):Expr=>({kind:"call",capabilityId,args,type});

/**
 * A Teacher-authored lesson, not a host primitive. The learner acquires this
 * executable procedure into durable competence after validation.
 */
export function twoLevelDotPathLesson():ProgramLesson{
  const object=input(0,T.json), path=input(1,T.string);
  const parts=call("core.string_split",[path,constant(".",T.string)],T.list(T.string));
  const firstKey=call("core.list_get_string",[parts,constant(0,T.int)],T.string);
  const secondKey=call("core.list_get_string",[parts,constant(1,T.int)],T.string);
  const firstValue=call("core.json_get",[object,firstKey],T.json);
  const body=call("core.json_get",[firstValue,secondKey],T.json);
  const program:ProgramBlueprint={
    id:"learned.object.dot-path.two-level",
    name:"Get a nested object value from a two-segment dot path",
    inputs:[T.json,T.string],output:T.json,body,
    properties:["object-path","two-level","dot-separated"],
    provenance:["teacher:gpt-5.6-sol","curriculum:structured-data"]
  };
  return {
    id:"lesson.object.dot-path.two-level.001",
    conceptId:"object.dot-path.two-level",
    description:"retrieve a nested JSON/object value by splitting a two-segment dot path and applying property lookup twice",
    program,
    phrases:["get nested property","dot path","nested key"],
    provenance:["teacher:gpt-5.6-sol","curriculum:structured-data","lesson:worked-procedure"],
    validationTask:{id:"curriculum.object.dot-path.two-level.validation",inputs:[T.json,T.string],output:T.json,examples:[
      {inputs:[{foo:{bar:"baz"}},"foo.bar"],output:"baz"},
      {inputs:[{user:{name:"Ava"}},"user.name"],output:"Ava"},
      {inputs:[{a:{b:42}},"a.b"],output:42},
      {inputs:[{outer:{flag:true}},"outer.flag"],output:true},
    ]}
  };
}
