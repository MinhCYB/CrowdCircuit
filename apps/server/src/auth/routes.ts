import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  AuthError,
  authorizeOrigin,
  authorizeSession,
  type OriginPolicy,
  type PairableClientRole,
} from "@crowdcircuit/auth-core";
import type { AuthRuntime } from "./index.js";

const PairRequestSchema = z
  .object({
    pairingCode: z.string().min(1).max(256),
    clientRole: z.enum(["game", "voice-output"]),
    clientId: z.string().min(1).max(128),
  })
  .strict();

const PairingCodeRequestSchema = z
  .object({
    clientRole: z.enum(["game", "voice-output"]),
    clientId: z.string().min(1).max(128),
  })
  .strict();

const isLoopback = (ip: string): boolean =>
  ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

function origin(request: FastifyRequest): string | undefined {
  const value = request.headers.origin;
  return Array.isArray(value) ? value[0] : value;
}

function cookie(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (header === undefined) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value.length === 0 ? undefined : value;
    }
  }
  return undefined;
}

function requireLoopback(request: FastifyRequest): void {
  if (!isLoopback(request.ip)) {
    throw new AuthError("FORBIDDEN", "Request is not authorized");
  }
}

function authorizeRequestOrigin(request: FastifyRequest, policy: OriginPolicy): void {
  authorizeOrigin(
    origin(request),
    isLoopback(request.ip) ? "127.0.0.1" : "invalid",
    policy,
  );
}

function requireAdmin(
  request: FastifyRequest,
  runtime: AuthRuntime,
  policy: OriginPolicy,
): void {
  requireLoopback(request);
  const requestOrigin = origin(request);
  if (requestOrigin === undefined) {
    throw new AuthError("FORBIDDEN", "Origin is required");
  }
  authorizeOrigin(requestOrigin, "127.0.0.1", policy);
  authorizeSession(runtime.sessions, {
    token: cookie(request, "cc_admin"),
    role: "admin",
  });
}

export function registerAuthRoutes(
  app: FastifyInstance,
  runtime: AuthRuntime,
  policy: OriginPolicy,
): void {
  app.post("/api/v1/auth/admin-session", async (request, reply) => {
    requireLoopback(request);
    authorizeRequestOrigin(request, policy);
    const session = runtime.sessions.issueOrReuse("admin", "dashboard");
    reply.header(
      "set-cookie",
      `cc_admin=${session.token}; HttpOnly; SameSite=Strict; Path=/api/v1`,
    );
    return {
      role: session.role,
      expiresAt: session.expiresAt,
      fingerprint: session.fingerprint,
    };
  });

  app.post("/api/v1/auth/pairing-codes", async (request, reply) => {
    requireAdmin(request, runtime, policy);
    const parsed = PairingCodeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    const credential = runtime.pairingCodes.create({
      role: parsed.data.clientRole,
      clientId: parsed.data.clientId,
    });
    return {
      pairingCode: credential.code,
      expiresAt: credential.expiresAt,
      clientRole: parsed.data.clientRole,
      clientId: parsed.data.clientId,
    };
  });

  app.post("/api/v1/auth/pair", async (request, reply) => {
    requireLoopback(request);
    authorizeRequestOrigin(request, policy);
    const parsed = PairRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ code: "INVALID_REQUEST" });
    }
    const role: PairableClientRole = parsed.data.clientRole;
    const session = runtime.pairingCodes.redeem(
      parsed.data.pairingCode,
      role,
      parsed.data.clientId,
      () => runtime.sessions.issue(role, parsed.data.clientId),
    );
    return {
      token: session.token,
      role: session.role,
      clientId: session.clientId,
      expiresAt: session.expiresAt,
      fingerprint: session.fingerprint,
    };
  });

  app.delete<{ Params: { clientId: string } }>(
    "/api/v1/auth/clients/:clientId",
    async (request) => {
      requireAdmin(request, runtime, policy);
      return {
        clientId: request.params.clientId,
        revoked: runtime.sessions.revokeClient(request.params.clientId),
      };
    },
  );
}
