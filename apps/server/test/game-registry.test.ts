import { describe, expect, it, vi } from "vitest";
import {
  GAME_SESSION_LIMITS,
  GameSessionRegistry,
  type GameConnectionHandle,
} from "../src/game/registry/index.js";
import type { GameActionDeliveryMessage } from "@crowdcircuit/contracts";

function handle(id: string) {
  const reasons: string[] = [];
  const messages: GameActionDeliveryMessage[] = [];
  const value: GameConnectionHandle = {
    id,
    disconnect(reason) {
      reasons.push(reason);
    },
    sendAction(message) {
      messages.push(message);
      return { status: "sent" };
    },
  };
  return { value, reasons, messages };
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
      registry.lookupDestination({ gameId: "game", gameInstanceId: null }),
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

  it("excludes auth-expired entries from destination resolution", async () => {
    let now = 10;
    const registry = new GameSessionRegistry({ clock: () => now });
    const item = register(registry, "client", "game", "instance");
    expect(item.outcome.status).toBe("registered");
    now = Number.MAX_SAFE_INTEGER;
    await expect(registry.lookupDestination({
      gameId: "game",
      gameInstanceId: null,
    })).resolves.toEqual({ status: "not_found" });
  });

  it("selects the lowest instance and its authenticated owner independently of insertion order", async () => {
    for (const instanceIds of [["z", "a"], ["a", "z"]] as const) {
      const registry = new GameSessionRegistry();
      for (const instanceId of instanceIds) {
        register(registry, instanceId === "a" ? "client-a" : "client-z", "game", instanceId);
      }
      await expect(registry.lookupDestination({
        gameId: "game",
        gameInstanceId: null,
      })).resolves.toMatchObject({
        status: "found",
        session: { clientId: "client-a", gameInstanceId: "a" },
      });
    }
  });

  it("resolves an explicit instance exactly without owner input or fallback", async () => {
    const registry = new GameSessionRegistry();
    register(registry, "client-a", "game", "a");
    register(registry, "client-z", "game", "z");
    await expect(registry.lookupDestination({
      gameId: "game",
      gameInstanceId: "z",
    })).resolves.toMatchObject({
      status: "found",
      session: { clientId: "client-z", gameId: "game", gameInstanceId: "z" },
    });
    await expect(registry.lookupDestination({
      gameId: "game",
      gameInstanceId: "missing",
    })).resolves.toEqual({ status: "not_found" });
  });

  it("sends once only when the complete resolved fence is current", async () => {
    const registry = new GameSessionRegistry({
      clock: () => 10,
      runtimeGeneration: "runtime",
    });
    const item = register(registry, "client", "game", "instance");
    expect(item.outcome.status).toBe("registered");
    if (item.outcome.status !== "registered") return;
    const generation = item.outcome.sessionGeneration;
    const message = actionMessage(generation);
    const fence = encodeFence("client", "game", "instance", "runtime", generation, generation);
    expect(registry.sendIfCurrent(message, fence)).toEqual({ status: "sent" });
    expect(item.connection.messages).toStrictEqual([message]);
  });

  it("fails closed for malformed and independently mismatched fence components", () => {
    const registry = new GameSessionRegistry({
      clock: () => 10,
      runtimeGeneration: "runtime",
    });
    const item = register(registry, "client", "game", "instance");
    expect(item.outcome.status).toBe("registered");
    if (item.outcome.status !== "registered") return;
    const generation = item.outcome.sessionGeneration;
    const message = actionMessage(generation);
    expect(registry.sendIfCurrent(message, "not-json")).toMatchObject({
      status: "stale",
      reason: "malformed_fence",
    });
    expect(registry.sendIfCurrent(
      message,
      encodeFence("client", "game", "instance", "other", generation, generation),
    )).toMatchObject({ reason: "runtime_generation_mismatch" });
    expect(registry.sendIfCurrent(
      message,
      encodeFence("wrong-client", "game", "instance", "runtime", generation, generation),
    )).toMatchObject({ status: "stale", reason: "entry_replaced" });
    expect(registry.sendIfCurrent(
      message,
      encodeFence("client", "game", "instance", "runtime", generation + 1, generation),
    )).toMatchObject({ reason: "session_generation_mismatch" });
    expect(registry.sendIfCurrent(
      message,
      encodeFence("client", "game", "instance", "runtime", generation, generation + 1),
    )).toMatchObject({ reason: "connection_generation_mismatch" });
    expect(item.connection.messages).toHaveLength(0);
  });

  it("does not redirect an old fence to a replacement, but a fresh fence sends", () => {
    const registry = new GameSessionRegistry({
      clock: () => 10,
      runtimeGeneration: "runtime",
    });
    const old = register(registry, "client", "game", "instance");
    const replacement = register(registry, "client", "game", "instance");
    if (old.outcome.status !== "registered" || replacement.outcome.status !== "registered") return;
    const oldFence = encodeFence(
      "client", "game", "instance", "runtime",
      old.outcome.sessionGeneration, old.outcome.sessionGeneration,
    );
    expect(registry.sendIfCurrent(
      actionMessage(old.outcome.sessionGeneration),
      oldFence,
    )).toMatchObject({ status: "stale", reason: "session_generation_mismatch" });
    expect(old.connection.messages).toHaveLength(0);
    expect(replacement.connection.messages).toHaveLength(0);

    const currentGeneration = replacement.outcome.sessionGeneration;
    expect(registry.sendIfCurrent(
      actionMessage(currentGeneration),
      encodeFence("client", "game", "instance", "runtime", currentGeneration, currentGeneration),
    )).toEqual({ status: "sent" });
    expect(replacement.connection.messages).toHaveLength(1);
  });

  it("fails send after disappearance, auth expiry, or registry closure", () => {
    let now = 10;
    const registry = new GameSessionRegistry({
      clock: () => now,
      runtimeGeneration: "runtime",
    });
    const item = register(registry, "client", "game", "instance");
    if (item.outcome.status !== "registered") return;
    const generation = item.outcome.sessionGeneration;
    const fence = encodeFence("client", "game", "instance", "runtime", generation, generation);
    const message = actionMessage(generation);
    now = Number.MAX_SAFE_INTEGER;
    expect(registry.sendIfCurrent(message, fence)).toMatchObject({
      status: "stale",
      reason: "auth_expired",
    });
    now = 10;
    registry.removeIfCurrent(item.outcome.session, generation, "test");
    expect(registry.sendIfCurrent(message, fence)).toMatchObject({
      status: "unavailable",
      reason: "entry_missing",
    });

    const second = register(registry, "client", "game", "instance");
    expect(second.outcome.status).toBe("registered");
    registry.closeAll();
    expect(registry.sendIfCurrent(message, fence)).toMatchObject({
      status: "unavailable",
      reason: "registry_closed",
    });
  });

  it.each([
    ["disconnected", "disconnected"],
    ["backpressured", "backpressured"],
    ["emit failure", "emit_failed"],
  ] as const)("maps a bounded %s handle result without a second send", (_label, reason) => {
    const registry = new GameSessionRegistry({
      clock: () => 10,
      runtimeGeneration: "runtime",
    });
    const sendAction = vi.fn(() => ({
      status: "unavailable" as const,
      reason,
    }));
    const connection = {
      value: {
        id: "non-authoritative",
        disconnect() {},
        sendAction,
      } satisfies GameConnectionHandle,
      reasons: [],
      messages: [],
    };
    const item = register(registry, "client", "game", "instance", connection);
    if (item.outcome.status !== "registered") return;
    const generation = item.outcome.sessionGeneration;
    expect(registry.sendIfCurrent(
      actionMessage(generation),
      encodeFence("client", "game", "instance", "runtime", generation, generation),
    )).toEqual({ status: "unavailable", reason });
    expect(sendAction).toHaveBeenCalledTimes(1);
  });
});

function actionMessage(sessionGeneration: number): GameActionDeliveryMessage {
  return {
    type: "game.action",
    specVersion: "0.1",
    attemptNumber: 1,
    sessionGeneration,
    data: {
      specVersion: "0.1",
      actionId: "action",
      actionType: "spawn",
      gameId: "game",
      gameInstanceId: "instance",
      params: {},
      actor: null,
      trigger: { eventId: "event", eventType: "gift", mappingId: "mapping" },
      priority: 0,
      ttlMs: 1_000,
      createdAt: "2026-07-28T00:00:00.000Z",
    },
  };
}

function encodeFence(
  clientId: string,
  gameId: string,
  gameInstanceId: string,
  runtimeGeneration: string,
  sessionGeneration: number,
  connectionGeneration: number,
): string {
  return JSON.stringify([
    1,
    clientId,
    gameId,
    gameInstanceId,
    runtimeGeneration,
    sessionGeneration,
    connectionGeneration,
  ]);
}
