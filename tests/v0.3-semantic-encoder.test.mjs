import test from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  rankSemanticPrototypes,
  resolveSemanticPrototype,
} from "../dist/index.js";

class MapEncoder {
  id = "test-map";
  constructor(vectors) { this.vectors = vectors; }
  async embed(texts) {
    return texts.map(text => {
      const v = this.vectors[text];
      if (!v) throw new Error(`missing test embedding for ${text}`);
      return v;
    });
  }
}

const prototypes = [
  { id: "argmax.filename_length", examples: ["longest filename", "name with most characters"] },
  { id: "argmin.filename_length", examples: ["shortest filename", "name with fewest characters"] },
];

test("semantic prototype layer can resolve a paraphrase without doing planning", async () => {
  const encoder = new MapEncoder({
    "which file has the most letters in its name": [1, 0],
    "longest filename": [0.98, 0.02],
    "name with most characters": [1, 0],
    "shortest filename": [0, 1],
    "name with fewest characters": [0.03, 0.97],
  });
  const result = await resolveSemanticPrototype(
    encoder,
    "which file has the most letters in its name",
    prototypes,
    { minScore: 0.7, minMargin: 0.1 },
  );
  assert.equal(result.status, "resolved");
  assert.equal(result.match.prototypeId, "argmax.filename_length");
});

test("semantic prototype layer MUST abstain when two meanings are too close", async () => {
  const encoder = new MapEncoder({
    "find the extreme filename": [0.7, 0.7],
    "longest filename": [1, 0],
    "name with most characters": [1, 0],
    "shortest filename": [0, 1],
    "name with fewest characters": [0, 1],
  });
  const result = await resolveSemanticPrototype(
    encoder,
    "find the extreme filename",
    prototypes,
    { minScore: 0.6, minMargin: 0.1 },
  );
  assert.equal(result.status, "abstain");
  assert.equal(result.reason, "ambiguous");
});

test("semantic prototype layer MUST abstain on unrelated language instead of inventing intent", async () => {
  const encoder = new MapEncoder({
    "make me a sandwich": [-1, -1],
    "longest filename": [1, 0],
    "name with most characters": [1, 0],
    "shortest filename": [0, 1],
    "name with fewest characters": [0, 1],
  });
  const result = await resolveSemanticPrototype(
    encoder,
    "make me a sandwich",
    prototypes,
    { minScore: 0.5, minMargin: 0.1 },
  );
  assert.equal(result.status, "abstain");
  assert.equal(result.reason, "low-score");
});

test("cosine similarity rejects malformed vectors", () => {
  assert.throws(() => cosineSimilarity([1, 2], [1]), /dimensions/);
  assert.throws(() => cosineSimilarity([], []), /must not be empty/);
  assert.throws(() => cosineSimilarity([Number.NaN], [1]), /finite/);
});

test("semantic encoder returning wrong cardinality is rejected", async () => {
  const encoder = { id: "broken", async embed() { return [[1, 0]]; } };
  await assert.rejects(
    () => rankSemanticPrototypes(encoder, "x", prototypes),
    /unexpected vector count/,
  );
});
