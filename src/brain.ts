import fs from "node:fs";
import path from "node:path";
import type { GraphStore } from "./graph/graph.js";
import { MemoryGraphStore, type MemoryGraphState } from "./graph/graph.js";
import type { ProgramLibrary } from "./program-library.js";
import { MemoryProgramLibrary, type MemoryProgramLibraryState } from "./program-library.js";
import type { EpisodeStore } from "./episode.js";
import { MemoryEpisodeStore, type MemoryEpisodeState } from "./episode.js";

export interface Brain {
  readonly graph: GraphStore;
  readonly programs: ProgramLibrary;
  readonly episodes: EpisodeStore;
  readonly filePath: string;
  save(): void;
  close?(): void;
  snapshot(): {graph: MemoryGraphState; programs: MemoryProgramLibraryState; episodes: MemoryEpisodeState};
}

export interface BrainFile {
  format: "ekg-brain";
  version: 1;
  savedAt: string;
  graph: MemoryGraphState;
  programs: MemoryProgramLibraryState;
  episodes: MemoryEpisodeState;
}

/**
 * The runnable EKG brain: fast in-process stores backed by one ordinary JSON file.
 * Construction loads prior state if the file exists. Every mutation rewrites the
 * file atomically (temp file + rename), so acquired competence survives restarts.
 */
export class FileBrain implements Brain {
  readonly graph: MemoryGraphStore;
  readonly programs: MemoryProgramLibrary;
  readonly episodes: MemoryEpisodeStore;
  private saving=false;
  private dirty=false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly filePath = process.env.EKG_BRAIN_PATH ?? "ekg-data/brain.json") {
    this.seedIfNeeded();
    const prior=this.read();
    const changed=()=>this.markDirty();
    this.graph=new MemoryGraphStore(prior?.graph,changed);
    this.programs=new MemoryProgramLibrary(prior?.programs,changed);
    this.episodes=new MemoryEpisodeStore(prior?.episodes,changed);
    if(!prior) this.save();
  }

  private seedIfNeeded(): void {
    if(fs.existsSync(this.filePath)) return;
    const seedPath=path.join(path.dirname(this.filePath),"seed-brain.json");
    if(!fs.existsSync(seedPath)) return;
    const dir=path.dirname(this.filePath);
    fs.mkdirSync(dir,{recursive:true});
    fs.copyFileSync(seedPath,this.filePath);
  }

  private markDirty(): void {
    this.dirty=true;
    if(this.flushTimer) return;
    this.flushTimer=setTimeout(()=>this.flush(),25);
  }

  private flush(): void {
    this.flushTimer=undefined;
    if(!this.dirty) return;
    this.dirty=false;
    this.writeSnapshot();
  }

  snapshot(): BrainFile {
    return {
      format:"ekg-brain",
      version:1,
      savedAt:new Date().toISOString(),
      graph:this.graph.snapshot(),
      programs:this.programs.snapshot(),
      episodes:this.episodes.snapshot()
    };
  }

  /** Explicit public save: clears any pending debounced flush and writes immediately. */
  save(): void {
    if(this.flushTimer){clearTimeout(this.flushTimer);this.flushTimer=undefined}
    this.dirty=false;
    this.writeSnapshot();
  }

  private writeSnapshot(): void {
    if(this.saving) return;
    this.saving=true;
    try {
      const dir=path.dirname(this.filePath);
      fs.mkdirSync(dir,{recursive:true});
      const temp=`${this.filePath}.${process.pid}.tmp`;
      fs.writeFileSync(temp,JSON.stringify(this.snapshot(),null,2),"utf8");
      fs.renameSync(temp,this.filePath);
    } finally {
      this.saving=false;
    }
  }

  private read(): BrainFile | undefined {
    if(!fs.existsSync(this.filePath)) return undefined;
    const parsed=JSON.parse(fs.readFileSync(this.filePath,"utf8")) as BrainFile;
    if(parsed.format!=="ekg-brain" || parsed.version!==1) throw new Error(`Unsupported EKG brain file: ${this.filePath}`);
    return parsed;
  }
}

export function openBrain(filePath?:string):FileBrain { return new FileBrain(filePath); }

export type BrainBackend = "memory" | "ladybug" | "auto";

export async function openBrainWithBackend(options: {brainPath?: string; backend?: BrainBackend} = {}): Promise<Brain> {
  const backend = options.backend ?? (process.env.EKG_GRAPH_BACKEND as BrainBackend | undefined) ?? "auto";
  if (backend === "memory") return new FileBrain(options.brainPath);
  if (backend === "ladybug") {
    const lb = await loadLadybugBrain();
    if (!lb) throw new Error("LadybugDB backend requested but @ladybugdb/core is not installed. Run: npm install @ladybugdb/core");
    return new lb.LadybugBrain(options.brainPath);
  }
  const lb = await loadLadybugBrain();
  if (!lb) return new FileBrain(options.brainPath);
  const defaultLbdbPath = options.brainPath ?? "ekg-data/brain.lbdb";
  const defaultJsonPath = process.env.EKG_BRAIN_PATH ?? "ekg-data/brain.json";
  if (!options.brainPath && fs.existsSync(defaultJsonPath) && !fs.existsSync(defaultLbdbPath)) {
    return lb.migrateFileBrainToLadybug(defaultJsonPath, defaultLbdbPath);
  }
  return new lb.LadybugBrain(options.brainPath);
}

async function loadLadybugBrain(): Promise<typeof import("./graph/ladybug-brain.js") | undefined> {
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    let found = false;
    for (const name of ["@ladybugdb/core", `@ladybugdb/core-${process.platform}-${process.arch}`]) {
      try { req.resolve(name); found = true; break; } catch {}
    }
    if (!found) return undefined;
    return await import("./graph/ladybug-brain.js");
  } catch { return undefined; }
}
