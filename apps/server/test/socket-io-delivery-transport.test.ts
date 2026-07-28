import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import {
  RoleSessionRegistry,
  type OriginPolicy,
} from "@crowdcircuit/auth-core";
import type {
  GameActionDeliveryMessage,
  GameRegisteredMessage,
} from "@crowdcircuit/contracts";
import { SocketIoActionDeliveryAdapter } from "../src/delivery/socket-io/index.js";
import { GameSessionRegistry } from "../src/game/registry/index.js";
import { attachGameSocketServer } from "../src/game/socket-server.js";

const LOOPBACK_POLICY: OriginPolicy = {
  allowedOrigins: new Set(),
  allowNoOriginOnLoopback: true,
};
const clients: Socket[] = [];

const envelope = {
  specVersion: "0.1",
  actionId: "action",
  actionType: "spawn",
  gameId: "game",
  gameInstanceId: "instance",
  params: {},
  actor: null,
  trigger: {
    eventId: "event",
    eventType: "gift",
    mappingId: "mapping",
  },
  priority: 0,
  ttlMs: 1_000,
  createdAt: "2026-07-28T00:00:00.000Z",
} as const;

afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect();
});

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

async function connectAndRegister(options: {
  registry?: GameSessionRegistry;
  actionSendTestHooks?: {
    isWritable?(): boolean;
    emitAction?(message: GameActionDeliveryMessage): void;
  };
} = {}) {
  const sessions = new RoleSessionRegistry();
  const httpServer = createServer();
  const runtime = attachGameSocketServer({
    httpServer,
    sessions,
    originPolicy: LOOPBACK_POLICY,
    registry: options.registry,
    actionSendTestHooks: options.actionSendTestHooks,
  });
  await new Promise<void>((resolve) =>
    httpServer.listen(0, "127.0.0.1", resolve),
  );
  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }
  const client = io(`http://127.0.0.1:${address.port}/game`, {
    auth: { token: sessions.issue("game", "game").token },
    transports: ["websocket"],
    reconnection: false,
  });
  clients.push(client);
  await once(client, "connect");
  const registeredPromise = once<GameRegisteredMessage>(
    client,
    "game.registered",
  );
  client.emit("game.register", {
    type: "game.register",
    specVersion: "0.1",
    gameId: "game",
    instanceId: "instance",
    sdkVersion: "0.1.0",
  });
  const registered = await registeredPromise;
  const adapter = new SocketIoActionDeliveryAdapter(runtime.registry);
  const resolution = await adapter.resolveDestination(envelope);
  expect(resolution.status).toBe("available");
  if (resolution.status !== "available") {
    throw new Error("Expected an available delivery destination");
  }
  const close = async () => {
    await runtime.close();
    if (httpServer.listening) {
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) =>
          error === undefined ? resolve() : reject(error),
        ),
      );
    }
  };
  return { adapter, client, close, registered, resolution, runtime };
}

function deliveryMessage(sessionGeneration: number): GameActionDeliveryMessage {
  return {
    type: "game.action",
    specVersion: "0.1",
    attemptNumber: 3,
    sessionGeneration,
    data: envelope,
  };
}

