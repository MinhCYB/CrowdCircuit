import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ActionGateway,
  SqliteDurableActionRepository,
  type DurableActionRecord,
  type InboundGameSession,
} from "../src/index.js";
import { FakeActionDeliveryPort } from "./support/fake-action-delivery-port.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function setup(status: "in_flight" | "received" = "in_flight") {
  const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-inbound-"));
  directories.push(directory);
  const repository = SqliteDurableActionRepository.open({
    filename: join(directory, "database.sqlite"),
  });
  let now = 2_000;
  const created = repository.createPending({
    actionId: "action-1",
    idempotencyKey: "seed-1",
    eventId: "event-1",
    mappingId: "mapping-1",
    gameId: "game-1",
    actionType: "SPAWN",
    params: {},
    priority: 1,
    ttlMs: 10_000,
    createdAt: 1_000,
    expiresAt: 11_000,
    runtimeId: "runtime-1",
  }).record;
  const authorization = repository.authorizePending(
    created.actionId,
    created.version,
    "runtime-1",
    { clientId: "client-1", gameInstanceId: "instance-1" },
  );
  repository.recordAttempt(
    authorization,
    { role: "game", clientId: "client-1", gameInstanceId: "instance-1" },
    1_500,
    "send_started",
  );
  if (status === "received") {
    const current = repository.findById(created.actionId);
    if (current === null) throw new Error("missing action");
    repository.transition({
      actionId: current.actionId,
      expectedVersion: current.version,
      expectedStatuses: ["in_flight"],
      nextStatus: "received",
      at: 1_750,
    });
  }
  return {
    repository,
    gateway: new ActionGateway(
      repository,
      new FakeActionDeliveryPort(),
      { now: () => now },
      "runtime-1",
    ),
    setNow(value: number) { now = value; },
  };
}

const session: InboundGameSession = {
  clientId: "client-1",
  gameId: "game-1",
  gameInstanceId: "instance-1",
  sessionGeneration: 7,
};
const receipt = {
  type: "game.action.received" as const,
  specVersion: "0.1" as const,
  actionId: "action-1",
  attemptNumber: 1,
  sessionGeneration: 7,
  receivedAt: "1970-01-01T00:00:00.001Z",
};
const completed = {
  type: "game.action.result" as const,
  specVersion: "0.1" as const,
  actionId: "action-1",
  attemptNumber: 1,
  sessionGeneration: 7,
  status: "completed" as const,
  durationMs: 25,
  details: { z: 1, nested: { b: 2, a: [3, 4] } },
};
const failed = {
  type: "game.action.result" as const,
  specVersion: "0.1" as const,
  actionId: "action-1",
  attemptNumber: 1,
  sessionGeneration: 7,
  status: "failed" as const,
  error: { code: "NOPE", message: "failed safely", retryable: false },
};

describe("Slice 4 inbound action lifecycle", () => {
  it("accepts receipt using server time and makes duplicates idempotent", () => {
    const { gateway, repository, setNow } = setup();
    setNow(9_000);
    expect(gateway.handleReceipt(session, receipt).status).toBe("accepted");
    expect(repository.findById("action-1")?.receivedAt).toBe(9_000);
    expect(gateway.handleReceipt(session, receipt).status).toBe("idempotent");
    repository.close();
  });

  it.each([completed, failed])("persists and idempotently compares $status", (message) => {
    const { gateway, repository } = setup("received");
    expect(gateway.handleResult(session, message).status).toBe("accepted");
    expect(gateway.handleResult(session, message).status).toBe("idempotent");
    repository.close();
  });

  it("normalizes object key order and absent completed details to null", () => {
    const first = setup("received");
    expect(first.gateway.handleResult(session, completed).status).toBe("accepted");
    expect(first.gateway.handleResult(session, {
      ...completed,
      details: { nested: { a: [3, 4], b: 2 }, z: 1 },
    }).status).toBe("idempotent");
    first.repository.close();

    const second = setup("received");
    const absent = { ...completed };
    delete (absent as { details?: unknown }).details;
    expect(second.gateway.handleResult(session, absent).status).toBe("accepted");
    expect(second.gateway.handleResult(session, { ...absent, details: null }).status)
      .toBe("idempotent");
    second.repository.close();
  });

  it("rejects same-status and cross-status terminal conflicts", () => {
    const { gateway, repository } = setup("received");
    expect(gateway.handleResult(session, completed).status).toBe("accepted");
    expect(gateway.handleResult(session, { ...completed, durationMs: 26 }))
      .toEqual({ status: "rejected", code: "RESULT_CONFLICT" });
    expect(gateway.handleResult(session, failed))
      .toEqual({ status: "rejected", code: "RESULT_CONFLICT" });
    repository.close();
  });

  it("rejects result before receipt, exact-attempt misses, and identity mismatches", () => {
    const { gateway, repository } = setup();
    expect(gateway.handleResult(session, completed))
      .toEqual({ status: "rejected", code: "ACTION_NOT_ACCEPTING_RESULT" });
    expect(gateway.handleReceipt(session, { ...receipt, attemptNumber: 2 }))
      .toEqual({ status: "rejected", code: "ATTEMPT_NOT_FOUND" });
    for (const mismatch of [
      { ...session, clientId: "other-client" },
      { ...session, gameId: "other-game" },
      { ...session, gameInstanceId: "other-instance" },
    ]) {
      expect(gateway.handleReceipt(mismatch, receipt))
        .toEqual({ status: "rejected", code: "ACTION_BINDING_MISMATCH" });
    }
    expect(gateway.handleReceipt(session, { ...receipt, actionId: "missing" }))
      .toEqual({ status: "rejected", code: "ACTION_NOT_FOUND" });
    repository.close();
  });

  it("keeps immutable bindings for distinct historical attempts", () => {
    const { repository } = setup();
    const current = repository.findById("action-1") as DurableActionRecord;
    const retry = repository.authorizeRetry(
      current.actionId,
      current.version,
      "runtime-1",
      { clientId: "client-2", gameInstanceId: "instance-2" },
    );
    repository.recordAttempt(
      retry,
      { role: "game", clientId: "client-2", gameInstanceId: "instance-2" },
      1_600,
      "send_started",
    );
    expect(repository.findAttemptBinding("action-1", 1)).toMatchObject({
      clientId: "client-1", gameInstanceId: "instance-1",
    });
    expect(repository.findAttemptBinding("action-1", 2)).toMatchObject({
      clientId: "client-2", gameInstanceId: "instance-2",
    });
    expect(repository.findAttemptBinding("action-1", 3)).toBeNull();
    repository.close();
  });
});
