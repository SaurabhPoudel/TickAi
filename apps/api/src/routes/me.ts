import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as users from "../services/users.js";
import * as nights from "../services/nights.js";
import { googleEnabled } from "../env.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", async (req) => {
    const u = req.user;
    return {
      id: u.id, name: u.name, timezone: u.timezone, bedtime: u.bedtime, voiceReplies: u.voiceReplies,
      streak: u.streak, bestStreak: u.bestStreak, graceNights: u.graceNights, fullMoons: u.fullMoons,
      moonPhase: nights.moonPhase(u.streak), lastClosedDay: u.lastClosedDay,
      calendar: { available: googleEnabled, connected: Boolean(u.googleRefreshToken) },
    };
  });

  const Patch = z.object({
    name: z.string().trim().min(1).max(40).optional(),
    timezone: z.string().refine(users.isValidTz, "Unknown time zone").optional(),
    bedtime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    voiceReplies: z.boolean().optional(),
  });
  app.patch("/me", async (req) => users.update(req.user.id, Patch.parse(req.body)));
}
