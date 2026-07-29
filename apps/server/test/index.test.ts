import { afterEach, describe, expect, it, vi } from "vitest";
import type { SqliteDurableActionRepository } from "../src/persistence/repository.js";

const lifecycle = vi.hoisted(() => ({
  authDisposeCount: 0,
  socketAttachCount: 0,
  socketCloseCount: 0,
  failSocketAttach: undefined as Error | undefined,
  events: [] as string[],
  gatewayRuntimeIds: [] as string[],
  gatewayClocks: [] as unknown[],
}));

vi.mock("../src/auth/index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/auth/index.js")>();
  return {
    ...actual,
    createAuthRuntime(...args: Parameters<typeof actual.createAuthRuntime>) {
      const runtime = actual.createAuthRuntime(...args);
      const dispose = runtime.dispose.bind(runtime);
      return {
        ...runtime,
        dispose() {
          lifecycle.authDisposeCount += 1;
          lifecycle.events.push("auth.dispose");
          dispose();
        },
      };
    },
  };
});

vi.mock("../src/game/socket-server.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/game/socket-server.js")>();
  return {
    ...actual,
    attachGameSocketServer(
      ...args: Parameters<typeof actual.attachGameSocketServer>
    ) {
      lifecycle.socketAttachCount += 1;
      lifecycle.events.push("socket.attach");
      if (lifecycle.failSocketAttach !== undefined) {
        throw lifecycle.failSocketAttach;
      }
      const runtime = actual.attachGameSocketServer(...args);
      return {
        ...runtime,
        async close() {
          lifecycle.socketCloseCount += 1;
          lifecycle.events.push("socket.close");
          await runtime.close();
        },
      };
    },
  };
});

vi.mock("../src/delivery/gateway.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/delivery/gateway.js")>();
  return {
    ...actual,
    ActionGateway: class extends actual.ActionGateway {
      constructor(...args: ConstructorParameters<typeof actual.ActionGateway>) {
        lifecycle.gatewayClocks.push(args[2]);
        lifecycle.gatewayRuntimeIds.push(args[3]);
        super(...args);
      }
    },
  };
});

const { buildApp, createAuthRuntime } = await import("../src/index.js");

interface RepositoryProbe {
  readonly repository: SqliteDurableActionRepository;
  readonly reconciliations: { runtimeId: string; now: number }[];
  readonly paths: string[];
  closeCount: number;
}

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
const originalDatabasePath = process.env["DATABASE_PATH"];
const originalNodeEnv = process.env["NODE_ENV"];
const originalVitest = process.env["VITEST"];

