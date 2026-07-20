import Fastify from "fastify";

const HOST = process.env["HOST"] ?? "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? 3100);

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env["LOG_LEVEL"] ?? "info",
    },
  });

  app.get("/api/v1/health", async (_request, _reply) => {
    return {
      status: "ok",
      product: "CrowdCircuit",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ host: HOST, port: PORT });
    app.log.info(`CrowdCircuit server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
