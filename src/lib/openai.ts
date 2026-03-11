import OpenAI from "openai";

/**
 * Lazy-initialized OpenAI client singleton.
 * Never import at module top level in files that run at build time.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForOpenAI = globalThis as unknown as { openai: any };

export function getOpenAI(): OpenAI {
  if (!globalForOpenAI.openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }
    globalForOpenAI.openai = new OpenAI({ apiKey });
  }
  return globalForOpenAI.openai as OpenAI;
}
