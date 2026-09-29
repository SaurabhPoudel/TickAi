import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as pantry from "../services/pantry.js";
import * as tasks from "../services/tasks.js";
import { logicalToday } from "../lib/days.js";

export async function pantryRoutes(app: FastifyInstance) {
  app.get("/pantry", async (req) => ({ items: await pantry.list(req.user.id) }));
  app.get("/pantry/suggestions", async (req) => ({ items: await pantry.suggestions(req.user.id) }));
  app.post("/pantry/purchases", async (req) => {
    const body = z.object({ name: z.string().trim().min(1), qty: z.number().nullish(), unit: z.string().nullish() }).parse(req.body);
    return pantry.recordPurchase(req.user.id, body);
  });
  app.post("/shopping/add", async (req) => {
    const body = z.object({ name: z.string().trim().min(1), qty: z.number().nullish(), unit: z.string().nullish() }).parse(req.body);
    return tasks.addToNextList(req.user, logicalToday(req.user.timezone), body);
  });
}
