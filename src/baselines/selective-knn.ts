import { riskCoverageCurve, type RiskCoveragePoint, type SelectivePrediction } from "../benchmarks/selective-evaluation.js";

export interface KnnExample<T> {
  surface: string;
  value: T;
}

export interface KnnMatch<T> {
  value: T;
  surface: string;
  similarity: number;
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}

export function tokenJaccard(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 && B.size === 0) return 1;
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : intersection / union;
}

export class SelectiveKnn<T> {
  constructor(private readonly examples: readonly KnnExample<T>[]) {}

  nearest(surface: string): KnnMatch<T> | undefined {
    let best: KnnMatch<T> | undefined;
    for (const example of this.examples) {
      const similarity = tokenJaccard(example.surface, surface);
      if (!best || similarity > best.similarity) {
        best = { value: example.value, surface: example.surface, similarity };
      }
    }
    return best;
  }

  predict(surface: string, threshold: number): KnnMatch<T> | undefined {
    if (threshold < 0 || threshold > 1) throw new Error("threshold must be within [0,1]");
    const match = this.nearest(surface);
    return match && match.similarity >= threshold ? match : undefined;
  }

  curve(items: readonly { surface: string; correct: (value: T) => boolean }[]): RiskCoveragePoint[] {
    const predictions: SelectivePrediction<string>[] = items.map(item => {
      const match = this.nearest(item.surface);
      return {
        item: item.surface,
        confidence: match?.similarity ?? 0,
        correct: match ? item.correct(match.value) : false,
      };
    });
    return riskCoverageCurve(predictions);
  }
}
