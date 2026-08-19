import { execSync, spawnSync } from "node:child_process";

export interface TeacherResponse {
  answer: string;
  confidence: number;
  provider: string;
}

export interface TeacherLesson {
  answer: string;
  groundings: Array<{form: string; relation: string; definition?: string; impliedValue?: number; questionFor?: string}>;
  capabilityMappings: Array<{form: string; capabilityId: string; relation: string; definition?: string}>;
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
      const r = spawnSync("claude", ["-p", "--model", "haiku"], { input: prompt, encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
      return r.status === 0 ? r.stdout?.trim() : undefined;
    },
  },
  chatgpt: {
    name: "ChatGPT (chatgpt)",
    check: "chatgpt",
    run: (prompt) => {
      const r = spawnSync("chatgpt", ["-n", prompt], { encoding: "utf8", timeout: 30000, stdio: ["pipe", "pipe", "pipe"] });
      return r.status === 0 ? r.stdout?.trim() : undefined;
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

  const prompt = `You are a Teacher for EKG, a learning AI. A user said something EKG can't handle yet.

USER UTTERANCE: "${utterance}"

EKG's known semantic relations (maps words to operations):
${knownRelations.slice(0, 40).join(", ")}

EKG's executable host capabilities (these EXIST and CAN be called):
${capabilitySummary}

Respond with ONLY valid JSON (no markdown, no backticks, no explanation):
{
  "answer": "direct answer to the user (1-2 sentences)",
  "groundings": [{"form": "word", "relation": "ExistingRelation", "definition": "meaning"}],
  "capabilityMappings": [{"form": "word", "capabilityId": "host.capability_id", "relation": "NewRelation", "definition": "meaning"}],
  "facts": [{"subject": "entity", "predicate": "relation", "object": "value"}],
  "synonyms": [{"newForm": "unknown_word", "knownForm": "known_word"}]
}

Rules:
- "groundings": teach word meanings using EXISTING relations from the list above.
- "capabilityMappings": map words to executable capabilities. Use EXACT capability IDs from the list above. This teaches EKG to CALL a capability, not store a static fact. Example: {"form":"time","capabilityId":"host.unix_time_seconds","relation":"CurrentTime","definition":"get current unix timestamp"}.
- "facts": ONLY for timeless world knowledge (like "Paris is_a city"). NEVER use facts for dynamic/changing values like current time, date, or weather.
- "synonyms": link unknown words to known words.
- All arrays can be empty. Keep lessons minimal.
- If EKG has a host capability that can answer the question, use capabilityMappings to teach EKG to call it, then provide the answer too.`;

  const result = config.run(prompt);
  if (!result) return undefined;

  try {
    const cleaned = result.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as TeacherLesson;
    if (typeof parsed.answer !== "string") return undefined;
    parsed.groundings = Array.isArray(parsed.groundings) ? parsed.groundings.filter(g => typeof g.form === "string" && typeof g.relation === "string") : [];
    parsed.capabilityMappings = Array.isArray(parsed.capabilityMappings) ? parsed.capabilityMappings.filter(m => typeof m.form === "string" && typeof m.capabilityId === "string" && typeof m.relation === "string") : [];
    parsed.facts = Array.isArray(parsed.facts) ? parsed.facts.filter(f => typeof f.subject === "string" && typeof f.predicate === "string" && typeof f.object === "string") : [];
    parsed.synonyms = Array.isArray(parsed.synonyms) ? parsed.synonyms.filter(s => typeof s.newForm === "string" && typeof s.knownForm === "string") : [];
    return parsed;
  } catch {
    return { answer: result, groundings: [], capabilityMappings: [], facts: [], synonyms: [] };
  }
}
