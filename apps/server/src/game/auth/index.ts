import {
  AuthError,
  authorizeOrigin,
  authorizeSession,
  type OriginPolicy,
  type RoleSessionRegistry,
} from "@crowdcircuit/auth-core";
import type { GameProtocolErrorCode } from "@crowdcircuit/contracts";

export const MAX_GAME_TOKEN_LENGTH = 256;

export interface GameHandshake {
  readonly auth: unknown;
  readonly query: Readonly<Record<string, unknown>>;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly address: string;
}

export interface AuthenticatedGameConnection {
  readonly clientId: string;
  readonly authenticatedAt: number;
  readonly expiresAt: number;
  readonly fingerprint: string;
}

export class GameAuthenticationError extends Error {
  constructor(
    readonly code: GameProtocolErrorCode,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "GameAuthenticationError";
  }
}

const AUTH_RETRYABILITY: Readonly<Record<GameProtocolErrorCode, boolean>> = {
  AUTH_REQUIRED: false,
  AUTH_INVALID: false,
  AUTH_EXPIRED: false,
  AUTH_REVOKED: false,
  AUTH_FORBIDDEN: false,
  QUERY_TOKEN_FORBIDDEN: false,
  ORIGIN_FORBIDDEN: false,
  REGISTRATION_REQUIRED: true,
  REGISTRATION_TIMEOUT: true,
  INVALID_REGISTRATION: true,
  UNSUPPORTED_PROTOCOL: false,
  UNSUPPORTED_SDK: false,
  GAME_NOT_FOUND: false,
  ALREADY_REGISTERED: false,
  INSTANCE_OWNED_BY_OTHER_CLIENT: false,
  SESSION_CAPACITY: true,
  INVALID_MESSAGE: true,
  RATE_LIMITED: true,
  SESSION_STALE: true,
  SESSION_REPLACED: true,
  ACTION_NOT_FOUND: false,
  ACTION_BINDING_MISMATCH: false,
  ATTEMPT_NOT_FOUND: false,
  ACTION_NOT_ACCEPTING_RECEIPT: false,
  ACTION_NOT_ACCEPTING_RESULT: false,
  RESULT_CONFLICT: false,
  INTERNAL_ERROR: true,
};

export function gameErrorRetryable(code: GameProtocolErrorCode): boolean {
  return AUTH_RETRYABILITY[code];
}

function hasCredentialHeader(headers: GameHandshake["headers"]): boolean {
  return headers["authorization"] !== undefined || headers["cookie"] !== undefined;
}

function hasQueryCredential(query: GameHandshake["query"]): boolean {
  return Object.keys(query).some((key) => key.toLowerCase().includes("token"));
}

function isLoopback(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "127.0.0.1" || normalized === "::1";
}

export function authenticateGameHandshake(input: {
  readonly handshake: GameHandshake;
  readonly sessions: RoleSessionRegistry;
  readonly originPolicy: OriginPolicy;
  readonly now: () => number;
}): AuthenticatedGameConnection {
  const { handshake } = input;
  if (hasQueryCredential(handshake.query)) {
    throw new GameAuthenticationError("QUERY_TOKEN_FORBIDDEN", false);
  }
  if (hasCredentialHeader(handshake.headers)) {
    throw new GameAuthenticationError("AUTH_FORBIDDEN", false);
  }
  const origin = handshake.headers["origin"];
  try {
    authorizeOrigin(
      typeof origin === "string" ? origin : undefined,
      isLoopback(handshake.address) ? "127.0.0.1" : handshake.address,
      input.originPolicy,
    );
  } catch {
    throw new GameAuthenticationError("ORIGIN_FORBIDDEN", false);
  }
  if (typeof handshake.auth !== "object" || handshake.auth === null) {
    throw new GameAuthenticationError("AUTH_REQUIRED", false);
  }
  const keys = Object.keys(handshake.auth);
  const token = Reflect.get(handshake.auth, "token");
  if (keys.some((key) => key !== "token") || typeof token !== "string" || token.length === 0) {
    throw new GameAuthenticationError("AUTH_REQUIRED", false);
  }
  if (token.length > MAX_GAME_TOKEN_LENGTH) {
    throw new GameAuthenticationError("AUTH_INVALID", false);
  }
  try {
    const session = authorizeSession(input.sessions, { token, role: "game" });
    return {
      clientId: session.clientId,
      authenticatedAt: input.now(),
      expiresAt: session.expiresAt,
      fingerprint: session.fingerprint,
    };
  } catch (error) {
    let code: GameProtocolErrorCode | undefined;
    if (error instanceof AuthError) {
      switch (error.code) {
        case "INVALID_CREDENTIAL":
          code = "AUTH_INVALID";
          break;
        case "CREDENTIAL_EXPIRED":
          code = "AUTH_EXPIRED";
          break;
        case "CREDENTIAL_REVOKED":
          code = "AUTH_REVOKED";
          break;
        case "FORBIDDEN":
          code = "AUTH_FORBIDDEN";
          break;
        case "QUERY_TOKEN_FORBIDDEN":
          code = "QUERY_TOKEN_FORBIDDEN";
          break;
        default:
          code = "AUTH_INVALID";
      }
    }
    throw new GameAuthenticationError(code ?? "AUTH_INVALID", false);
  }
}
