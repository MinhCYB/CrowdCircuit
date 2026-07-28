import { describe, expect, it, vi } from "vitest";
import type {
  GameActionEnvelope,
  GameActionDeliveryMessage,
} from "@crowdcircuit/contracts";
import { SocketIoActionDeliveryAdapter } from "../src/delivery/socket-io/index.js";
import type {
  GameSessionSendResult,
  SessionLookupResult,
} from "../src/game/ports.js";

const envelope: GameActionEnvelope = {
  specVersion: "0.1",
  actionId: "action",
  actionType: "spawn",
  gameId: "game",
  gameInstanceId: null,
  params: {},
  actor: null,
  trigger: { eventId: "event", eventType: "gift", mappingId: "mapping" },
  priority: 0,
  ttlMs: 1_000,
  createdAt: "2026-07-28T00:00:00.000Z",
};

function adapterWith(
  lookup: SessionLookupResult,
  sendResult: GameSessionSendResult = { status: "sent" },
) {
  const registry = {
    lookupDestination: vi.fn().mockResolvedValue(lookup),
    sendIfCurrent: vi.fn<
      (message: GameActionDeliveryMessage, generation: string) => GameSessionSendResult
    >(() => sendResult),
  };
  return { adapter: new SocketIoActionDeliveryAdapter(registry), registry };
}

describe("SocketIoActionDeliveryAdapter", () => {
  it("returns no_destination for an explicit missing instance without fallback", async () => {
    const { adapter, registry } = adapterWith({ status: "not_found" });
    await expect(adapter.resolveDestination({
      ...envelope,
      gameInstanceId: "missing",
    })).resolves.toEqual({ status: "no_destination" });
    expect(registry.lookupDestination).toHaveBeenCalledWith({
      gameId: "game",
      gameInstanceId: "missing",
    });
    expect(registry.sendIfCurrent).not.toHaveBeenCalled();
  });

  it("encodes a socket-independent fence and emits the fenced session generation", async () => {
    const { adapter, registry } = adapterWith({
      status: "found",
      session: {
        clientId: "client-distinct",
        gameId: "game",
        gameInstanceId: "a",
        serverRuntimeGeneration: "runtime",
        connectionGeneration: 7,
        registeredAt: 1,
        lastHeartbeatAt: 1,
        sdkVersion: "0.1.0",
      },
    });
    const resolved = await adapter.resolveDestination(envelope);
    expect(resolved.status).toBe("available");
    if (resolved.status !== "available") return;
    expect(resolved.destination).toMatchObject({
      clientId: "client-distinct",
      gameId: "game",
      gameInstanceId: "a",
      sessionGeneration: 7,
    });
    expect(resolved.destination.destinationGeneration).toBe(
      JSON.stringify([1, "client-distinct", "game", "a", "runtime", 7, 7]),
    );
    expect(resolved.destination.destinationGeneration).not.toContain("socket");
    await expect(adapter.send({
      envelope: { ...envelope, gameInstanceId: "a" },
      attemptNumber: 2,
      destination: resolved.destination,
    })).resolves.toEqual({ status: "sent" });
    expect(registry.sendIfCurrent).toHaveBeenCalledTimes(1);
    expect(registry.sendIfCurrent.mock.calls[0]?.[0]).toMatchObject({
      type: "game.action",
      attemptNumber: 2,
      sessionGeneration: 7,
      data: { gameInstanceId: "a" },
    });
  });

  it("maps malformed and provider failures to one sanitized error without retry", async () => {
    const { adapter, registry } = adapterWith(
      { status: "not_found" },
      { status: "stale", reason: "malformed_fence" },
    );
    await expect(adapter.send({
      envelope,
      attemptNumber: 1,
      destination: {
        clientId: "client-distinct",
        gameId: "game",
        gameInstanceId: "a",
        sessionGeneration: 7,
        destinationGeneration: "{private provider failure}",
      },
    })).resolves.toEqual({
      status: "transport_error",
      error: "game_session_unavailable",
    });
    expect(registry.sendIfCurrent).toHaveBeenCalledTimes(1);
  });
});
