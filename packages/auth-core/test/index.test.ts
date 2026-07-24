import { describe, expect, it } from "vitest";
import {
  AuthError,
  PairingCodeRegistry,
  RoleSessionRegistry,
  RuntimeSecret,
  authorizeOrigin,
  authorizeSession,
  tokenFingerprint,
} from "@crowdcircuit/auth-core";

const bytes = (value: number) => (size: number) => new Uint8Array(size).fill(value);

describe("authentication foundations", () => {
  it("creates and explicitly disposes a runtime secret", () => {
    const secret = RuntimeSecret.create(bytes(7));
    expect(secret.active).toBe(true);
    secret.dispose();
    expect(secret.active).toBe(false);
  });

  it("rejects invalid secret and random output", () => {
    expect(() => RuntimeSecret.create(bytes(1), 31)).toThrow(AuthError);
    expect(() => RuntimeSecret.create(() => new Uint8Array(1))).toThrow(AuthError);
  });

  it("consumes a bound pairing code exactly once", () => {
    let now = 1_000;
    const registry = new PairingCodeRegistry({ clock: () => now, random: bytes(1) });
    const credential = registry.create({ role: "game", clientId: "game-1" });
    expect(registry.consume(credential.code, "game", "game-1")).toEqual({
      role: "game",
      clientId: "game-1",
    });
    expect(() => registry.consume(credential.code, "game", "game-1")).toThrow(AuthError);
    now += 1;
  });

  it("fails wrong binding, expiry, revocation, and deterministic collisions conservatively", () => {
    let now = 10;
    const wrong = new PairingCodeRegistry({ clock: () => now, random: bytes(2) });
    const a = wrong.create({ role: "game", clientId: "one" });
    expect(() => wrong.consume(a.code, "voice-output", "one")).toThrow(AuthError);
    expect(wrong.consume(a.code, "game", "one")).toEqual({
      role: "game",
      clientId: "one",
    });

    const expired = new PairingCodeRegistry({ clock: () => now, random: bytes(3) });
    const b = expired.create({ role: "game", clientId: "one", ttlMs: 1 });
    now += 1;
    expect(() => expired.consume(b.code, "game", "one")).toThrow(AuthError);

    const revoked = new PairingCodeRegistry({ clock: () => 1, random: bytes(4) });
    const c = revoked.create({ role: "game", clientId: "one" });
    expect(revoked.revoke(c.code)).toBe(true);
    expect(() => revoked.consume(c.code, "game", "one")).toThrow(AuthError);

    const collision = new PairingCodeRegistry({ clock: () => 1, random: bytes(5) });
    collision.create({ role: "game", clientId: "one" });
    expect(() => collision.create({ role: "game", clientId: "two" })).toThrow(AuthError);
  });

  it("gives concurrent synchronous consumers exactly one winner", async () => {
    const registry = new PairingCodeRegistry({ clock: () => 1, random: bytes(6) });
    const { code } = registry.create({ role: "game", clientId: "one" });
    const results = await Promise.allSettled([
      Promise.resolve().then(() => registry.consume(code, "game", "one")),
      Promise.resolve().then(() => registry.consume(code, "game", "one")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("allows a correct consumer to win after a concurrent wrong binding", async () => {
    const registry = new PairingCodeRegistry({ clock: () => 1, random: bytes(9) });
    const { code } = registry.create({ role: "game", clientId: "one" });
    const results = await Promise.allSettled([
      Promise.resolve().then(() => registry.consume(code, "voice-output", "one")),
      Promise.resolve().then(() => registry.consume(code, "game", "one")),
    ]);
    expect(results[0]?.status).toBe("rejected");
    expect(results[1]?.status).toBe("fulfilled");
  });

  it("issues, scopes, fingerprints, expires, and revokes sessions without disclosure", () => {
    let now = 100;
    let sequence = 7;
    const registry = new RoleSessionRegistry({
      clock: () => now,
      random: (size) => new Uint8Array(size).fill(sequence++),
    });
    const issued = registry.issue("game", "game-1", 100);
    expect(issued.fingerprint).toBe(tokenFingerprint(issued.token));
    expect(issued.fingerprint).toHaveLength(8);
    expect(registry.validate(issued.token, "game", "game-1")).not.toHaveProperty("token");
    expect(() => registry.validate(issued.token, "voice-output")).toThrow(AuthError);
    expect(registry.revoke(issued.token)).toBe(true);
    expect(() => registry.validate(issued.token, "game")).toThrow(AuthError);

    const expiring = registry.issue("game", "game-2", 1);
    now += 1;
    expect(() => registry.validate(expiring.token, "game")).toThrow(AuthError);

    const first = registry.issue("game", "shared");
    const second = registry.issue("voice-output", "shared");
    expect(registry.revokeClient("shared")).toBe(2);
    expect(() => registry.validate(first.token, "game")).toThrow(AuthError);
    expect(() => registry.validate(second.token, "voice-output")).toThrow(AuthError);
  });

  it("enforces explicit origins and forbids query credentials", () => {
    const policy = {
      allowedOrigins: new Set(["http://127.0.0.1:5173", "https://app.example"]),
      allowNoOriginOnLoopback: true,
    };
    expect(() => authorizeOrigin(undefined, "127.0.0.1", policy)).not.toThrow();
    expect(() => authorizeOrigin("https://app.example", "example", policy)).not.toThrow();
    for (const origin of ["*", "null", "https://evil.example"]) {
      expect(() => authorizeOrigin(origin, "example", policy)).toThrow(AuthError);
    }
    expect(() => authorizeOrigin(undefined, "example", policy)).toThrow(AuthError);

    const sessions = new RoleSessionRegistry({ clock: () => 1, random: bytes(8) });
    const issued = sessions.issue("game", "g");
    expect(() =>
      authorizeSession(sessions, {
        token: issued.token,
        queryToken: issued.token,
        role: "game",
      }),
    ).toThrow(AuthError);
  });

  it("never includes raw credentials in public failures", () => {
    const raw = "super-secret-credential";
    const registry = new RoleSessionRegistry({ clock: () => 1 });
    try {
      registry.validate(raw, "game");
    } catch (error) {
      expect(String(error)).not.toContain(raw);
    }
  });

  it("bounds pairing storage, sweeps expiry, and retains live entries", () => {
    let now = 1;
    let sequence = 1;
    const registry = new PairingCodeRegistry({
      clock: () => now,
      random: (size) => new Uint8Array(size).fill(sequence++),
      capacity: 2,
      tombstoneTtlMs: 10,
    });
    const live = registry.create({ role: "game", clientId: "live", ttlMs: 100 });
    registry.create({ role: "game", clientId: "short", ttlMs: 1 });
    expect(() =>
      registry.create({ role: "game", clientId: "overflow" }),
    ).toThrowError(expect.objectContaining({ code: "CAPACITY_EXCEEDED" }));
    now = 2;
    expect(registry.cleanup()).toBe(1);
    expect(registry.size).toBe(1);
    expect(registry.consume(live.code, "game", "live")).toMatchObject({ clientId: "live" });
    expect(registry.cleanup()).toBe(0);
    now = 12;
    expect(registry.cleanup()).toBe(1);
    expect(registry.size).toBe(0);
    expect(() => registry.consume(live.code, "game", "live")).toThrow(AuthError);
  });

  it("bounds sessions and deterministically cleans expired and revoked entries", () => {
    let now = 1;
    let sequence = 20;
    const registry = new RoleSessionRegistry({
      clock: () => now,
      random: (size) => new Uint8Array(size).fill(sequence++),
      capacity: 2,
      tombstoneTtlMs: 10,
    });
    const live = registry.issue("game", "live", 100);
    registry.issue("game", "short", 1);
    expect(() => registry.issue("game", "overflow")).toThrowError(
      expect.objectContaining({ code: "CAPACITY_EXCEEDED" }),
    );
    now = 2;
    expect(registry.cleanup()).toBe(1);
    expect(registry.validate(live.token, "game").clientId).toBe("live");
    expect(registry.revoke(live.token)).toBe(true);
    expect(registry.cleanup()).toBe(0);
    now = 12;
    expect(registry.cleanup()).toBe(1);
    expect(registry.size).toBe(0);
    expect(() => registry.validate(live.token, "game")).toThrow(AuthError);
  });
});
