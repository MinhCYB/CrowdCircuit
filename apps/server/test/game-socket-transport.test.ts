import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import { RoleSessionRegistry, type OriginPolicy } from "@crowdcircuit/auth-core";
import {
  GameProtocolErrorMessageSchema,
  type GameProtocolErrorMessage,
} from "@crowdcircuit/contracts";
import { attachGameSocketServer } from "../src/game/socket-server.js";
import { GameSessionRegistry } from "../src/game/registry/index.js";

const LOOPBACK_POLICY: OriginPolicy = {
  allowedOrigins: new Set(),
  allowNoOriginOnLoopback: true,
};
const clients: Socket[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect();
});

class ManualDeadlineScheduler {
  readonly pending = new Set<{ callback: () => void; unref(): void }>();
  readonly cleared = new Set<{ callback: () => void; unref(): void }>();

  set(callback: () => void, _delayMs: number) {
    const timer = { callback, unref() {} };
    this.pending.add(timer);
    return timer;
  }

  clear(timer: { unref(): void }) {
    const deadline = timer as { callback: () => void; unref(): void };
    this.pending.delete(deadline);
    this.cleared.add(deadline);
  }

  fireAll() {
    for (const timer of [...this.pending]) {
      this.pending.delete(timer);
      timer.callback();
    }
  }
}

interface SetupOptions {
  clock?: () => number;
  registry?: GameSessionRegistry;
  registrationDeadlineScheduler?: ManualDeadlineScheduler;
  invalidMessageWindowMs?: number;
}

async function setup(options: SetupOptions = {}) {
  const sessions = new RoleSessionRegistry();
  const httpServer = createServer();
  const gameRuntime = attachGameSocketServer({
    httpServer,
    sessions,
    originPolicy: LOOPBACK_POLICY,
    clock: options.clock,
    registry: options.registry,
    registrationDeadlineScheduler: options.registrationDeadlineScheduler,
    invalidMessageWindowMs: options.invalidMessageWindowMs,
  });
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  if (address === null || typeof address === "string") throw new Error("Missing TCP address");
  const url = `http://127.0.0.1:${address.port}/game`;
  let tornDown = false;
  return {
    sessions,
    gameRuntime,
    url,
    async teardown() {
      if (tornDown) return;
      tornDown = true;
      await gameRuntime.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve, reject) => {
          httpServer.close((error) => error === undefined ? resolve() : reject(error));
        });
      }
    },
  };
}

