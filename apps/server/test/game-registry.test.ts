import { describe, expect, it } from "vitest";
import {
  GAME_SESSION_LIMITS,
  GameSessionRegistry,
  type GameConnectionHandle,
} from "../src/game/registry/index.js";

function handle(id: string) {
  const reasons: string[] = [];
  const value: GameConnectionHandle = {
    id,
    disconnect(reason) {
      reasons.push(reason);
    },
  };
  return { value, reasons };
}

function register(
  registry: GameSessionRegistry,
  clientId: string,
  gameId: string,
  instanceId: string,
  connection = handle(`${clientId}-${instanceId}`),
) {
  return {
    connection,
    outcome: registry.registerLiveSession(
      { clientId, authenticatedAt: 0 },
      {
        gameId,
        instanceId,
        sdkVersion: "0.1.0",
        specVersion: "0.1",
        authExpiresAt: Number.MAX_SAFE_INTEGER,
        authFingerprint: "fingerprint",
        handle: connection.value,
      },
    ),
  };
}

describe("GameSessionRegistry", () => {
  it("registers, snapshots without credentials/handles, and allocates generations", async () => {
    const registry = new GameSessionRegistry({ clock: () => 10, runtimeGeneration: "runtime-a" });
    const first = register(registry, "client-a", "game", "one").outcome;
    const second = register(registry, "client-a", "game", "two").outcome;
    expect(first.status).toBe("registered");
    expect(second.status).toBe("registered");
    if (first.status !== "registered" || second.status !== "registered") return;
    expect(second.sessionGeneration).toBeGreaterThan(first.sessionGeneration);
    expect(first.session).toEqual({
      clientId: "client-a",
      gameId: "game",
      gameInstanceId: "one",
      serverRuntimeGeneration: "runtime-a",
      connectionGeneration: first.sessionGeneration,
      registeredAt: 10,
      lastHeartbeatAt: 10,
      sdkVersion: "0.1.0",
    });
    expect(first.session).not.toHaveProperty("authFingerprint");
    expect(first.session).not.toHaveProperty("handle");
    await expect(
      registry.lookupDestination({ clientId: "client-a", gameId: "game", gameInstanceId: null }),
    ).resolves.toMatchObject({ status: "found", session: { gameInstanceId: "one" } });
  });

  it("replaces the same owner's tuple and fences stale heartbeat/removal", () => {
    let now = 0;
    const registry = new GameSessionRegistry({ clock: () => now });
    const old = register(registry, "client-a", "game", "one");
    now = 1;
    const replacement = register(registry, "client-a", "game", "one");
    expect(replacement.outcome.status).toBe("registered");
    if (old.outcome.status !== "registered" || replacement.outcome.status !== "registered") return;
    expect(replacement.outcome.replaced).toBe(old.connection.value);
    expect(registry.recordHeartbeat(old.outcome.session, old.outcome.sessionGeneration)).toBe(false);
    expect(registry.removeIfCurrent(old.outcome.session, old.outcome.sessionGeneration, "old")).toBe(false);
    expect(registry.getActiveSessionCount()).toBe(1);
    expect(registry.removeIfCurrent(replacement.outcome.session, replacement.outcome.sessionGeneration, "current")).toBe(true);
  });

  it("rejects another owner and never partially mutates", () => {
    const registry = new GameSessionRegistry();
    register(registry, "client-a", "game", "one");
    const conflict = register(registry, "client-b", "game", "one").outcome;
    expect(conflict).toMatchObject({ status: "rejected", errorCode: "INSTANCE_OWNED_BY_OTHER_CLIENT" });
    expect(registry.getSession("client-a", "game", "one")).not.toBeNull();
    expect(registry.listSessionsForClient("client-b")).toHaveLength(0);
  });

  it("enforces per-client capacity without healthy eviction", () => {
    const registry = new GameSessionRegistry();
    for (let index = 0; index < GAME_SESSION_LIMITS.maxPerClient; index += 1) {
      expect(register(registry, "client-a", "game", `instance-${index}`).outcome.status).toBe("registered");
    }
    expect(register(registry, "client-a", "game", "overflow").outcome).toMatchObject({
      status: "rejected",
      errorCode: "SESSION_CAPACITY",
    });
    expect(registry.getActiveSessionCount()).toBe(GAME_SESSION_LIMITS.maxPerClient);
  });

  it("enforces total capacity without partial mutation", () => {
    const registry = new GameSessionRegistry();
    for (let index = 0; index < GAME_SESSION_LIMITS.maxTotal; index += 1) {
      expect(register(registry, `client-${index}`, "game", `instance-${index}`).outcome.status).toBe("registered");
    }
    expect(register(registry, "overflow", "game", "overflow").outcome).toMatchObject({
      status: "rejected",
      errorCode: "SESSION_CAPACITY",
    });
    expect(registry.getActiveSessionCount()).toBe(GAME_SESSION_LIMITS.maxTotal);
  });

  it("sweeps stale entries with compare-and-remove and the exact bound", () => {
    let now = 0;
    const registry = new GameSessionRegistry({ clock: () => now });
    const connections = [];
    for (let index = 0; index < GAME_SESSION_LIMITS.maxSweep + 1; index += 1) {
      const item = register(registry, `client-${index}`, "game", `instance-${index}`);
      connections.push(item.connection);
    }
    now = GAME_SESSION_LIMITS.staleAfterMs;
    expect(registry.sweepStale()).toBe(GAME_SESSION_LIMITS.maxSweep);
    expect(registry.getActiveSessionCount()).toBe(1);
    expect(connections.filter((item) => item.reasons[0] === "SESSION_STALE")).toHaveLength(GAME_SESSION_LIMITS.maxSweep);
  });

  it("isolates process-local runtime generations", () => {
    const first = new GameSessionRegistry({ runtimeGeneration: "one" });
    const second = new GameSessionRegistry({ runtimeGeneration: "two" });
    expect(register(first, "client", "game", "instance").outcome).toMatchObject({
      session: { serverRuntimeGeneration: "one" },
    });
    expect(register(second, "client", "game", "instance").outcome).toMatchObject({
      session: { serverRuntimeGeneration: "two" },
    });
  });
});
