import { MockConnector, MockConnectorInputError } from "@crowdcircuit/connector-mock";
import type { LiveConnector, ConnectionInfo } from "@crowdcircuit/connector-core";

// 1. Positive compilation checks
const connector: LiveConnector = new MockConnector({
  id: "decl_mock_001",
  roomId: "room_decl",
  streamerUniqueId: "streamer_decl",
  clock: () => "2026-07-23T12:00:00.000Z",
});

async function testConnect(): Promise<ConnectionInfo> {
  return await connector.connect({
    roomId: "room_override",
    streamerUniqueId: "streamer_override",
  });
}

const mockInst = new MockConnector();
const err = new MockConnectorInputError("Input error test");
const errorName: string = err.name;
const errorMessage: string = err.message;
mockInst.emitMockGift({
  connectorEventId: "event_1",
  sequenceId: "1",
  giftStreak: { streakId: "streak_1", lifecycle: "start" },
});

// 2. Negative compilation checks
// @ts-expect-error - Invalid constructor option (source property not allowed on MockConnectorOptions)
const _badConnector = new MockConnector({ source: "invalid_source" });

// @ts-expect-error - Invalid connector ID (must be string)
const _badId = new MockConnector({ id: 12345 });

// @ts-expect-error - Invalid room ID (must be string or null)
const _badRoom = new MockConnector({ roomId: 12345 });

// @ts-expect-error - Invalid streamerUniqueId (must be string)
const _badStreamer = new MockConnector({ streamerUniqueId: 12345 });

// @ts-expect-error - Invalid clock signature (must return string)
const _badClock = new MockConnector({ clock: () => 12345 });

// @ts-expect-error - Invalid emitMockEvent source property
mockInst.emitMockEvent({ kind: "chat", source: "invalid_source", rawPayload: {} });

// @ts-expect-error - rawPayload is required
mockInst.emitMockEvent({ kind: "chat", source: "mock" });

// @ts-expect-error - occurredAt must be a string
mockInst.emitMockEvent({ kind: "chat", source: "mock", occurredAt: 123, rawPayload: {} });

// @ts-expect-error - Invalid emitMockGift helper argument
mockInst.emitMockGift({ repeatCount: "not-a-number" });

// @ts-expect-error - Invalid emitMockComment helper argument
mockInst.emitMockComment({ commentText: 12345 });

// @ts-expect-error - Invalid emitMockFollow helper argument
mockInst.emitMockFollow({ streamerUniqueId: 12345 });

// @ts-expect-error - Invalid emitMockLike helper argument
mockInst.emitMockLike({ likeCount: "not-a-number" });

// @ts-expect-error - Invalid gift streak lifecycle
mockInst.emitMockGift({ giftStreak: { streakId: "x", lifecycle: "middle" } });

// @ts-expect-error - MockConnectorInputError code property is readonly literal
err.code = "OTHER_CODE";

// @ts-expect-error - MockConnectorInputError code is readonly
err.code = "MOCK_CONNECTOR_INPUT_ERROR";

console.log(
  connector.id, connector.source, testConnect, err, errorName, errorMessage, mockInst,
  _badConnector, _badId, _badRoom, _badStreamer, _badClock
);
