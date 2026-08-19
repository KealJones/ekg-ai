export type DecisionKind = "RUN" | "ADAPT" | "BUILD" | "TEACH";

export interface Episode {
  id: string;
  taskId: string;
  decision: DecisionKind;
  retrievedProgramIds: string[];
  selectedProgramId?: string;
  success: boolean;
  synthesized?: boolean;
  reusedSeedProgramIds?: string[];
  searchCandidatesExplored?: number;
  searchDepthReached?: number;
  timestamp: string;
}

export interface EpisodeStore {
  append(episode: Episode): void;
  all(): Episode[];
  byTask(taskId: string): Episode[];
}

export interface MemoryEpisodeState { episodes: Episode[]; }

export class MemoryEpisodeStore implements EpisodeStore {
  private readonly episodes: Episode[] = [];
  constructor(initial?: MemoryEpisodeState, private readonly onChange?: () => void) {
    for(const e of initial?.episodes ?? []) this.episodes.push(structuredClone(e));
  }
  append(episode: Episode): void { this.episodes.push(structuredClone(episode)); this.onChange?.(); }
  all(): Episode[] { return this.episodes.map(e => structuredClone(e)); }
  byTask(taskId: string): Episode[] { return this.episodes.filter(e => e.taskId === taskId).map(e => structuredClone(e)); }
  snapshot(): MemoryEpisodeState { return {episodes:this.all()}; }
}
