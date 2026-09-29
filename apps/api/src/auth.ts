import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env.js";
import type { User } from "./db/schema.js";
import * as users from "./services/users.js";

declare module "fastify" {
  interface FastifyRequest { user: User }
}

const jwks = env.SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

async function userIdFrom(req: FastifyRequest): Promise<string | null> {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ") && jwks) {
    try {
      const { payload } = await jwtVerify(header.slice(7), jwks);
      return payload.sub ?? null;
    } catch { return null; }
  }
  const dev = req.headers["x-dev-user"];
  if (env.ALLOW_DEV_AUTH && typeof dev === "string" && dev) return `dev:${dev}`;
  return null;
}

export async function requireUser(req: FastifyRequest, reply: FastifyReply) {
  const id = await userIdFrom(req);
  if (!id) return reply.code(401).send({ error: "Sign in to continue." });
  const tz = req.headers["x-timezone"];
  let user = await users.getOrCreate(id, typeof tz === "string" ? tz : undefined);
  // Follow the phone's time zone when the user travels.
  if (typeof tz === "string" && tz !== user.timezone && users.isValidTz(tz)) user = await users.update(id, { timezone: tz });
  req.user = user;
}
