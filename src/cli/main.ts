import { createInterface } from "node:readline/promises";
import { EkgCli,readlineIo } from "./ekg-cli.js";
import { parseCliUtterance } from "./input.js";
import { openBrainWithBackend, type BrainBackend } from "../brain.js";

interface Args {brainPath?:string;backend?:BrainBackend;teacherEnabled?:boolean;banner:boolean;once?:string;inputs?:string}
function parseArgs(argv:string[]):Args{
  const out:Args={banner:true};
  for(let i=0;i<argv.length;i++){
    const a=argv[i]!;
    if(a==="--brain"){out.brainPath=argv[++i];if(!out.brainPath)throw new Error("--brain requires a path");continue}
    if(a==="--backend"){const v=argv[++i] as BrainBackend;if(v!=="memory"&&v!=="ladybug"&&v!=="auto")throw new Error("--backend must be memory, ladybug, or auto");out.backend=v;continue}
    if(a==="--teacher"){const v=argv[++i];if(v!=="on"&&v!=="off")throw new Error("--teacher must be on or off");out.teacherEnabled=v==="on";continue}
    if(a==="--no-banner"){out.banner=false;continue}
    if(a==="--once"){out.once=argv[++i];if(!out.once)throw new Error("--once requires an utterance");continue}
    if(a==="--inputs"){out.inputs=argv[++i];if(!out.inputs)throw new Error("--inputs requires a JSON array");continue}
    if(a==="--help"||a==="-h"){
      process.stdout.write("Usage: npm run ekg -- [--brain PATH] [--backend memory|ladybug|auto] [--teacher on|off] [--once UTTERANCE --inputs '[...]'] [--no-banner]\n");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  const rl=createInterface({input:process.stdin,output:process.stdout,terminal:!!process.stdin.isTTY});
  const brain=await openBrainWithBackend({brainPath:args.brainPath,backend:args.backend});
  const cli=new EkgCli(readlineIo(rl),{brain,teacherEnabled:args.teacherEnabled,banner:args.banner});
  process.on("SIGINT",()=>{cli.brain.save();cli.brain.close?.();process.exit(0)});
  try{
    if(args.once){
      const line=args.inputs?`${args.once} :: ${args.inputs}`:args.once;
      await cli.handleLine(line);
      cli.brain.save();
      return;
    }
    while(cli.isRunning){
      let line:string;
      try{line=await rl.question("EKG> ");}
      catch{break}
      await cli.handleLine(line);
    }
  }finally{
    cli.brain.save();
    cli.brain.close?.();
    rl.close();
  }
}

main().catch(e=>{process.stderr.write(`Fatal: ${e instanceof Error?e.message:String(e)}\n`);process.exitCode=1});
