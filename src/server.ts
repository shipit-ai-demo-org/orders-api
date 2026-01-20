import Fastify from "fastify";
import healthRoutes from "./routes/health";
import orderRoutes from "./routes/orders";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

app.register(healthRoutes);
app.register(orderRoutes, { prefix: "/v1" });

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`orders-api listening on :${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
