import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { captureTasks } from "../ai/capture.js";
import { addDays, localClock, logicalToday } from "../lib/days.js";
import * as tasks from "../services/tasks.js";
import * as calendar from "../services/calendar.js";

export async function taskRoutes(app: FastifyInstance) {
  /** Today + tomorrow, plus anything already on the Google calendar. */
  app.get("/days/today", async (req) => {
    const u = req.user;
    const day = logicalToday(u.timezone);
    const [today, tomorrow, events] = await Promise.all([
      tasks.forDay(u.id, day),
      tasks.forDay(u.id, addDays(day, 1)),
      calendar.dayEvents(u, day).catch(() => []),
    ]);
    return { day, clock: localClock(u.timezone), bedtime: u.bedtime, today, tomorrow, events };
  });

  app.get<{ Params: { day: string } }>("/days/:day", async (req) => {
    return { day: req.params.day, tasks: await tasks.forDay(req.user.id, req.params.day) };
  });

  /** The voice brain dump: free text in, structured tasks out. */
  app.post("/capture", async (req) => {
    const { text } = z.object({ text: z.string().trim().min(1).max(2000) }).parse(req.body);
    const u = req.user;
    const clock = localClock(u.timezone);
    const result = await captureTasks(text, {
      today: logicalToday(u.timezone), time: clock.time, timezone: u.timezone, bedtime: u.bedtime,
    });
    const created = await tasks.createFromDrafts(u, result.tasks);
    return { created, followUp: result.followUp ?? null };
  });

  const Patch = z.object({
    title: z.string().trim().min(1).optional(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    durationMin: z.number().int().positive().nullable().optional(),
    status: z.enum(["open", "done", "dropped"]).optional(),
    notes: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  });
  app.patch<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    const t = await tasks.update(req.user, req.params.id, Patch.parse(req.body));
    return t ?? reply.code(404).send({ error: "Task not found." });
  });

  app.delete<{ Params: { id: string } }>("/tasks/:id", async (req, reply) => {
    return (await tasks.remove(req.user, req.params.id)) ? { ok: true } : reply.code(404).send({ error: "Task not found." });
  });

  app.post<{ Params: { id: string } }>("/tasks/:id/items", async (req, reply) => {
    const body = z.object({ name: z.string().trim().min(1), qty: z.number().nullish(), unit: z.string().nullish() }).parse(req.body);
    return (await tasks.addItem(req.user.id, req.params.id, body)) ?? reply.code(404).send({ error: "Task not found." });
  });

  app.patch<{ Params: { id: string } }>("/items/:id", async (req, reply) => {
    const { checked } = z.object({ checked: z.boolean() }).parse(req.body);
    return (await tasks.setItem(req.user.id, req.params.id, checked)) ?? reply.code(404).send({ error: "Item not found." });
  });
}
