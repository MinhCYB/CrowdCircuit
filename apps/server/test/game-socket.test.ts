import { afterEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { buildApp } from "../src/index.js";
import { createAuthRuntime } from "../src/auth/index.js";

const clients: Socket[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.disconnect();
});

async function setup() {
  const authRuntime = createAuthRuntime();
  const app = await buildApp({ authRuntime });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (address === null || typeof address === "string") throw new Error("Missing address");
  return {
    app,
    authRuntime,
    url: `http://127.0.0.1:${address.port}/game`,
  };
}

function connect(url: string, token?: string, query?: Record<string, string>) {
  const client = io(url, {
    transports: ["websocket"],
    auth: token === undefined ? {} : { token },
    query,
  });
  clients.push(client);
  return client;
}

function once<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe("/game Socket.IO lifecycle", () => {
  it("authenticates and returns the exact registration acknowledgment", async () => {
    const { app, authRuntime, url } = await setup();
    const session = authRuntime.sessions.issue("game", "client-a");
    const client = connect(url, session.token);
    await once(client, "connect");
    const registered = Promise.race([
      once(client, "game.registered"),
      once<{ code: string }>(client, "game.error").then((error) => {
        throw new Error(`registration failed: ${error.code}`);
      }),
    ]);
    client.emit("game.register", {
      type: "game.register",
      specVersion: "0.1",
      gameId: "game",
      instanceId: "instance",
      sdkVersion: "0.1.0",
    });
    await expect(registered).resolves.toEqual({
      type: "game.registered",
      specVersion: "0.1",
      clientId: "client-a",
      gameId: "game",
      gameInstanceId: "instance",
      sessionGeneration: 1,
      heartbeatIntervalMs: 10_000,
    });
    await app.close();
    authRuntime.dispose();
  });

  it.each([
    [undefined, undefined, "AUTH_REQUIRED"],
    ["invalid", undefined, "AUTH_INVALID"],
    [undefined, { token: "query-leak" }, "QUERY_TOKEN_FORBIDDEN"],
  ] as const)("rejects invalid handshake channels with stable data", async (token, query, code) => {
    const { app, authRuntime, url } = await setup();
    const client = connect(url, token, query);
    const error = await once<Error & { data: { code: string; correlationId: string; retryable: boolean } }>(
      client,
      "connect_error",
    );
    expect(error.message).toBe(code);
    expect(error.data).toMatchObject({ code, retryable: false });
    expect(error.data.correlationId).toEqual(expect.any(String));
    expect(JSON.stringify(error.data)).not.toContain("query-leak");
    await app.close();
    authRuntime.dispose();
  });

  it("rejects duplicate registration without mutating identity", async () => {
    const { app, authRuntime, url } = await setup();
    const session = authRuntime.sessions.issue("game", "client-a");
    const client = connect(url, session.token);
    await once(client, "connect");
    const firstRegistered = Promise.race([
      once(client, "game.registered"),
      once<{ code: string }>(client, "game.error").then((error) => {
        throw new Error(`registration failed: ${error.code}`);
      }),
    ]);
    client.emit("game.register", {
      type: "game.register", specVersion: "0.1", gameId: "game", instanceId: "one", sdkVersion: "0.1.0",
    });
    await firstRegistered;
    const duplicateError = once<{ code: string }>(client, "game.error");
    client.emit("game.register", {
      type: "game.register", specVersion: "0.1", gameId: "game", instanceId: "two", sdkVersion: "0.1.0",
    });
    await expect(duplicateError).resolves.toMatchObject({ code: "ALREADY_REGISTERED" });
    await app.close();
    authRuntime.dispose();
  });
});
