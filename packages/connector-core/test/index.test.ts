import { describe, it, expect } from "vitest";
import { CONNECTOR_CORE_VERSION } from "../src/index.js";
import type { ConnectionStatus, ConnectionStatusMessage, RawConnectorEvent } from "../src/index.js";

describe("Connector Core Primitives and Declarations", () => {
  it("exports CONNECTOR_CORE_VERSION", () => {
    expect(CONNECTOR_CORE_VERSION).toBe("0.1.0");
  });

  it("verifies compile-time type assignability for connection status and raw events", () => {
    const status: ConnectionStatus = "connected";
    const message: ConnectionStatusMessage = {
      status,
      timestamp: "2026-07-23T12:00:00.000Z",
    };
    const rawEvent: RawConnectorEvent<{ foo: string }> = {
      kind: "chat",
      source: "mock",
      roomId: "room_01",
      streamerUniqueId: "streamer_01",
      occurredAt: "2026-07-23T12:00:00.000Z",
      rawPayload: { foo: "bar" },
    };

    expect(message.status).toBe("connected");
    expect(rawEvent.kind).toBe("chat");
  });
});
