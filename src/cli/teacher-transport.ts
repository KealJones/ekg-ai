import { execSync, spawnSync } from "node:child_process";

export interface TeacherResponse {
  answer: string;
  confidence: number;
  provider: string;
}

export interface TeacherBlueprint {
  id: string;
  description: string;
  inputs: Array<{kind: string; item?: {kind: string}}>;
  output: {kind: string; item?: {kind: string}};
  body: any;
  phrases?: string[];
}

export interface TeacherLesson {
  answer: string;
  groundings: Array<{form: string; relation: string; definition?: string; impliedValue?: number; questionFor?: string}>;
  capabilityMappings: Array<{form: string; capabilityId: string; relation: string; definition?: string}>;
  blueprints: Array<TeacherBlueprint>;
  facts: Array<{subject: string; predicate: string; object: string}>;
  synonyms: Array<{newForm: string; knownForm: string}>;
}

export type TeacherProvider = "claude" | "chatgpt" | "auto";

interface ProviderConfig {
  name: string;
  check: string;
  run: (prompt: string) => string | undefined;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  claude: {
    name: "Claude (claude -p)",
    check: "claude",
    run: (prompt) => {
      const r = spawnSync("claude", ["-p", "--model", "haiku"], { input: prompt, encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] });
      return r.status === 0 && r.stdout ? r.stdout.trim() : undefined;
    },
  },
  chatgpt: {
    name: "ChatGPT (chatgpt)",
    check: "chatgpt",
    run: (prompt) => {
      const r = spawnSync("chatgpt", ["-n", prompt], { encoding: "utf8", timeout: 60000, stdio: ["pipe", "pipe", "pipe"] });
      return r.status === 0 && r.stdout ? r.stdout.trim() : undefined;
    },
  },
};

let cachedProvider: string | undefined;

function findAvailableProvider(preferred?: TeacherProvider): ProviderConfig | undefined {
  if (preferred && preferred !== "auto" && PROVIDERS[preferred]) {
    try {
      execSync(`which ${PROVIDERS[preferred]!.check}`, { stdio: ["pipe", "pipe", "pipe"] });
      return PROVIDERS[preferred];
    } catch { return undefined; }
  }
  if (cachedProvider) return PROVIDERS[cachedProvider];
  for (const [key, config] of Object.entries(PROVIDERS)) {
    try {
      execSync(`which ${config.check}`, { stdio: ["pipe", "pipe", "pipe"] });
      cachedProvider = key;
      return config;
    } catch { continue; }
  }
  return undefined;
}

export function askTeacher(utterance: string, context?: string, provider?: TeacherProvider): TeacherResponse | undefined {
  const config = findAvailableProvider(provider ?? (process.env.EKG_TEACHER as TeacherProvider | undefined) ?? "auto");
  if (!config) return undefined;

  const prompt = context
    ? `Answer concisely (1-2 sentences, no markdown): ${utterance}\nContext: ${context}`
    : `Answer concisely (1-2 sentences, no markdown): ${utterance}`;

  const result = config.run(prompt);
  if (!result) return undefined;
  return { answer: result, confidence: 0.7, provider: config.name };
}

export function isTeacherAvailable(provider?: TeacherProvider): boolean {
  return !!findAvailableProvider(provider ?? (process.env.EKG_TEACHER as TeacherProvider | undefined) ?? "auto");
}

export function teacherProviderName(provider?: TeacherProvider): string {
  return findAvailableProvider(provider ?? "auto")?.name ?? "none";
}

export function askTeacherStructured(utterance: string, capabilitySummary: string, knownRelations: string[], provider?: TeacherProvider): TeacherLesson | undefined {
  const config = findAvailableProvider(provider ?? (process.env.EKG_TEACHER as TeacherProvider | undefined) ?? "auto");
  if (!config) return undefined;

  const prompt = `You are a Teacher for EKG, a learning AI that builds up knowledge over time. Your job is to teach it, not just answer. After you respond, EKG will retry the utterance with whatever you taught it. If it still can't handle it, you'll be called again. So teach incrementally - each response should add one useful piece of knowledge.

USER SAID: "${utterance}"

PRIORITY: Teach EKG to handle this ITSELF using its capabilities. A direct answer is a fallback, not the goal.

EKG's capabilities (use EXACT IDs):
${capabilitySummary}

EKG's known relations: ${knownRelations.slice(0, 40).join(", ")}

Respond with ONLY valid JSON (no markdown, no backticks):
{
  "answer": "direct answer if EKG can't possibly handle this itself",
  "groundings": [{"form": "word", "relation": "Relation", "definition": "meaning"}],
  "capabilityMappings": [{"form": "word", "capabilityId": "exact.id.from.list", "relation": "NewRelation", "definition": "what it does"}],
  "blueprints": [{"id": "learned.name", "description": "what it does", "inputs": [{"kind": "int"}], "output": {"kind": "string"}, "body": {"kind": "call", "capabilityId": "core.int_to_string", "args": [{"kind": "input", "index": 0, "type": {"kind": "int"}}], "type": {"kind": "string"}}, "phrases": ["trigger phrase"]}],
  "facts": [{"subject": "entity", "predicate": "predicate", "object": "value"}],
  "synonyms": [{"newForm": "new", "knownForm": "known"}]
}

Teaching priority (most to least valuable):
1. capabilityMappings - if a word maps to ONE existing capability, teach that
2. blueprints - if the task needs COMPOSING capabilities, build a program
3. groundings - teach unknown word meanings
4. facts - ONLY timeless knowledge (never current time/date/weather)
5. synonyms - link unknown words to known words
6. answer - only when nothing above applies (pure knowledge questions)

CRITICAL: Use ONLY capability IDs from the list above. Never invent IDs.`;

  const result = config.run(prompt);
  if (!result) return undefined;

  try {
    const cleaned = result.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as TeacherLesson;
    if (typeof parsed.answer !== "string") return undefined;
    parsed.groundings = Array.isArray(parsed.groundings) ? parsed.groundings.filter(g => typeof g.form === "string" && typeof g.relation === "string") : [];
    parsed.capabilityMappings = Array.isArray(parsed.capabilityMappings) ? parsed.capabilityMappings.filter(m => typeof m.form === "string" && typeof m.capabilityId === "string" && typeof m.relation === "string") : [];
    parsed.blueprints = Array.isArray(parsed.blueprints) ? parsed.blueprints.filter(b => typeof b.id === "string" && b.body && Array.isArray(b.inputs) && b.output) : [];
    parsed.facts = Array.isArray(parsed.facts) ? parsed.facts.filter(f => typeof f.subject === "string" && typeof f.predicate === "string" && typeof f.object === "string") : [];
    parsed.synonyms = Array.isArray(parsed.synonyms) ? parsed.synonyms.filter(s => typeof s.newForm === "string" && typeof s.knownForm === "string") : [];
    return parsed;
  } catch {
    return { answer: result, groundings: [], capabilityMappings: [], blueprints: [], facts: [], synonyms: [] };
  }
}
