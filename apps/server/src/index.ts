import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { Writable } from "node:stream";
import { AuthError, type OriginPolicy } from "@crowdcircuit/auth-core";
import { createAuthRuntime, type AuthRuntime } from "./auth/index.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { attachGameSocketServer } from "./game/socket-server.js";
import { GameSessionRegistry } from "./game/registry/index.js";
import { SocketIoActionDeliveryAdapter } from "./delivery/socket-io/index.js";
import { ActionGateway, type ActionGatewayClock } from "./delivery/gateway.js";
import { SqliteDurableActionRepository } from "./persistence/repository.js";

export * from "./persistence/index.js";
export * from "./delivery/port.js";
export * from "./delivery/action-id.js";
export * from "./delivery/gateway.js";
export * from "./delivery/socket-io/index.js";
export * from "./game/index.js";
export { createAuthRuntime, type AuthRuntime } from "./auth/index.js";

const HOST = process.env["HOST"] ?? "127.0.0.1";
const PORT = Number(process.env["PORT"] ?? 3100);

function sanitizedRequestLog(request: unknown): {
  readonly method: string;
  readonly path: string;
} {
  if (typeof request !== "object" || request === null) {
    return { method: "UNKNOWN", path: "/" };
  }
  const method = Reflect.get(request, "method");
  const url = Reflect.get(request, "url");
  const path = typeof url === "string" ? url.split("?", 1)[0] ?? "/" : "/";
  return {
    method: typeof method === "string" ? method : "UNKNOWN",
    path,
  };
}

export interface BuildAppOptions {
  readonly authRuntime?: AuthRuntime;
  readonly originPolicy?: OriginPolicy;
  readonly loggerStream?: Writable;
  readonly durableDatabasePath?: string;
  readonly runtimeId?: string;
  readonly clock?: ActionGatewayClock;
  readonly actionRepositoryFactory?: (
    databasePath: string,
  ) => SqliteDurableActionRepository;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const ownsAuthRuntime = options.authRuntime === undefined;
  const clock = options.clock ?? { now: Date.now };
  const runtimeId = options.runtimeId ?? randomUUID();
  const durableDatabasePath =
    options.durableDatabasePath ??
    process.env["DATABASE_PATH"] ??
    "crowdcircuit.sqlite";
  let authRuntime: AuthRuntime | undefined;
  let repository: SqliteDurableActionRepository | undefined;
  let gameSocketRuntime: ReturnType<typeof attachGameSocketServer> | undefined;
  let authRuntimeDisposed = false;
  let repositoryClosed = false;
  const closeRepository = () => {
    if (repository === undefined || repositoryClosed) return;
    repositoryClosed = true;
    repository.close();
  };
  const disposeOwnedAuthRuntime = () => {
    if (!ownsAuthRuntime || authRuntime === undefined || authRuntimeDisposed) return;
    authRuntimeDisposed = true;
    authRuntime.dispose();
  };
  const cleanupOwnedResources = async () => {
    try {
      await gameSocketRuntime?.close();
    } finally {
      try {
        closeRepository();
      } finally {
        disposeOwnedAuthRuntime();
      }
    }
  };

  try {
    authRuntime = options.authRuntime ?? createAuthRuntime();
    repository = options.actionRepositoryFactory?.(durableDatabasePath) ??
      SqliteDurableActionRepository.open({ filename: durableDatabasePath });
    const app = Fastify({
      logger: {
        level: process.env["LOG_LEVEL"] ?? "info",
        ...(options.loggerStream === undefined
          ? {}
          : { stream: options.loggerStream }),
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "request.headers.authorization",
            "request.headers.cookie",
            "body.pairingCode",
            "body.token",
          ],
          censor: "[REDACTED]",
        },
        serializers: {
          req: sanitizedRequestLog,
        },
      },
    });
    app.addHook("onRequest", async (request) => {
      if (!request.raw.url?.startsWith("/api/v1/auth/")) return;
      let parsed: URL;
      try {
        parsed = new URL(request.raw.url, "http://127.0.0.1");
      } catch {
        throw new AuthError("QUERY_TOKEN_FORBIDDEN", "Authentication URL is invalid");
      }
      if ([...parsed.searchParams.keys()].length > 0) {
        throw new AuthError(
          "QUERY_TOKEN_FORBIDDEN",
          "Authentication query parameters are forbidden",
        );
      }
    });
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof AuthError) {
        const statusCode =
          error.code === "FORBIDDEN" || error.code === "QUERY_TOKEN_FORBIDDEN"
            ? 403
            : error.code === "CREDENTIAL_EXPIRED" ||
                error.code === "CREDENTIAL_REVOKED"
              ? 410
              : error.code === "INVALID_CONFIGURATION" ||
                  error.code === "CREDENTIAL_COLLISION" ||
                  error.code === "CAPACITY_EXCEEDED"
                ? 503
                : 401;
        return reply.code(statusCode).send({ code: error.code });
      }
      app.log.error(
        { errorName: error instanceof Error ? error.name : "UnknownError" },
        "Request failed",
      );
      return reply.code(500).send({ code: "INTERNAL_ERROR" });
    });

    const originPolicy = options.originPolicy ?? {
      allowedOrigins: new Set([
        "http://127.0.0.1:3100",
        "http://localhost:3100",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
      ]),
      allowNoOriginOnLoopback: true,
    };
    registerAuthRoutes(app, authRuntime, originPolicy);
    const registry = new GameSessionRegistry({ clock: () => clock.now() });
    repository.reconcilePreviousRuntime(runtimeId, clock.now());
    const gateway = new ActionGateway(
      repository,
      new SocketIoActionDeliveryAdapter(registry),
      clock,
      runtimeId,
    );
    gameSocketRuntime = attachGameSocketServer({
      httpServer: app.server,
      sessions: authRuntime.sessions,
      originPolicy,
      registry,
      inboundActionLifecycle: gateway,
    });
    app.addHook("preClose", async () => {
      await gameSocketRuntime?.close();
    });
    app.addHook("onClose", async () => {
      try {
        closeRepository();
      } finally {
        disposeOwnedAuthRuntime();
      }
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
  } catch (error) {
    try {
      await cleanupOwnedResources();
    } catch {
      // Startup cleanup must not replace the original construction failure.
    }
    throw error;
  }
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

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
