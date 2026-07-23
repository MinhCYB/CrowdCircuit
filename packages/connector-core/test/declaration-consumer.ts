import type {
  ConnectionStatus,
  ConnectionStatusMessage,
  ConnectorConfig,
  ConnectionInfo,
  RawConnectorEvent,
  LiveConnector,
  GiftStreakEvidence,
  RawEventIdentity,
} from "@crowdcircuit/connector-core";

// 1. Positive compilation checks
const s1: ConnectionStatus = "disconnected";
const s2: ConnectionStatus = "connecting";
const s3: ConnectionStatus = "connected";
const s4: ConnectionStatus = "reconnecting";
const s5: ConnectionStatus = "error";
const s6: ConnectionStatus = "ended";

const statusMsg: ConnectionStatusMessage = {
  status: s6,
  timestamp: "2026-07-23T12:00:00.000Z",
  reason: "Stream ended",
};

const config: ConnectorConfig = {
  roomId: "room_123",
  streamerUniqueId: "streamer_123",
  options: { timeoutMs: 5000 },
};

const info: ConnectionInfo = {
  connectorId: "conn_123",
  source: "mock",
  status: "connected",
  roomId: "room_123",
  streamerUniqueId: "streamer_123",
  connectedAt: "2026-07-23T12:00:00.000Z",
};

const raw: RawConnectorEvent<{ text: string }> = {
  kind: "chat",
  source: "mock",
  roomId: "room_123",
  streamerUniqueId: "streamer_123",
  occurredAt: "2026-07-23T12:00:00.000Z",
  identity: { connectorEventId: "provider_1", sequenceId: "42" },
  rawPayload: { text: "hello" },
};
const identity: RawEventIdentity = { connectorEventId: "event_1" };
const streak: GiftStreakEvidence = {
  streakId: "streak_1",
  lifecycle: "start",
  sequenceId: "1",
};

const dummyConnector: LiveConnector | null = null;

const validConnector: LiveConnector = {
  id: "connector",
  source: "mock",
  getStatus: () => "disconnected",
  connect: async () => info,
  disconnect: async () => {},
  onEvent: () => () => {},
  onError: () => () => {},
  onStatus: () => () => {},
  destroy: async () => {},
};

// 2. Negative compile-time checks
// @ts-expect-error - Invalid connection status literal
const _invalidStatus: ConnectionStatus = "invalid_status_literal";

// @ts-expect-error - Invalid source literal in ConnectionInfo
const _invalidSource: ConnectionInfo["source"] = "invalid_source";

// @ts-expect-error - Invalid property type in ConnectorConfig
const _invalidConfig: ConnectorConfig = { roomId: 12345 };

// @ts-expect-error - Missing required connectorId in ConnectionInfo
const _missingConnectorId: ConnectionInfo = {
  source: "mock",
  status: "connected",
  roomId: null,
  streamerUniqueId: "streamer_123",
  connectedAt: "2026-07-23T12:00:00.000Z",
};

// @ts-expect-error - Incorrect LiveConnector connect parameter type
const _badParamConnect: LiveConnector["connect"] = (_config: number) => Promise.resolve(info);

// @ts-expect-error - Incorrect LiveConnector connect return type (non-promise)
const _badReturnConnect: LiveConnector["connect"] = () => "not-a-promise";

// @ts-expect-error - Incorrect promised ConnectionInfo return shape
const _badPromisedConnect: LiveConnector["connect"] = () => Promise.resolve({ connectorId: 123 });

// @ts-expect-error - Malformed ConnectionInfo connectedAt
const _badConnectedAt: ConnectionInfo = { ...info, connectedAt: 123 };

// @ts-expect-error - Malformed ConnectionInfo roomId
const _badInfoRoom: ConnectionInfo = { ...info, roomId: false };

// @ts-expect-error - LiveConnector implementation is missing required lifecycle methods
const _badImplementation: LiveConnector = {
  id: "bad",
  source: "mock",
  getStatus: () => "connected",
  connect: async () => info,
};

// @ts-expect-error - invalid lifecycle literal
const _badStreak: GiftStreakEvidence = { streakId: "x", lifecycle: "middle" };

console.log(
  s1, s2, s3, s4, s5, s6, statusMsg, config, info, raw, dummyConnector,
  _invalidStatus, _invalidSource, _invalidConfig, _missingConnectorId,
  validConnector, identity, streak, _badStreak, _badParamConnect, _badReturnConnect, _badPromisedConnect,
  _badConnectedAt, _badInfoRoom, _badImplementation
);
