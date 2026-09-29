import type { FastifyInstance } from "fastify";
import { requireUser } from "../auth.js";
import { env } from "../env.js";
import * as calendar from "../services/calendar.js";

export async function googleRoutes(app: FastifyInstance) {
  // The app opens this URL in a browser, so it needs the user.
  app.get<{ Querystring: { redirect?: string } }>("/google/connect", { preHandler: requireUser }, async (req) => ({
    url: await calendar.connectUrl(req.user.id, req.query.redirect),
  }));

  // Google redirects here; the signed state tells us who it was.
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>("/google/callback", async (req, reply) => {
    const { code, state, error } = req.query;
    const back = state ? (await calendar.readState(state).catch(() => null))?.back ?? env.APP_REDIRECT_URI : env.APP_REDIRECT_URI;
    const to = (status: string) => `${back}${back.includes("?") ? "&" : "?"}calendar=${status}`;
    if (error || !code || !state) return reply.redirect(to("cancelled"));
    try {
      await calendar.finishConnect(code, state);
      return reply.redirect(to("connected"));
    } catch (err) {
      req.log.error(err);
      return reply.redirect(to("failed"));
    }
  });
}
