export interface SemanticEncoder {
  readonly id: string;
  embed(texts: string[]): Promise<number[][]>;
}

export interface SemanticPrototype {
  id: string;
  examples: string[];
}

export interface SemanticMatch {
  prototypeId: string;
  score: number;
}

function assertVector(v: number[], label: string): void {
  if (v.length === 0) throw new Error(`${label} embedding must not be empty`);
  if (!v.every(Number.isFinite)) throw new Error(`${label} embedding must contain only finite numbers`);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  assertVector(a, "left");
  assertVector(b, "right");
  if (a.length !== b.length) throw new Error("embedding dimensions must match");
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  if (aa === 0 || bb === 0) return 0;
  return dot / Math.sqrt(aa * bb);
}

export async function rankSemanticPrototypes(
  encoder: SemanticEncoder,
  utterance: string,
  prototypes: SemanticPrototype[],
): Promise<SemanticMatch[]> {
  if (!utterance.trim()) throw new Error("utterance must not be empty");
  if (prototypes.length === 0) return [];
  for (const prototype of prototypes) {
    if (!prototype.id.trim()) throw new Error("prototype id must not be empty");
    if (prototype.examples.length === 0) throw new Error(`prototype ${prototype.id} must have examples`);
  }

  const flatExamples = prototypes.flatMap(p => p.examples);
  const vectors = await encoder.embed([utterance, ...flatExamples]);
  if (vectors.length !== flatExamples.length + 1) {
    throw new Error("semantic encoder returned unexpected vector count");
  }

  const query = vectors[0];
  assertVector(query, "query");
  let offset = 1;
  const matches = prototypes.map(prototype => {
    let best = -1;
    for (let i = 0; i < prototype.examples.length; i++) {
      const vector = vectors[offset++];
      const score = cosineSimilarity(query, vector);
      if (score > best) best = score;
    }
    return { prototypeId: prototype.id, score: best };
  });

  return matches.sort((a, b) => b.score - a.score || a.prototypeId.localeCompare(b.prototypeId));
}

export async function resolveSemanticPrototype(
  encoder: SemanticEncoder,
  utterance: string,
  prototypes: SemanticPrototype[],
  options: { minScore: number; minMargin: number },
): Promise<{ status: "resolved"; match: SemanticMatch } | { status: "abstain"; reason: "low-score" | "ambiguous"; matches: SemanticMatch[] }> {
  if (!Number.isFinite(options.minScore) || options.minScore < -1 || options.minScore > 1) {
    throw new Error("minScore must be within [-1,1]");
  }
  if (!Number.isFinite(options.minMargin) || options.minMargin < 0 || options.minMargin > 2) {
    throw new Error("minMargin must be within [0,2]");
  }

  const matches = await rankSemanticPrototypes(encoder, utterance, prototypes);
  if (matches.length === 0 || matches[0].score < options.minScore) {
    return { status: "abstain", reason: "low-score", matches };
  }
  if (matches.length > 1 && matches[0].score - matches[1].score < options.minMargin) {
    return { status: "abstain", reason: "ambiguous", matches };
  }
  return { status: "resolved", match: matches[0] };
}