describe("Socket.IO action delivery transport", () => {
  it("delivers exactly once with the resolved session generation and releases on close", async () => {
    const { adapter, client, close, registered, resolution, runtime } =
      await connectAndRegister();
    try {
      const deliveryPromise = once<GameActionDeliveryMessage>(
        client,
        "game.action",
      );
      await expect(adapter.send({
        envelope,
        attemptNumber: 3,
        destination: resolution.destination,
      })).resolves.toEqual({ status: "sent" });
      const delivery = await deliveryPromise;
      expect(delivery).toMatchObject({
        type: "game.action",
        attemptNumber: 3,
        sessionGeneration: registered.sessionGeneration,
        data: {
          actionId: "action",
          gameInstanceId: "instance",
        },
      });

      await runtime.close();
      expect(runtime.registry.getActiveSessionCount()).toBe(0);
      await expect(adapter.send({
        envelope: delivery.data,
        attemptNumber: 3,
        destination: resolution.destination,
      })).resolves.toEqual({
        status: "transport_error",
        error: "game_session_unavailable",
      });
    } finally {
      await close();
    }
  });

  it("returns disconnected from the real private handle without fallback", async () => {
    const registry = new GameSessionRegistry();
    const lookupDestination = vi.spyOn(registry, "lookupDestination");
    const preserveFence = vi
      .spyOn(registry, "removeIfCurrent")
      .mockReturnValue(false);
    const { adapter, client, close, registered, resolution, runtime } =
      await connectAndRegister({ registry });
    let delivered = 0;
    client.on("game.action", () => {
      delivered += 1;
    });
    try {
      const disconnected = once(client, "disconnect");
      client.disconnect();
      await disconnected;
      await vi.waitFor(() => {
        expect(preserveFence).toHaveBeenCalledTimes(1);
      });

      expect(runtime.registry.sendIfCurrent(
        deliveryMessage(registered.sessionGeneration),
        resolution.destination.destinationGeneration,
      )).toEqual({ status: "unavailable", reason: "disconnected" });
      await expect(adapter.send({
        envelope,
        attemptNumber: 3,
        destination: resolution.destination,
      })).resolves.toEqual({
        status: "transport_error",
        error: "game_session_unavailable",
      });
      expect(delivered).toBe(0);
      expect(lookupDestination).toHaveBeenCalledTimes(1);
      expect(runtime.registry.getActiveSessionCount()).toBe(1);
    } finally {
      preserveFence.mockRestore();
      await close();
      expect(runtime.registry.getActiveSessionCount()).toBe(0);
    }
  });

  it("returns backpressured from the private action-send writable branch", async () => {
    const emitAction = vi.fn();
    const { adapter, client, close, registered, resolution, runtime } =
      await connectAndRegister({
        actionSendTestHooks: {
          isWritable: () => false,
          emitAction,
        },
      });
    let delivered = 0;
    client.on("game.action", () => {
      delivered += 1;
    });
    try {
      expect(runtime.registry.sendIfCurrent(
        deliveryMessage(registered.sessionGeneration),
        resolution.destination.destinationGeneration,
      )).toEqual({ status: "unavailable", reason: "backpressured" });
      await expect(adapter.send({
        envelope,
        attemptNumber: 3,
        destination: resolution.destination,
      })).resolves.toEqual({
        status: "transport_error",
        error: "game_session_unavailable",
      });
      expect(emitAction).not.toHaveBeenCalled();
      expect(delivered).toBe(0);
    } finally {
      await close();
      expect(runtime.registry.getActiveSessionCount()).toBe(0);
    }
  });

  it("redacts synchronous provider emit failure from the real private handle", async () => {
    const sensitive = "provider-secret: socket internals";
    const emitAction = vi.fn(() => {
      throw new Error(sensitive);
    });
    const { adapter, client, close, registered, resolution, runtime } =
      await connectAndRegister({
        actionSendTestHooks: { emitAction },
      });
    const clientEvents: unknown[] = [];
    client.onAny((event, value) => {
      clientEvents.push([event, value]);
    });
    try {
      expect(runtime.registry.sendIfCurrent(
        deliveryMessage(registered.sessionGeneration),
        resolution.destination.destinationGeneration,
      )).toEqual({ status: "unavailable", reason: "emit_failed" });
      const outcome = await adapter.send({
        envelope,
        attemptNumber: 3,
        destination: resolution.destination,
      });
      expect(outcome).toEqual({
        status: "transport_error",
        error: "game_session_unavailable",
      });
      expect(emitAction).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(outcome)).not.toContain(sensitive);
      expect(JSON.stringify(clientEvents)).not.toContain(sensitive);
      expect(clientEvents).toHaveLength(0);
      expect(runtime.registry.getActiveSessionCount()).toBe(1);
    } finally {
      await close();
      expect(runtime.registry.getActiveSessionCount()).toBe(0);
    }
  });
});
