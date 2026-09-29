import { z } from "zod";

const Env = z.object({
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  CAPTURE_MODEL: z.string().default("claude-haiku-4-5-20251001"),
  CHECKIN_MODEL: z.string().default("claude-sonnet-5-5"),
  // Thinking effort for the check-in. "low" keeps replies fast at bedtime.
  CHECKIN_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  SUPABASE_URL: z.string().optional(),
  ALLOW_DEV_AUTH: z.string().optional().transform((v) => v === "true"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  APP_REDIRECT_URI: z.string().default("hushtick://settings"),
  // Where the web app is hosted, comma-separated, e.g. https://hushtick.app,http://localhost:8081
  WEB_APP_ORIGINS: z.string().default("http://localhost:8081").transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
});

export const env = Env.parse(process.env);
export const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI);
