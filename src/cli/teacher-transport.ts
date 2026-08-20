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

export function askTeacherStructured(utterance: string, capabilitySummary: string, knownRelations: string[], existingPrograms?: string[], provider?: TeacherProvider): TeacherLesson | undefined {
  const config = findAvailableProvider(provider ?? (process.env.EKG_TEACHER as TeacherProvider | undefined) ?? "auto");
  if (!config) return undefined;

  const prompt = `You are a Teacher for EKG-AI, a learning system that accumulates knowledge in a graph. EKG has typed host capabilities it can call, and learns by storing word meanings, capability mappings, and executable programs (Blueprints) in its graph. Your job is to TEACH it to handle things itself, not just answer questions.

After you respond, EKG will learn what you taught and RETRY the utterance. If it still fails, you'll be called again. Teach one useful thing per round.

USER SAID: "${utterance}"
${existingPrograms && existingPrograms.length > 0 ? `
EKG ALREADY HAS THESE LEARNED PROGRAMS (do NOT re-teach these, use them instead):
${existingPrograms.join("\n")}
` : ""}
EKG'S CAPABILITIES (use EXACT IDs only):
${capabilitySummary}

KNOWN RELATIONS: ${knownRelations.slice(0, 40).join(", ")}

Respond with ONLY valid JSON (no markdown, no backticks, no extra text):
{
  "answer": "direct answer (fallback only - teaching is preferred)",
  "groundings": [{"form": "word", "relation": "Relation", "definition": "meaning"}],
  "capabilityMappings": [{"form": "trigger_word", "capabilityId": "exact.cap.id", "relation": "RelationName", "definition": "what it does"}],
  "blueprints": [<see format below>],
  "facts": [{"subject": "entity", "predicate": "relation", "object": "value"}],
  "synonyms": [{"newForm": "new_word", "knownForm": "known_word"}]
}

BLUEPRINT FORMAT - executable programs that compose capabilities:
{
  "id": "learned.readable_time",
  "description": "Get current time in human readable format",
  "inputs": [],
  "output": {"kind": "json"},
  "body": {
    "kind": "call", "capabilityId": "host.bash",
    "args": [{"kind": "const", "value": "date '+%Y-%m-%d %H:%M:%S'", "type": {"kind": "string"}}],
    "type": {"kind": "json"}
  },
  "phrases": ["what time is it", "current time", "time now"]
}

Expression types in body:
- {"kind":"call","capabilityId":"exact.id","args":[...],"type":{"kind":"int"}} - call a capability
- {"kind":"input","index":0,"type":{"kind":"int"}} - runtime input parameter
- {"kind":"const","value":42,"type":{"kind":"int"}} - constant value
- Nest calls to compose: call(capA, call(capB, input(0))) runs capB first, feeds result to capA

Types: {"kind":"int"}, {"kind":"string"}, {"kind":"bool"}, {"kind":"json"}, {"kind":"list","item":{"kind":"string"}}

host.bash(command) returns json with stdout/stderr/exitCode - use it for anything the typed capabilities can't do directly (formatting, system commands, file operations, etc).

TEACHING PRIORITY:
1. blueprints - if the task needs composing capabilities or running commands
2. capabilityMappings - if ONE word maps directly to ONE capability
3. groundings - teach word meanings for the lexicon
4. facts - ONLY timeless knowledge (NEVER current time/date/weather/prices)
5. answer - ONLY when EKG genuinely cannot handle this with its capabilities

CRITICAL: Use ONLY capability IDs from the list. Never invent IDs. All arrays can be empty.`;

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