function restoreEnvironment() {
  for (const [key, value] of [
    ["DATABASE_PATH", originalDatabasePath],
    ["NODE_ENV", originalNodeEnv],
    ["VITEST", originalVitest],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function repositoryProbe(options: {
  readonly events?: string[];
  readonly reconcileError?: Error;
  readonly closeError?: Error;
} = {}): RepositoryProbe {
  const reconciliations: { runtimeId: string; now: number }[] = [];
  const paths: string[] = [];
  const probe: RepositoryProbe = {
    repository: {
      reconcilePreviousRuntime(runtimeId: string, now: number) {
        options.events?.push("repository.reconcile");
        reconciliations.push({ runtimeId, now });
        if (options.reconcileError !== undefined) throw options.reconcileError;
        return [];
      },
      close() {
        options.events?.push("repository.close");
        probe.closeCount += 1;
        if (options.closeError !== undefined) throw options.closeError;
      },
    } as SqliteDurableActionRepository,
    reconciliations,
    paths,
    closeCount: 0,
  };
  return probe;
}

function factory(probe: RepositoryProbe) {
  return (databasePath: string) => {
    probe.paths.push(databasePath);
    return probe.repository;
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => {
    try {
      await app.close();
    } catch {
      // Individual failure-path assertions own expected close errors.
    }
  }));
  restoreEnvironment();
  lifecycle.authDisposeCount = 0;
  lifecycle.socketAttachCount = 0;
  lifecycle.socketCloseCount = 0;
  lifecycle.failSocketAttach = undefined;
  lifecycle.events.length = 0;
  lifecycle.gatewayRuntimeIds.length = 0;
  lifecycle.gatewayClocks.length = 0;
});

describe("GET /api/v1/health", () => {
  it("returns status ok with a valid ISO timestamp", async () => {
    const probe = repositoryProbe();
    const app = await buildApp({
      durableDatabasePath: ":memory:",
      actionRepositoryFactory: factory(probe),
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      status: "ok",
      product: "CrowdCircuit",
      version: "0.1.0",
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});

describe("Composition B database path resolution", () => {
  it("prefers the explicit path over DATABASE_PATH", async () => {
    process.env["DATABASE_PATH"] = "environment.sqlite";
    const probe = repositoryProbe();
    const app = await buildApp({
      durableDatabasePath: "explicit.sqlite",
      actionRepositoryFactory: factory(probe),
    });
    apps.push(app);
    expect(probe.paths).toEqual(["explicit.sqlite"]);
  });

  it("uses DATABASE_PATH without an explicit option", async () => {
    process.env["DATABASE_PATH"] = "environment.sqlite";
    const probe = repositoryProbe();
    const app = await buildApp({ actionRepositoryFactory: factory(probe) });
    apps.push(app);
    expect(probe.paths).toEqual(["environment.sqlite"]);
  });

  it("defaults exactly to crowdcircuit.sqlite", async () => {
    delete process.env["DATABASE_PATH"];
    const probe = repositoryProbe();
    const app = await buildApp({ actionRepositoryFactory: factory(probe) });
    apps.push(app);
    expect(probe.paths).toEqual(["crowdcircuit.sqlite"]);
  });

  it.each([
    ["NODE_ENV", "test"],
    ["VITEST", "true"],
  ] as const)("does not derive an in-memory path from %s", async (key, value) => {
    delete process.env["DATABASE_PATH"];
    process.env[key] = value;
    const probe = repositoryProbe();
    const app = await buildApp({ actionRepositoryFactory: factory(probe) });
    apps.push(app);
    expect(probe.paths).toEqual(["crowdcircuit.sqlite"]);
  });
});

describe("Composition B runtime and reconciliation", () => {
  it("uses one configured runtime ID and clock value before socket attachment", async () => {
    const events: string[] = [];
    lifecycle.events = events;
    const probe = repositoryProbe({ events });
    const clock = { now: vi.fn(() => 12_345) };
    const app = await buildApp({
      durableDatabasePath: ":memory:",
      runtimeId: "stable-runtime",
      clock,
      actionRepositoryFactory: factory(probe),
    });
    apps.push(app);

    expect(probe.reconciliations).toEqual([
      { runtimeId: "stable-runtime", now: 12_345 },
    ]);
    expect(clock.now).toHaveBeenCalledTimes(1);
    expect(lifecycle.gatewayRuntimeIds).toEqual(["stable-runtime"]);
    expect(lifecycle.gatewayClocks).toEqual([clock]);
    expect(events.slice(0, 2)).toEqual([
      "repository.reconcile",
      "socket.attach",
    ]);
    expect(lifecycle.socketAttachCount).toBe(1);
  });

  it("prevents socket attachment and cleans up when reconciliation fails", async () => {
    const startupError = new Error("reconciliation failed");
    const probe = repositoryProbe({ reconcileError: startupError });

    await expect(buildApp({
      durableDatabasePath: ":memory:",
      runtimeId: "stable-runtime",
      clock: { now: () => 77 },
      actionRepositoryFactory: factory(probe),
    })).rejects.toBe(startupError);

    expect(probe.reconciliations).toEqual([
      { runtimeId: "stable-runtime", now: 77 },
    ]);
    expect(lifecycle.socketAttachCount).toBe(0);
    expect(probe.closeCount).toBe(1);
    expect(lifecycle.authDisposeCount).toBe(1);
  });
});

describe("Composition B startup and shutdown ownership", () => {
  it("disposes owned auth when repository opening fails", async () => {
    const startupError = new Error("repository open failed");
    await expect(buildApp({
      durableDatabasePath: ":memory:",
      actionRepositoryFactory() {
        throw startupError;
      },
    })).rejects.toBe(startupError);
    expect(lifecycle.authDisposeCount).toBe(1);
    expect(lifecycle.socketAttachCount).toBe(0);
  });

  it("closes the repository and owned auth when socket setup fails", async () => {
    const startupError = new Error("socket setup failed");
    lifecycle.failSocketAttach = startupError;
    const probe = repositoryProbe();

    await expect(buildApp({
      durableDatabasePath: ":memory:",
      actionRepositoryFactory: factory(probe),
    })).rejects.toBe(startupError);

    expect(probe.closeCount).toBe(1);
    expect(lifecycle.authDisposeCount).toBe(1);
    expect(lifecycle.socketAttachCount).toBe(1);
    expect(lifecycle.socketCloseCount).toBe(0);
  });

  it("preserves the startup error when cleanup also throws", async () => {
    const startupError = new Error("reconciliation failed");
    const probe = repositoryProbe({
      reconcileError: startupError,
      closeError: new Error("close failed"),
    });

    await expect(buildApp({
      durableDatabasePath: ":memory:",
      actionRepositoryFactory: factory(probe),
    })).rejects.toBe(startupError);
    expect(probe.closeCount).toBe(1);
    expect(lifecycle.authDisposeCount).toBe(1);
  });

  it("closes sockets, repository, and owned auth exactly once in order", async () => {
    const events: string[] = [];
    lifecycle.events = events;
    const probe = repositoryProbe({ events });
    const app = await buildApp({
      durableDatabasePath: ":memory:",
      actionRepositoryFactory: factory(probe),
    });

    await app.close();
    await app.close();

    expect(lifecycle.socketCloseCount).toBe(1);
    expect(probe.closeCount).toBe(1);
    expect(lifecycle.authDisposeCount).toBe(1);
    expect(events.slice(-3)).toEqual([
      "socket.close",
      "repository.close",
      "auth.dispose",
    ]);
  });

  it("never disposes an externally supplied auth runtime", async () => {
    const runtime = createAuthRuntime();
    const dispose = vi.spyOn(runtime, "dispose");
    const probe = repositoryProbe();
    const app = await buildApp({
      authRuntime: runtime,
      durableDatabasePath: ":memory:",
      actionRepositoryFactory: factory(probe),
    });

    await app.close();
    expect(probe.closeCount).toBe(1);
    expect(dispose).not.toHaveBeenCalled();
    runtime.dispose();
  });
});