function connect(url: string, token: unknown): Socket {
  const client = io(url, { transports: ["websocket"], auth: { token } });
  clients.push(client);
  return client;
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function register(
  url: string,
  sessions: RoleSessionRegistry,
  clientId: string,
  gameId = "game",
  instanceId = "instance",
  beforeRegister?: (client: Socket) => void,
) {
  const session = sessions.issue("game", clientId);
  const client = connect(url, session.token);
  await once(client, "connect");
  const registered = once<{
    type: string;
    clientId: string;
    sessionGeneration: number;
  }>(client, "game.registered");
  beforeRegister?.(client);
  client.emit("game.register", {
    type: "game.register",
    specVersion: "0.1",
    gameId,
    instanceId,
    sdkVersion: "0.1.0",
  });
  return { client, registered: await registered };
}

function expectStrictError(value: unknown, code: GameProtocolErrorMessage["code"]) {
  expect(GameProtocolErrorMessageSchema.safeParse(value).success).toBe(true);
  expect(value).toMatchObject({
    type: "game.error",
    specVersion: "0.1",
    code,
  });
  expect((value as GameProtocolErrorMessage).correlationId.length).toBeGreaterThan(0);
}

describe("registration deadline", () => {
  it("emits REGISTRATION_TIMEOUT, disconnects, and leaves no registry entry", async () => {
    const scheduler = new ManualDeadlineScheduler();
    const registry = new GameSessionRegistry();
    const { sessions, url, teardown } = await setup({
      registry,
      registrationDeadlineScheduler: scheduler,
    });
    try {
      const client = connect(url, sessions.issue("game", "timeout-client").token);
      await once(client, "connect");
      expect(scheduler.pending.size).toBe(1);
      const errorPromise = once<GameProtocolErrorMessage>(client, "game.error");
      const disconnectPromise = once<string>(client, "disconnect");
      scheduler.fireAll();
      const error = await errorPromise;
      expectStrictError(error, "REGISTRATION_TIMEOUT");
      expect(error.retryable).toBe(true);
      await disconnectPromise;
      expect(client.connected).toBe(false);
      expect(registry.getActiveSessionCount()).toBe(0);
      expect(scheduler.pending.size).toBe(0);
    } finally {
      await teardown();
    }
  });

  it("registration and close both dispose pending deadlines", async () => {
    const scheduler = new ManualDeadlineScheduler();
    const { sessions, gameRuntime, url, teardown } = await setup({
      registrationDeadlineScheduler: scheduler,
    });
    try {
      await register(url, sessions, "registered-client");
      expect(scheduler.pending.size).toBe(0);
      const unregistered = connect(url, sessions.issue("game", "closing-client").token);
      await once(unregistered, "connect");
      expect(scheduler.pending.size).toBe(1);
      await gameRuntime.close();
      expect(scheduler.pending.size).toBe(0);
      expect(scheduler.cleared.size).toBe(2);
    } finally {
      await teardown();
    }
  });
});

describe("heartbeat rate limiting", () => {
  it("allows burst 4, rate-limits the next message, and refills 2/s", async () => {
    let now = 1_000;
    const registry = new GameSessionRegistry({ clock: () => now });
    const { sessions, url, teardown } = await setup({ clock: () => now, registry });
    try {
      const { client } = await register(url, sessions, "heartbeat-client");
      const errors: GameProtocolErrorMessage[] = [];
      client.on("game.error", (error: GameProtocolErrorMessage) => errors.push(error));
      const heartbeat = { type: "game.heartbeat", specVersion: "0.1" };
      for (let index = 0; index < 4; index += 1) client.emit("game.heartbeat", heartbeat);
      client.emit("game.heartbeat", heartbeat);
      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expectStrictError(errors[0], "RATE_LIMITED");
      expect(errors[0]?.retryable).toBe(true);

      now = 2_000;
      client.emit("game.heartbeat", heartbeat);
      await vi.waitFor(() => {
        expect(registry.getSession("heartbeat-client", "game", "instance")?.lastHeartbeatAt)
          .toBe(2_000);
      });
      expect(errors).toHaveLength(1);
    } finally {
      await teardown();
    }
  });
});

describe("invalid and unsupported messages", () => {
  it("emits stable INVALID_MESSAGE and disconnects at the accepted fifth message", async () => {
    const { sessions, url, teardown } = await setup();
    try {
      const client = connect(url, sessions.issue("game", "invalid-client").token);
      await once(client, "connect");
      const errors: GameProtocolErrorMessage[] = [];
      client.on("game.error", (error: GameProtocolErrorMessage) => errors.push(error));
      for (let index = 0; index < 4; index += 1) {
        client.emit(`unknown.${index}`, { token: "must-not-echo", body: "private" });
      }
      await vi.waitFor(() => expect(errors).toHaveLength(4));
      expect(client.connected).toBe(true);
      for (const error of errors) {
        expectStrictError(error, "INVALID_MESSAGE");
        expect(JSON.stringify(error)).not.toContain("must-not-echo");
      }
      const disconnected = once<string>(client, "disconnect");
      client.emit("unknown.4", { query: "private" });
      await disconnected;
      expect(errors).toHaveLength(5);
      expectStrictError(errors[4], "INVALID_MESSAGE");
    } finally {
      await teardown();
    }
  });

  it("expires invalid-message history at the exact sliding-window boundary", async () => {
    let now = 0;
    const { sessions, url, teardown } = await setup({
      clock: () => now,
      invalidMessageWindowMs: 10_000,
    });
    try {
      const client = connect(url, sessions.issue("game", "window-client").token);
      await once(client, "connect");
      const errors: GameProtocolErrorMessage[] = [];
      client.on("game.error", (error: GameProtocolErrorMessage) => errors.push(error));
      for (let index = 0; index < 4; index += 1) client.emit(`old.${index}`);
      await vi.waitFor(() => expect(errors).toHaveLength(4));
      now = 10_000;
      client.emit("new.0");
      await vi.waitFor(() => expect(errors).toHaveLength(5));
      expect(client.connected).toBe(true);
    } finally {
      await teardown();
    }
  });

  it("returns strict UNSUPPORTED_PROTOCOL without registry mutation", async () => {
    const registry = new GameSessionRegistry();
    const { sessions, url, teardown } = await setup({ registry });
    try {
      const client = connect(url, sessions.issue("game", "protocol-client").token);
      await once(client, "connect");
      const errorPromise = once<GameProtocolErrorMessage>(client, "game.error");
      client.emit("game.register", {
        type: "game.register",
        specVersion: "9.99",
        gameId: "game",
        instanceId: "instance",
        sdkVersion: "0.1.0",
      });
      const error = await errorPromise;
      expectStrictError(error, "UNSUPPORTED_PROTOCOL");
      expect(error.retryable).toBe(false);
      expect(client.connected).toBe(true);
      expect(registry.getActiveSessionCount()).toBe(0);
    } finally {
      await teardown();
    }
  });
});

describe("registration ownership", () => {
  it("replaces the same owner and fences the stale disconnect", async () => {
    let now = 1_000;
    const registry = new GameSessionRegistry({ clock: () => now });
    const { sessions, url, teardown } = await setup({ clock: () => now, registry });
    try {
      const { client: oldClient, registered: oldAck } = await register(
        url, sessions, "same-owner", "game", "shared",
      );
      const eventOrder: string[] = [];
      const oldErrorPromise = once<GameProtocolErrorMessage>(oldClient, "game.error")
        .then((error) => {
          eventOrder.push("old:SESSION_REPLACED");
          return error;
        });
      const oldDisconnectPromise = once<string>(oldClient, "disconnect");
      const { client: newClient, registered: newAck } = await register(
        url,
        sessions,
        "same-owner",
        "game",
        "shared",
        (client) => client.once("game.registered", () => eventOrder.push("new:game.registered")),
      );
      expect(newAck.type).toBe("game.registered");
      expect(newAck.sessionGeneration).toBeGreaterThan(oldAck.sessionGeneration);
      expectStrictError(await oldErrorPromise, "SESSION_REPLACED");
      expect(eventOrder).toStrictEqual(["new:game.registered", "old:SESSION_REPLACED"]);
      await oldDisconnectPromise;
      expect(oldClient.connected).toBe(false);
      expect(registry.getActiveSessionCount()).toBe(1);
      expect(registry.getSession("same-owner", "game", "shared")?.connectionGeneration)
        .toBe(newAck.sessionGeneration);

      const heartbeatErrors: GameProtocolErrorMessage[] = [];
      newClient.on("game.error", (error: GameProtocolErrorMessage) => heartbeatErrors.push(error));
      now = 2_000;
      newClient.emit("game.heartbeat", { type: "game.heartbeat", specVersion: "0.1" });
      await vi.waitFor(() => {
        expect(registry.getSession("same-owner", "game", "shared")?.lastHeartbeatAt).toBe(2_000);
      });
      expect(heartbeatErrors).toHaveLength(0);
    } finally {
      await teardown();
    }
  });

  it("rejects a different owner without mutation or disconnecting the current owner", async () => {
    const registry = new GameSessionRegistry();
    const { sessions, url, teardown } = await setup({ registry });
    try {
      const { client: owner } = await register(url, sessions, "owner-a", "game", "shared");
      const contender = connect(url, sessions.issue("game", "owner-b").token);
      await once(contender, "connect");
      const errorPromise = once<GameProtocolErrorMessage>(contender, "game.error");
      contender.emit("game.register", {
        type: "game.register",
        specVersion: "0.1",
        gameId: "game",
        instanceId: "shared",
        sdkVersion: "0.1.0",
      });
      const error = await errorPromise;
      expectStrictError(error, "INSTANCE_OWNED_BY_OTHER_CLIENT");
      expect(error.retryable).toBe(false);
      expect(owner.connected).toBe(true);
      expect(registry.getActiveSessionCount()).toBe(1);
      expect(registry.getSession("owner-a", "game", "shared")).not.toBeNull();
      expect(registry.getSession("owner-b", "game", "shared")).toBeNull();
    } finally {
      await teardown();
    }
  });
});

describe("pre-registration guards", () => {
  it.each([
    ["game.heartbeat", { type: "game.heartbeat", specVersion: "0.1" }],
    ["game.action.received", {}],
    ["game.action.result", {}],
  ] as const)("%s returns REGISTRATION_REQUIRED without consuming invalid quota", async (event, payload) => {
    const registry = new GameSessionRegistry();
    const { sessions, url, teardown } = await setup({ registry });
    try {
      const client = connect(url, sessions.issue("game", `guard-${event}`).token);
      await once(client, "connect");
      const errors: GameProtocolErrorMessage[] = [];
      client.on("game.error", (error: GameProtocolErrorMessage) => errors.push(error));
      for (let index = 0; index < 5; index += 1) client.emit(event, payload);
      await vi.waitFor(() => expect(errors).toHaveLength(5));
      for (const error of errors) expectStrictError(error, "REGISTRATION_REQUIRED");
      expect(client.connected).toBe(true);
      expect(registry.getActiveSessionCount()).toBe(0);

      for (let index = 0; index < 4; index += 1) client.emit(`unknown.guard.${index}`);
      await vi.waitFor(() => expect(errors).toHaveLength(9));
      expect(client.connected).toBe(true);
      const disconnected = once<string>(client, "disconnect");
      client.emit("unknown.guard.4");
      await disconnected;
    } finally {
      await teardown();
    }
  });
});

describe("shutdown disposal", () => {
  it("closes registry, deadlines, namespace sockets, and engine idempotently", async () => {
    const scheduler = new ManualDeadlineScheduler();
    const registry = new GameSessionRegistry();
    const closeAll = vi.spyOn(registry, "closeAll");
    const { sessions, gameRuntime, url, teardown } = await setup({
      registry,
      registrationDeadlineScheduler: scheduler,
    });
    try {
      const registered = await register(url, sessions, "shutdown-registered");
      const pending = connect(url, sessions.issue("game", "shutdown-pending").token);
      await once(pending, "connect");
      expect(scheduler.pending.size).toBe(1);
      const registeredDisconnect = once<string>(registered.client, "disconnect");
      const pendingDisconnect = once<string>(pending, "disconnect");
      await gameRuntime.close();
      await Promise.all([registeredDisconnect, pendingDisconnect]);
      expect(registered.client.connected).toBe(false);
      expect(pending.connected).toBe(false);
      expect(registry.getActiveSessionCount()).toBe(0);
      expect(scheduler.pending.size).toBe(0);
      expect(closeAll).toHaveBeenCalledTimes(1);
      await expect(gameRuntime.close()).resolves.toBeUndefined();
      expect(closeAll).toHaveBeenCalledTimes(1);
    } finally {
      await teardown();
    }
  });
});

describe("non-string handshake token", () => {
  it.each([
    ["numeric", 123],
    ["object", { nested: true }],
  ] as const)("rejects a %s token with strict AUTH_REQUIRED", async (_label, token) => {
    const { url, teardown } = await setup();
    try {
      const client = connect(url, token);
      const error = await once<Error & { data: GameProtocolErrorMessage }>(client, "connect_error");
      expect(error.message).toBe("AUTH_REQUIRED");
      expectStrictError(error.data, "AUTH_REQUIRED");
      expect(error.data.retryable).toBe(false);
    } finally {
      await teardown();
    }
  });
});
