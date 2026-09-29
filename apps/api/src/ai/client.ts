import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { env } from "../env.js";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

type Msg = { role: "user" | "assistant"; content: string };
type Effort = "low" | "medium" | "high";

/**
 * Asks Claude for JSON matching `schema` (structured outputs) and returns it parsed.
 * Structured outputs work on every current model; forced tool calls don't (Sonnet 5.5 rejects them).
 */
export async function callStructured<T extends z.ZodType>(opts: {
  model: string;
  system: string;
  messages: Msg[];
  schema: T;
  maxTokens?: number;
  /** Thinking effort. Ignored on Haiku 4.5, which doesn't accept it. */
  effort?: Effort;
}): Promise<z.infer<T>> {
  // The API needs the conversation to start with the user. The check-in starts with Hushtick speaking.
  const messages: Msg[] = opts.messages[0]?.role === "assistant"
    ? [{ role: "user", content: "(I opened the bedtime check-in.)" }, ...opts.messages]
    : opts.messages;
  const useEffort = opts.effort && !opts.model.startsWith("claude-haiku");

  const request = () => anthropic.messages.parse({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages,
    output_config: { format: zodOutputFormat(opts.schema), ...(useEffort ? { effort: opts.effort } : {}) },
  });

  // Enums and patterns are checked by zod after the response arrives, so a rare bad value gets one retry.
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await request();
      if (res.stop_reason === "refusal") throw new Error("Claude declined this request");
      if (res.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (max_tokens)");
      if (res.parsed_output == null) throw new Error("Claude didn't return structured output");
      return res.parsed_output as z.infer<T>;
    } catch (err) {
      if (attempt >= 2 || err instanceof Anthropic.APIError) throw err;
    }
  }
}
