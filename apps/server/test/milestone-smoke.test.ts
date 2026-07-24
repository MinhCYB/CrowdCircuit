import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeSession } from "@crowdcircuit/auth-core";
import { createAuthRuntime, SqliteDurableActionRepository } from "@crowdcircuit/server";

describe("Phase C Milestone 1 integration smoke", () => {
  it("pairs, authorizes, persists, restarts, and reconciles without replay", () => {
    const directory = mkdtempSync(join(tmpdir(), "crowdcircuit-smoke-"));
    const filename = join(directory, "smoke.sqlite");
    let sequence = 1;
    const random = (size: number) => new Uint8Array(size).fill(sequence++);
    const auth = createAuthRuntime({ clock: () => 1_000, random });
    const pairing = auth.pairingCodes.create({ role: "game", clientId: "game-1" });
    auth.pairingCodes.consume(pairing.code, "game", "game-1");
    const session = auth.sessions.issue("game", "game-1");
    expect(
      authorizeSession(auth.sessions, {
        token: session.token,
        role: "game",
        clientId: "game-1",
      }).clientId,
    ).toBe("game-1");

    const firstRuntime = SqliteDurableActionRepository.open({ filename });
    const durable = firstRuntime.createBeforeFirstSend({
      actionId: "action-smoke",
      idempotencyKey: "smoke-key",
      eventId: "event-smoke",
      mappingId: "mapping-smoke",
      gameId: "game-1",
      actionType: "SPAWN_ZOMBIE",
      params: { count: 1 },
      priority: 1,
      ttlMs: 10_000,
      createdAt: 1_000,
      expiresAt: 11_000,
      runtimeId: "runtime-old",
    });
    expect(durable.sendAuthorization.actionId).toBe("action-smoke");
    firstRuntime.close();
    auth.dispose();
    expect(() => authorizeSession(auth.sessions, { token: session.token, role: "game" })).toThrow();

    const secondRuntime = SqliteDurableActionRepository.open({ filename });
    expect(secondRuntime.reconcilePreviousRuntime("runtime-new", 2_000)).toEqual([
      {
        actionId: "action-smoke",
        previousStatus: "pending",
        status: "aborted_restart",
      },
    ]);
    expect(secondRuntime.listAttempts("action-smoke")).toEqual([]);
    secondRuntime.close();
    rmSync(directory, { recursive: true, force: true });
  });
});
