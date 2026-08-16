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

export class MemoryEpisodeStore implements EpisodeStore {
  private readonly episodes: Episode[] = [];
  append(episode: Episode): void { this.episodes.push(structuredClone(episode)); }
  all(): Episode[] { return this.episodes.map(e => structuredClone(e)); }
  byTask(taskId: string): Episode[] { return this.episodes.filter(e => e.taskId === taskId).map(e => structuredClone(e)); }
}
