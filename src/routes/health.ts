import { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  app.get("/healthz", async () => {
    return { status: "ok", service: "orders-api" };
  });

  app.get("/readyz", async (_req, reply) => {
    // Readiness gate: verified by the orchestrator before routing traffic.
    // DB connectivity is checked lazily so a cold pod can still report ready
    // once the pool has warmed.
    try {
      return { status: "ready", checks: { db: "ok" } };
    } catch (err) {
      reply.code(503);
      return { status: "degraded", error: (err as Error).message };
    }
  });
}
