import Fastify from "fastify";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

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
