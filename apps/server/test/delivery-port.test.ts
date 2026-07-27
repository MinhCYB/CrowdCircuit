import type { GameActionEnvelope } from "@crowdcircuit/contracts";
import { describe, expect, it } from "vitest";
import type {
  ActionDeliveryOutcome,
  DeliveryResolution,
  PreparedActionDelivery,
} from "../src/delivery/port.js";
import { FakeActionDeliveryPort } from "./support/fake-action-delivery-port.js";

describe("ActionDeliveryPort and FakeActionDeliveryPort", () => {
  const sampleEnvelope: GameActionEnvelope = {
    specVersion: "0.1",
    actionId: "act_fake_1",
    actionType: "SPAWN",
    gameId: "game_demo",
    gameInstanceId: "inst_1",
    params: { level: 2 },
    actor: {
      viewerId: "viewer_1",
      displayName: "PlayerOne",
      avatarUrl: null,
    },
    trigger: {
      eventId: "evt_1",
      eventType: "CHEER",
      mappingId: "map_1",
    },
    priority: 10,
    ttlMs: 5000,
    createdAt: "2026-07-26T12:00:00.000Z",
  };

  it("handles default fallback resolution and outcome correctly", async () => {
    const fake = new FakeActionDeliveryPort();

    const resolution = await fake.resolveDestination(sampleEnvelope);
    expect(resolution).toEqual<DeliveryResolution>({ status: "no_destination" });
    expect(fake.resolvedEnvelopes).toEqual([sampleEnvelope]);

    const delivery: PreparedActionDelivery = {
      envelope: sampleEnvelope,
      attemptNumber: 1,
      destination: { clientId: "game_demo", gameInstanceId: "inst_1", destinationGeneration: "gen_1" },
    };

    const outcome = await fake.send(delivery);
    expect(outcome).toEqual<ActionDeliveryOutcome>({ status: "sent" });
    expect(fake.sentDeliveries).toEqual([delivery]);
  });

  it("supports queued resolutions and outcomes in deterministic order", async () => {
    const fake = new FakeActionDeliveryPort();

    fake.queueResolution({
      status: "available",
      destination: { clientId: "game_demo", gameInstanceId: "inst_1", destinationGeneration: "gen_1" },
    });
    fake.queueOutcome({
      status: "transport_error",
      error: "Connection dropped before delivery",
    });

    const res1 = await fake.resolveDestination(sampleEnvelope);
    expect(res1).toEqual<DeliveryResolution>({
      status: "available",
      destination: { clientId: "game_demo", gameInstanceId: "inst_1", destinationGeneration: "gen_1" },
    });

    const delivery: PreparedActionDelivery = {
      envelope: sampleEnvelope,
      attemptNumber: 1,
      destination: { clientId: "game_demo", gameInstanceId: "inst_1", destinationGeneration: "gen_1" },
    };

    const outcome1 = await fake.send(delivery);
    expect(outcome1).toEqual<ActionDeliveryOutcome>({
      status: "transport_error",
      error: "Connection dropped before delivery",
    });

    // Fallback on empty queue
    const res2 = await fake.resolveDestination(sampleEnvelope);
    expect(res2).toEqual<DeliveryResolution>({ status: "no_destination" });
  });

  it("resets recorded state cleanly", async () => {
    const fake = new FakeActionDeliveryPort();

    await fake.resolveDestination(sampleEnvelope);
    expect(fake.resolvedEnvelopes).toHaveLength(1);

    fake.reset();
    expect(fake.resolvedEnvelopes).toHaveLength(0);
    expect(fake.sentDeliveries).toHaveLength(0);
  });
});
