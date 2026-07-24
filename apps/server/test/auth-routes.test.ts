import { afterEach, describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { createAuthRuntime, buildApp } from "@crowdcircuit/server";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const originPolicy = {
  allowedOrigins: new Set(["http://127.0.0.1:5173"]),
  allowNoOriginOnLoopback: true,
};

describe("authentication HTTP boundary", () => {
  it("bootstraps an HttpOnly admin session and completes one-time pairing", async () => {
    let value = 1;
    const runtime = createAuthRuntime({
      clock: () => 1_000,
      random: (size) => new Uint8Array(size).fill(value++),
    });
    const app = await buildApp({ authRuntime: runtime, originPolicy });
    apps.push(app);
    const bootstrap = await app.inject({
      method: "POST",
      url: "/api/v1/auth/admin-session",
      headers: { origin: "http://127.0.0.1:5173" },
    });
    expect(bootstrap.statusCode).toBe(200);
    const setCookie = bootstrap.headers["set-cookie"];
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    const adminCookie = setCookie?.split(";")[0];

    const codeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pairing-codes",
      headers: {
        origin: "http://127.0.0.1:5173",
        cookie: adminCookie ?? "",
      },
      payload: { clientRole: "game", clientId: "game-1" },
    });
    expect(codeResponse.statusCode).toBe(200);
    const code = codeResponse.json<{ pairingCode: string }>().pairingCode;
    const paired = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: {
        pairingCode: code,
        clientRole: "game",
        clientId: "game-1",
      },
    });
    expect(paired.statusCode).toBe(200);
    expect(paired.json()).toMatchObject({ role: "game", clientId: "game-1" });
    const reused = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: {
        pairingCode: code,
        clientRole: "game",
        clientId: "game-1",
      },
    });
    expect(reused.statusCode).toBe(401);
    expect(reused.body).not.toContain(code);
    runtime.dispose();
  });

  it("rejects unlisted origins, missing admin sessions, and extra request fields", async () => {
    const app = await buildApp({ originPolicy });
    apps.push(app);
    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/auth/admin-session",
      headers: { origin: "https://evil.example" },
    });
    expect(denied.statusCode).toBe(403);
    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pairing-codes",
      headers: { origin: "http://127.0.0.1:5173" },
      payload: { clientRole: "game", clientId: "game-1" },
    });
    expect(unauthorized.statusCode).toBe(401);
    const malformed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: {
        pairingCode: "code",
        clientRole: "game",
        clientId: "game-1",
        extra: true,
      },
    });
    expect(malformed.statusCode).toBe(400);
  });

  it("makes admin bootstrap idempotent", async () => {
    let value = 20;
    const runtime = createAuthRuntime({
      clock: () => 1_000,
      random: (size) => new Uint8Array(size).fill(value++),
    });
    const app = await buildApp({ authRuntime: runtime, originPolicy });
    apps.push(app);
    const request = {
      method: "POST" as const,
      url: "/api/v1/auth/admin-session",
      headers: { origin: "http://127.0.0.1:5173" },
    };
    const first = await app.inject(request);
    const second = await app.inject(request);
    expect(second.json()).toEqual(first.json());
    expect(runtime.sessions.size).toBe(1);
    runtime.dispose();
  });

  it("rejects and never logs query credentials before mutating authentication state", async () => {
    let logs = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        logs += String(chunk);
        callback();
      },
    });
    let value = 40;
    const runtime = createAuthRuntime({
      clock: () => 1_000,
      random: (size) => new Uint8Array(size).fill(value++),
    });
    const app = await buildApp({
      authRuntime: runtime,
      originPolicy,
      loggerStream: stream,
    });
    apps.push(app);
    const secretToken = "query-secret-must-not-log";
    const secretCode = "query-code-must-not-log";
    const tokenResponse = await app.inject({
      method: "POST",
      url: `/api/v1/auth/admin-session?token=${secretToken}`,
      headers: { origin: "http://127.0.0.1:5173" },
    });
    const codeResponse = await app.inject({
      method: "POST",
      url: `/api/v1/auth/pair?pairingCode=${secretCode}`,
      payload: {
        pairingCode: "body-code",
        clientRole: "game",
        clientId: "game-1",
      },
    });
    expect(tokenResponse.statusCode).toBe(403);
    expect(codeResponse.statusCode).toBe(403);
    expect(runtime.sessions.size).toBe(0);
    expect(logs).not.toContain(secretToken);
    expect(logs).not.toContain(secretCode);
    expect(tokenResponse.body).not.toContain(secretToken);
    expect(codeResponse.body).not.toContain(secretCode);
    runtime.dispose();
  });

  it("preserves a valid code after wrong binding, origin, or malformed attempts", async () => {
    let value = 60;
    const runtime = createAuthRuntime({
      clock: () => 1_000,
      random: (size) => new Uint8Array(size).fill(value++),
    });
    const app = await buildApp({ authRuntime: runtime, originPolicy });
    apps.push(app);
    const code = runtime.pairingCodes.create({
      role: "game",
      clientId: "game-1",
    }).code;
    const wrongRole = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: { pairingCode: code, clientRole: "voice-output", clientId: "game-1" },
    });
    const wrongClient = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: { pairingCode: code, clientRole: "game", clientId: "other" },
    });
    const wrongOrigin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      headers: { origin: "https://evil.example" },
      payload: { pairingCode: code, clientRole: "game", clientId: "game-1" },
    });
    const malformed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: { pairingCode: code, clientRole: "game" },
    });
    expect([wrongRole.statusCode, wrongClient.statusCode]).toEqual([401, 401]);
    expect(wrongRole.body).toBe(wrongClient.body);
    expect(wrongOrigin.statusCode).toBe(403);
    expect(malformed.statusCode).toBe(400);
    const valid = await app.inject({
      method: "POST",
      url: "/api/v1/auth/pair",
      payload: { pairingCode: code, clientRole: "game", clientId: "game-1" },
    });
    expect(valid.statusCode).toBe(200);
    runtime.dispose();
  });

  it("allows exactly one concurrent valid pairing redemption", async () => {
    let value = 80;
    const runtime = createAuthRuntime({
      clock: () => 1_000,
      random: (size) => new Uint8Array(size).fill(value++),
    });
    const app = await buildApp({ authRuntime: runtime, originPolicy });
    apps.push(app);
    const code = runtime.pairingCodes.create({
      role: "game",
      clientId: "game-1",
    }).code;
    const request = {
      method: "POST" as const,
      url: "/api/v1/auth/pair",
      payload: { pairingCode: code, clientRole: "game", clientId: "game-1" },
    };
    const responses = await Promise.all([app.inject(request), app.inject(request)]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
    expect(runtime.sessions.size).toBe(1);
    runtime.dispose();
  });

  it("does not trust forwarded headers for loopback identity", async () => {
    const app = await buildApp({ originPolicy });
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/admin-session",
      remoteAddress: "203.0.113.10",
      headers: {
        host: "127.0.0.1:3100",
        origin: "http://127.0.0.1:5173",
        "x-forwarded-for": "127.0.0.1",
        forwarded: "for=127.0.0.1",
      },
    });
    expect(response.statusCode).toBe(403);
  });
});
