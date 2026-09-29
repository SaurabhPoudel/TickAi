import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { requireUser } from "./auth.js";
import { meRoutes } from "./routes/me.js";
import { taskRoutes } from "./routes/tasks.js";
import { pantryRoutes } from "./routes/pantry.js";
import { checkinRoutes } from "./routes/checkin.js";
import { googleRoutes } from "./routes/google.js";

const app = Fastify({ logger: { level: "info" } });
await app.register(cors, { origin: true });

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ error: "Invalid request.", issues: err.issues });
  req.log.error(err);
  const status = (err as { statusCode?: number }).statusCode ?? 500;
  reply.code(status).send({ error: status === 500 ? "Something went wrong on our side. Try again." : (err as Error).message });
});

app.get("/health", async () => ({ ok: true }));
await app.register(googleRoutes);

// Everything else requires a signed-in user.
await app.register(async (authed) => {
  authed.addHook("preHandler", requireUser);
  await authed.register(meRoutes);
  await authed.register(taskRoutes);
  await authed.register(pantryRoutes);
  await authed.register(checkinRoutes);
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
