import fs from "node:fs";
import path from "node:path";
import type { Brain } from "../brain.js";
import type { MemoryGraphState } from "./graph.js";
import { LadybugGraphStore, type LadybugOpenOptions } from "./ladybug.js";
import { MemoryProgramLibrary, type MemoryProgramLibraryState } from "../program-library.js";
import { MemoryEpisodeStore, type MemoryEpisodeState } from "../episode.js";
import { FileBrain } from "../brain.js";

interface MetaFile {
  format: "ekg-brain-meta";
  version: 1;
  savedAt: string;
  programs: MemoryProgramLibraryState;
  episodes: MemoryEpisodeState;
}

export class LadybugBrain implements Brain {
  readonly graph: LadybugGraphStore;
  readonly programs: MemoryProgramLibrary;
  readonly episodes: MemoryEpisodeStore;
  readonly filePath: string;
  private readonly metaPath: string;
  private saving = false;

  constructor(lbdbPath?: string, openOptions?: LadybugOpenOptions) {
    this.filePath = lbdbPath ?? process.env.EKG_LADYBUG_PATH ?? "ekg-data/brain.lbdb";
    this.metaPath = `${this.filePath}.meta.json`;
    this.graph = LadybugGraphStore.open({ ...openOptions, path: this.filePath });
    const meta = this.readMeta();
    this.programs = new MemoryProgramLibrary(meta?.programs);
    this.episodes = new MemoryEpisodeStore(meta?.episodes);
  }

  snapshot() {
    return {
      graph: this.graph.snapshot(),
      programs: this.programs.snapshot(),
      episodes: this.episodes.snapshot(),
    };
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    try {
      const dir = path.dirname(this.metaPath);
      fs.mkdirSync(dir, { recursive: true });
      const meta: MetaFile = {
        format: "ekg-brain-meta",
        version: 1,
        savedAt: new Date().toISOString(),
        programs: this.programs.snapshot(),
        episodes: this.episodes.snapshot(),
      };
      const temp = `${this.metaPath}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(meta, null, 2), "utf8");
      fs.renameSync(temp, this.metaPath);
    } finally {
      this.saving = false;
    }
  }

  close(): void {
    this.save();
    this.graph.close();
  }

  private readMeta(): MetaFile | undefined {
    if (!fs.existsSync(this.metaPath)) return undefined;
    const parsed = JSON.parse(fs.readFileSync(this.metaPath, "utf8")) as MetaFile;
    if (parsed.format !== "ekg-brain-meta" || parsed.version !== 1) {
      throw new Error(`Unsupported EKG brain meta file: ${this.metaPath}`);
    }
    return parsed;
  }
}

export function migrateFileBrainToLadybug(jsonPath: string, lbdbPath: string): LadybugBrain {
  const file = new FileBrain(jsonPath);
  const ladybug = new LadybugBrain(lbdbPath);
  ladybug.graph.clear();
  const snap = file.snapshot();
  for (const entity of snap.graph.entities) ladybug.graph.putEntity(entity);
  for (const relation of snap.graph.relations) ladybug.graph.putRelation(relation);
  for (const program of snap.programs.programs) ladybug.programs.put(program);
  for (const episode of snap.episodes.episodes) ladybug.episodes.append(episode);
  ladybug.save();
  return ladybug;
}
