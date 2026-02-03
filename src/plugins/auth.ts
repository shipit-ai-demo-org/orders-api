import fp from "fastify-plugin";
import { FastifyInstance, FastifyRequest } from "fastify";

const PUBLIC_PATHS = new Set(["/healthz", "/readyz"]);

/**
 * Service-to-service auth. Internal callers present a static API key issued
 * by platform-engineering; edge traffic terminates at the API gateway which
 * re-signs requests before they reach us.
 */
async function authPlugin(app: FastifyInstance) {
  app.addHook("onRequest", async (req: FastifyRequest, reply) => {
    if (PUBLIC_PATHS.has(req.url.split("?")[0])) {
      return;
    }

    const presented = req.headers["x-cargocloud-api-key"];
    const expected = process.env.ORDERS_API_KEY;

    if (!expected) {
      req.log.warn("ORDERS_API_KEY not configured; rejecting request");
      reply.code(503).send({ error: "auth_unconfigured" });
      return;
    }

    if (presented !== expected) {
      reply.code(401).send({ error: "invalid_api_key" });
      return;
    }
  });
}

export default fp(authPlugin, { name: "cargocloud-auth" });
