import { execSync } from "node:child_process";

export interface TeacherResponse {
  answer: string;
  confidence: number;
}

const TEACHER_SYSTEM = `You are a Teacher for EKG, a learning AI system. When the user asks something EKG can't handle, provide a direct, concise answer. Keep responses short - one or two sentences max. No markdown, no formatting, just the answer.`;

export function askTeacher(utterance: string, context?: string): TeacherResponse | undefined {
  try {
    const prompt = context
      ? `The user said: "${utterance}"\nContext: ${context}\nProvide a direct answer.`
      : `The user said: "${utterance}"\nProvide a direct answer.`;

    const result = execSync(
      `claude -p --model haiku "${prompt.replace(/"/g, '\\"')}"`,
      { encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!result) return undefined;
    return { answer: result, confidence: 0.7 };
  } catch {
    return undefined;
  }
}

export function isTeacherAvailable(): boolean {
  try {
    execSync("which claude", { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
    return true;
  } catch {
    return false;
  }
}
