import { describe, expect, it } from "vitest";
import {
  RoleSessionRegistry,
  type OriginPolicy,
} from "@crowdcircuit/auth-core";
import {
  authenticateGameHandshake,
  GameAuthenticationError,
} from "../src/game/auth/index.js";

const originPolicy: OriginPolicy = {
  allowedOrigins: new Set(["http://localhost:3100"]),
  allowNoOriginOnLoopback: true,
};

function handshake(
  token: unknown,
  overrides: Partial<Parameters<typeof authenticateGameHandshake>[0]["handshake"]> = {},
) {
  return {
    auth: { token },
    query: {},
    headers: {},
    address: "127.0.0.1",
    ...overrides,
  };
}

describe("game handshake authentication", () => {
  it("authorizes only the handshake auth token and returns authoritative identity", () => {
    const sessions = new RoleSessionRegistry();
    const issued = sessions.issue("game", "client-a");
    const result = authenticateGameHandshake({
      handshake: handshake(issued.token),
      sessions,
      originPolicy,
      now: () => 10,
    });
    expect(result).toEqual({
      clientId: "client-a",
      authenticatedAt: 10,
      expiresAt: issued.expiresAt,
      fingerprint: issued.fingerprint,
    });
    expect(result).not.toHaveProperty("token");
  });

  it.each([
    [undefined, "AUTH_REQUIRED"],
    ["", "AUTH_REQUIRED"],
    [123, "AUTH_REQUIRED"],
    [{ nested: true }, "AUTH_REQUIRED"],
    [true, "AUTH_REQUIRED"],
    [["a", "b"], "AUTH_REQUIRED"],
    ["wrong", "AUTH_INVALID"],
  ] as const)("maps %p to %s without raw auth detail", (token, expected) => {
    const sessions = new RoleSessionRegistry();
    expect(() =>
      authenticateGameHandshake({
        handshake: handshake(token),
        sessions,
        originPolicy,
        now: () => 0,
      }),
    ).toThrowError(
      expect.objectContaining<GameAuthenticationError>({
        code: expected,
        message: expected,
        retryable: false,
        name: "GameAuthenticationError",
      }),
    );
  });

  it("maps expired, revoked, and wrong-role credentials", () => {
    let now = 0;
    const sessions = new RoleSessionRegistry({ clock: () => now });
    const expired = sessions.issue("game", "expired", 1);
    const revoked = sessions.issue("game", "revoked");
    const wrongRole = sessions.issue("admin", "admin");
    sessions.revoke(revoked.token);
    now = 1;
    for (const [token, code] of [
      [expired.token, "AUTH_EXPIRED"],
      [revoked.token, "AUTH_REVOKED"],
      [wrongRole.token, "AUTH_FORBIDDEN"],
    ] as const) {
      expect(() =>
        authenticateGameHandshake({
          handshake: handshake(token),
          sessions,
          originPolicy,
          now: () => now,
        }),
      ).toThrowError(expect.objectContaining({ code }));
    }
  });

  it.each([
    [{ query: { token: "leak" } }, "QUERY_TOKEN_FORBIDDEN"],
    [{ headers: { authorization: "Bearer leak" } }, "AUTH_FORBIDDEN"],
    [{ headers: { cookie: "token=leak" } }, "AUTH_FORBIDDEN"],
    [{ address: "10.0.0.2" }, "ORIGIN_FORBIDDEN"],
  ] as const)("rejects a forbidden credential/origin channel", (override, code) => {
    const sessions = new RoleSessionRegistry();
    const issued = sessions.issue("game", "client-a");
    expect(() =>
      authenticateGameHandshake({
        handshake: handshake(issued.token, override),
        sessions,
        originPolicy,
        now: () => 0,
      }),
    ).toThrowError(expect.objectContaining({ code }));
  });
});
