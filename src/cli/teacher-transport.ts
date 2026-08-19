import { execSync, spawnSync } from "node:child_process";

export interface TeacherResponse {
  answer: string;
  confidence: number;
  provider: string;
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
