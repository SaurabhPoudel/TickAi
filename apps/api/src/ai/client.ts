import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { env } from "../env.js";

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Asks Claude to answer by calling exactly one tool, then validates the tool input.
 * Using a forced tool call gives us structured output without parsing prose.
 */
export async function callTool<T>(opts: {
  model: string;
  system: string;
  messages: Msg[];
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  schema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<T> {
  const res = await anthropic.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    messages: opts.messages,
    tools: [opts.tool as Anthropic.Tool],
    tool_choice: { type: "tool", name: opts.tool.name },
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Claude didn't return structured output");
  return opts.schema.parse(block.input);
}
