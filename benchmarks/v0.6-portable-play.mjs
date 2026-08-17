import {babyCapabilities,T,synthesize,runProgram} from "../dist/index.js";
const caps=babyCapabilities();
console.log(`baby capability count: ${caps.all().length}`);
console.log(caps.all().map(c=>c.id).sort().join("\n"));
const task={id:"play:abs-difference",inputs:[T.int,T.int],output:T.int,examples:[
  {inputs:[9,4],output:5},{inputs:[4,9],output:5},{inputs:[7,7],output:0},{inputs:[17,5],output:12},{inputs:[5,17],output:12},{inputs:[2,1],output:1},{inputs:[1,2],output:1}
]};
const p=synthesize(task,caps,{maxDepth:2});
console.log("\nlearn/play target: absolute integer difference");
console.log("synthesized:",p?JSON.stringify(p.body):"NO SOLUTION");
if(p) console.log("17 vs 5 =>",runProgram(p,[17,5],caps));
