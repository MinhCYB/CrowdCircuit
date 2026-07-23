/**
 * @crowdcircuit/connector-core
 *
 * LiveConnector interface and shared raw connector types.
 */

export const CONNECTOR_CORE_VERSION = "0.1.0" as const;

/**
 * Connection status states for live connectors.
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "ended";

/**
 * Status message emitted on connection state changes.
 */
export interface ConnectionStatusMessage {
  status: ConnectionStatus;
  timestamp: string;
  reason?: string;
}

/**
 * Provider-independent configuration passed when initiating a connection.
 */
export interface ConnectorConfig {
  roomId?: string | null;
  streamerUniqueId?: string;
  options?: Record<string, unknown>;
}

/**
 * Connection information returned upon successful connection initiation.
 */
export interface ConnectionInfo {
  connectorId: string;
  source: "tiktok" | "tikfinity" | "mock";
  status: ConnectionStatus;
  roomId: string | null;
  streamerUniqueId: string;
  connectedAt: string;
}

/**
 * Trustworthy provider-independent identity carried beside a raw event.
 * Connectors omit fields they cannot establish safely.
 */
export interface RawEventIdentity {
  connectorEventId?: string;
  sequenceId?: string;
}

export type GiftStreakLifecycle = "start" | "update" | "end";

/**
 * Provider-independent gift streak evidence. This is processing metadata,
 * not part of the public normalized LIVE event envelope.
 */
export interface GiftStreakEvidence {
  streakId: string;
  lifecycle: GiftStreakLifecycle;
  sequenceId?: string;
}

/**
 * Raw un-normalized event emitted by a connector before normalization.
 * Keeps provider-specific raw objects decoupled from normalized public contracts.
 */
export interface RawConnectorEvent<TRawPayload = unknown> {
  kind: string;
  source: "tiktok" | "tikfinity" | "mock";
  roomId?: string | null;
  streamerUniqueId?: string;
  occurredAt?: string;
  identity?: RawEventIdentity;
  giftStreak?: GiftStreakEvidence;
  rawPayload: TRawPayload;
}

export type EventListener<T = RawConnectorEvent> = (event: T) => void;
export type ErrorListener = (error: Error) => void;
export type StatusListener = (status: ConnectionStatusMessage) => void;
export type Unsubscribe = () => void;

/**
 * Core interface for live streaming platform connectors.
 */
export interface LiveConnector {
  readonly id: string;
  readonly source: "tiktok" | "tikfinity" | "mock";
  getStatus(): ConnectionStatus;
  connect(config?: ConnectorConfig): Promise<ConnectionInfo>;
  disconnect(): Promise<void>;
  onEvent(listener: EventListener): Unsubscribe;
  onError(listener: ErrorListener): Unsubscribe;
  onStatus(listener: StatusListener): Unsubscribe;
  destroy(): Promise<void>;
}
