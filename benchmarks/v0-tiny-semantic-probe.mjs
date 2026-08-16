import { pipeline } from "@huggingface/transformers";
import { rankSemanticPrototypes } from "../dist/index.js";

const MODEL = process.env.EKG_SEMANTIC_MODEL || "Xenova/all-MiniLM-L6-v2";
const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });

const encoder = {
  id: MODEL,
  async embed(texts) {
    const output = await extractor(texts, { pooling: "mean", normalize: true });
    return output.tolist();
  },
};

const prototypes = [
  { id: "argmax.filename_length", examples: ["find the file with the longest filename", "choose the file whose name has the most characters"] },
  { id: "argmin.filename_length", examples: ["find the file with the shortest filename", "choose the file whose name has the fewest characters"] },
  { id: "multiply", examples: ["multiply this number by a factor", "take the number times another number"] },
  { id: "add", examples: ["add an amount to this number", "increase the number by an amount"] },
];

const probes = [
  ["which file has the most letters in its name?", "argmax.filename_length"],
  ["give me the least lengthy file name", "argmin.filename_length"],
  ["make the input six times as large", "multiply"],
  ["bump this number up by three", "add"],
  ["find the biggest file by bytes", null],
  ["tell me tomorrow's weather", null],
];

function tokenize(s) {
  return new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean));
}
function jaccard(a, b) {
  const A = tokenize(a), B = tokenize(b);
  let intersection = 0;
  for (const token of A) if (B.has(token)) intersection++;
  const union = new Set([...A, ...B]).size;
  return union ? intersection / union : 0;
}
function lexicalRank(utterance) {
  return prototypes.map(p => ({
    prototypeId: p.id,
    score: Math.max(...p.examples.map(e => jaccard(utterance, e))),
  })).sort((a,b) => b.score - a.score || a.prototypeId.localeCompare(b.prototypeId));
}

const rows = [];
for (const [utterance, expected] of probes) {
  const semantic = await rankSemanticPrototypes(encoder, utterance, prototypes);
  const lexical = lexicalRank(utterance);
  rows.push({
    utterance,
    expected,
    semanticTop: semantic[0],
    semanticMargin: semantic[0].score - semantic[1].score,
    lexicalTop: lexical[0],
    lexicalMargin: lexical[0].score - lexical[1].score,
    semanticCorrect: expected === null ? null : semantic[0].prototypeId === expected,
    lexicalCorrect: expected === null ? null : lexical[0].prototypeId === expected,
  });
}

const answerable = rows.filter(r => r.expected !== null);
const report = {
  status: "EXPLORATORY_ONLY_NOT_V0.3_EVIDENCE",
  model: MODEL,
  architectureRole: "semantic signal provider only; no planning, composition, or Blueprint synthesis",
  prototypes: prototypes.length,
  probes: rows.length,
  semanticTop1: answerable.filter(r => r.semanticCorrect).length / answerable.length,
  lexicalTop1: answerable.filter(r => r.lexicalCorrect).length / answerable.length,
  rows,
};
console.log(JSON.stringify(report, null, 2));
