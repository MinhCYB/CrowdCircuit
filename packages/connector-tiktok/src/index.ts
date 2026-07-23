import type {
  ConnectionInfo,
  ConnectionStatus,
  ConnectionStatusMessage,
  ConnectorConfig,
  ErrorListener,
  EventListener,
  GiftStreakEvidence,
  LiveConnector,
  RawConnectorEvent,
  StatusListener,
  Unsubscribe,
} from "@crowdcircuit/connector-core";
import { IsoDateTimeSchema } from "@crowdcircuit/contracts";

export const CONNECTOR_TIKTOK_VERSION = "0.1.0" as const;

export type TikTokProviderEvent =
  | "gift"
  | "chat"
  | "follow"
  | "like"
  | "disconnected"
  | "streamEnd"
  | "error";

export interface TikTokProviderConnectionState {
  roomId: string;
}

/**
 * Narrow provider port. A runtime composition layer may wrap an unofficial
 * self-hosted client or a managed provider without leaking that dependency
 * through CrowdCircuit's public connector contracts.
 */
export interface TikTokProviderClient {
  connect(roomId?: string): Promise<TikTokProviderConnectionState>;
  disconnect(): Promise<void>;
  on(event: TikTokProviderEvent, listener: (payload: unknown) => void): Unsubscribe;
}

export type TikTokProviderFactory = (
  streamerUniqueId: string
) => TikTokProviderClient;

export interface TikTokConnectorOptions {
  clientFactory: TikTokProviderFactory;
  streamerUniqueId?: string;
  id?: string;
  clock?: () => string;
  retryDelaysMs?: readonly number[];
  delay?: (milliseconds: number) => Promise<void>;
}

export class TikTokConnectorError extends Error {
  public readonly code = "TIKTOK_CONNECTOR_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "TikTokConnectorError";
    Object.setPrototypeOf(this, TikTokConnectorError.prototype);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function numberValue(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function booleanValue(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function nullableStringValue(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): string | null {
  for (const key of keys) {
    if (record[key] === null) return null;
    const value = stringValue(record, key);
    if (value !== undefined) return value;
  }
  return null;
}

function mapSender(payload: Record<string, unknown>): Record<string, unknown> | null {
  const candidate = payload.user ?? payload.sender;
  if (!isRecord(candidate)) return null;
  const roles = candidate.roles;
  return {
    userId: nullableStringValue(candidate, "userId", "id"),
    uniqueId: nullableStringValue(candidate, "uniqueId"),
    nickname:
      stringValue(candidate, "nickname", "displayName", "uniqueId") ?? "",
    avatarUrl: nullableStringValue(
      candidate,
      "avatarUrl",
      "profilePictureUrl"
    ),
    roles:
      Array.isArray(roles) && roles.every((role) => typeof role === "string")
        ? [...roles]
        : [],
  };
}

export interface TikTokRawMappingContext {
  roomId: string | null;
  streamerUniqueId: string;
  occurredAt: string;
}

/**
 * Converts only supported provider facts into a fresh plain raw event.
 * Provider objects never escape this function.
 */
export function mapTikTokProviderEvent(
  kind: "gift" | "chat" | "follow" | "like",
  payload: unknown,
  context: TikTokRawMappingContext
): RawConnectorEvent | null {
  if (!isRecord(payload)) return null;
  const base = {
    source: "tiktok" as const,
    roomId: context.roomId,
    streamerUniqueId: context.streamerUniqueId,
    occurredAt: context.occurredAt,
    ...(() => {
      const connectorEventId = stringValue(
        payload,
        "eventId",
        "msgId",
        "messageId"
      );
      const sequenceId = stringValue(payload, "sequenceId", "sequence");
      return connectorEventId === undefined && sequenceId === undefined
        ? {}
        : {
            identity: {
              ...(connectorEventId === undefined ? {} : { connectorEventId }),
              ...(sequenceId === undefined ? {} : { sequenceId }),
            },
          };
    })(),
  };
  const sender = mapSender(payload);

  if (kind === "chat") {
    return {
      ...base,
      kind: "chat",
      rawPayload: {
        commentText: stringValue(payload, "comment", "commentText"),
        sender,
      },
    };
  }

  if (kind === "gift") {
    const gift = isRecord(payload.gift) ? payload.gift : payload;
    const giftType = numberValue(payload, "giftType");
    const streakId = stringValue(payload, "streakId", "groupId");
    const explicitState = stringValue(payload, "streakState", "lifecycle");
    const repeatEnd = booleanValue(payload, "repeatEnd", "repeat_end");
    let giftStreak: GiftStreakEvidence | undefined;
    if (
      streakId !== undefined &&
      (explicitState === "start" ||
        explicitState === "update" ||
        explicitState === "end")
    ) {
      const sequenceId = stringValue(payload, "sequenceId", "sequence");
      giftStreak = {
        streakId,
        lifecycle: explicitState,
        ...(sequenceId === undefined ? {} : { sequenceId }),
      };
    } else if (streakId !== undefined && repeatEnd === true) {
      const sequenceId = stringValue(payload, "sequenceId", "sequence");
      giftStreak = {
        streakId,
        lifecycle: "end",
        ...(sequenceId === undefined ? {} : { sequenceId }),
      };
    }
    return {
      ...base,
      kind: "gift",
      ...(giftStreak === undefined ? {} : { giftStreak }),
      rawPayload: {
        giftId: stringValue(payload, "giftId") ?? stringValue(gift, "id"),
        giftName:
          stringValue(payload, "giftName") ?? stringValue(gift, "name"),
        giftImage:
          nullableStringValue(payload, "giftImage") ??
          nullableStringValue(gift, "imageUrl"),
        diamondValue:
          numberValue(payload, "diamondValue", "diamondCount") ??
          numberValue(gift, "diamondValue", "diamondCount") ??
          null,
        repeatCount:
          numberValue(payload, "repeatCount", "repeat_count") ?? 1,
        totalCount:
          numberValue(payload, "totalCount", "repeatCount", "repeat_count") ??
          1,
        streakable:
          booleanValue(payload, "streakable") ??
          (giftType === undefined ? undefined : giftType === 1),
        sender,
      },
    };
  }

  if (kind === "follow") {
    return {
      ...base,
      kind: "follow",
      rawPayload: { sender },
    };
  }

  return {
    ...base,
    kind: "like",
    rawPayload: {
      likeCount: numberValue(payload, "likeCount", "count"),
      totalLikes:
        numberValue(payload, "totalLikes", "totalLikeCount", "total") ?? null,
      sender,
    },
  };
}

export class TikTokConnector implements LiveConnector {
  public readonly id: string;
  public readonly source = "tiktok" as const;

  private readonly clientFactory: TikTokProviderFactory;
  private readonly clock: () => string;
  private readonly retryDelaysMs: readonly number[];
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly eventListeners = new Set<EventListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly providerUnsubscribes: Unsubscribe[] = [];
  private status: ConnectionStatus = "disconnected";
  private configuredStreamer: string | null;
  private activeConfig: ConnectorConfig | null = null;
  private activeInfo: ConnectionInfo | null = null;
  private client: TikTokProviderClient | null = null;
  private destroyed = false;
  private manualDisconnect = false;
  private reconnecting = false;

  constructor(options: TikTokConnectorOptions) {
    this.clientFactory = options.clientFactory;
    this.configuredStreamer = options.streamerUniqueId ?? null;
    this.id = options.id ?? "tiktok_connector";
    this.clock = options.clock ?? (() => new Date().toISOString());
    this.retryDelaysMs = options.retryDelaysMs ?? [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];
    this.delay =
      options.delay ??
      ((milliseconds) =>
        new Promise((resolve) => {
          setTimeout(resolve, milliseconds);
        }));
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public async connect(config: ConnectorConfig = {}): Promise<ConnectionInfo> {
    if (this.destroyed) {
      throw new TikTokConnectorError("Cannot connect a destroyed TikTokConnector");
    }
    if (this.status === "connected" && this.activeInfo) return this.activeInfo;

    const streamer = config.streamerUniqueId ?? this.configuredStreamer;
    if (!streamer?.trim()) {
      throw new TikTokConnectorError(
        "streamerUniqueId is required to connect TikTokConnector"
      );
    }
    this.manualDisconnect = false;
    this.configuredStreamer = streamer.trim();
    this.activeConfig = {
      roomId: config.roomId ?? null,
      streamerUniqueId: this.configuredStreamer,
      options: config.options,
    };
    const previousClient = this.client;
    this.clearProviderListeners();
    this.client = null;
    this.activeInfo = null;
    if (previousClient) {
      try {
        await previousClient.disconnect();
      } catch (error) {
        this.safeNotifyError(
          this.wrapError(error, "TikTok provider cleanup failed")
        );
      }
    }
    return this.connectOnce(this.activeConfig, false);
  }

  public async disconnect(): Promise<void> {
    if (this.destroyed || this.status === "disconnected") return;
    this.manualDisconnect = true;
    const timestamp = this.readClockSafely();
    const client = this.client;
    this.clearProviderListeners();
    this.client = null;
    this.activeInfo = null;
    if (client) {
      try {
        await client.disconnect();
      } catch (error) {
        this.safeNotifyError(
          this.wrapError(error, "TikTok provider disconnect failed")
        );
      }
    }
    if (timestamp === null) {
      this.status = "disconnected";
    } else {
      this.setStatus("disconnected", timestamp);
    }
  }

  public async destroy(): Promise<void> {
    if (this.destroyed) return;
    try {
      await this.disconnect();
    } finally {
      this.destroyed = true;
      this.activeConfig = null;
      this.activeInfo = null;
      this.client = null;
      this.clearProviderListeners();
      this.eventListeners.clear();
      this.errorListeners.clear();
      this.statusListeners.clear();
      this.status = "disconnected";
    }
  }

  public onEvent(listener: EventListener): Unsubscribe {
    if (this.destroyed) return () => {};
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public onError(listener: ErrorListener): Unsubscribe {
    if (this.destroyed) return () => {};
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  public onStatus(listener: StatusListener): Unsubscribe {
    if (this.destroyed) return () => {};
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private async connectOnce(
    config: ConnectorConfig,
    reconnect: boolean
  ): Promise<ConnectionInfo> {
    const streamer = config.streamerUniqueId;
    if (!streamer) {
      throw new TikTokConnectorError("streamerUniqueId is required");
    }
    const timestamp = this.readClock();
    this.setStatus(reconnect ? "reconnecting" : "connecting", timestamp);
    try {
      const client = this.clientFactory(streamer);
      this.client = client;
      this.bindClient(client);
      const state = await client.connect(
        typeof config.roomId === "string" ? config.roomId : undefined
      );
      if (!state.roomId.trim()) {
        throw new TikTokConnectorError("Provider returned an empty roomId");
      }
      const connectedAt = this.readClock();
      this.setStatus("connected", connectedAt);
      const info: ConnectionInfo = {
        connectorId: this.id,
        source: this.source,
        status: "connected",
        roomId: state.roomId,
        streamerUniqueId: streamer,
        connectedAt,
      };
      this.activeInfo = info;
      return info;
    } catch (error) {
      this.clearProviderListeners();
      this.client = null;
      this.activeInfo = null;
      const wrapped = this.wrapError(error, "TikTok connection failed");
      this.safeNotifyError(wrapped);
      const failedAt = this.readClockSafely();
      if (failedAt === null) {
        this.status = "error";
      } else {
        this.setStatus("error", failedAt, wrapped.message);
      }
      throw wrapped;
    }
  }

  private bindClient(client: TikTokProviderClient): void {
    for (const kind of ["gift", "chat", "follow", "like"] as const) {
      this.providerUnsubscribes.push(
        client.on(kind, (payload) => this.handleProviderEvent(kind, payload))
      );
    }
    this.providerUnsubscribes.push(
      client.on("streamEnd", () => {
        if (this.destroyed || this.manualDisconnect) return;
        const timestamp = this.readClockSafely();
        if (timestamp === null) return;
        this.activeInfo = null;
        this.setStatus("ended", timestamp, "TikTok LIVE ended");
      }),
      client.on("disconnected", () => {
        if (this.destroyed || this.manualDisconnect || this.status === "ended") {
          return;
        }
        void this.reconnect();
      }),
      client.on("error", (error) => {
        this.safeNotifyError(this.wrapError(error, "TikTok provider error"));
      })
    );
  }

  private handleProviderEvent(
    kind: "gift" | "chat" | "follow" | "like",
    payload: unknown
  ): void {
    if (this.destroyed || this.status !== "connected" || !this.activeInfo) return;
    const occurredAt = this.readClockSafely();
    if (occurredAt === null) return;
    let event: RawConnectorEvent | null;
    try {
      event = mapTikTokProviderEvent(kind, payload, {
        roomId: this.activeInfo.roomId,
        streamerUniqueId: this.activeInfo.streamerUniqueId,
        occurredAt,
      });
    } catch (error) {
      this.safeNotifyError(
        this.wrapError(error, `Unable to map TikTok ${kind} payload`)
      );
      return;
    }
    if (!event) {
      this.safeNotifyError(
        new TikTokConnectorError(`Unsupported ${kind} provider payload`)
      );
      return;
    }
    for (const listener of Array.from(this.eventListeners)) {
      try {
        listener(event);
      } catch (error) {
        this.safeNotifyError(this.wrapError(error, "TikTok event listener failed"));
      }
    }
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting || !this.activeConfig) return;
    this.reconnecting = true;
    this.activeInfo = null;
    this.clearProviderListeners();
    this.client = null;
    try {
      for (const retryDelay of this.retryDelaysMs) {
        if (this.destroyed || this.manualDisconnect || !this.activeConfig) return;
        const timestamp = this.readClockSafely();
        if (timestamp !== null) this.setStatus("reconnecting", timestamp);
        await this.delay(retryDelay);
        if (this.destroyed || this.manualDisconnect || !this.activeConfig) {
          return;
        }
        try {
          await this.connectOnce(this.activeConfig, true);
          return;
        } catch {
          // The next configured attempt remains bounded and deterministic.
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private readClock(): string {
    let value: string;
    try {
      value = this.clock();
    } catch (error) {
      throw this.wrapError(error, "TikTok connector clock failed");
    }
    if (!IsoDateTimeSchema.safeParse(value).success) {
      throw new TikTokConnectorError("TikTok connector clock returned an invalid timestamp");
    }
    return value;
  }

  private readClockSafely(): string | null {
    try {
      return this.readClock();
    } catch (error) {
      this.safeNotifyError(this.wrapError(error, "TikTok connector clock failed"));
      return null;
    }
  }

  private setStatus(
    status: ConnectionStatus,
    timestamp: string,
    reason?: string
  ): void {
    this.status = status;
    const message: ConnectionStatusMessage = { status, timestamp, reason };
    for (const listener of Array.from(this.statusListeners)) {
      try {
        listener(message);
      } catch (error) {
        this.safeNotifyError(this.wrapError(error, "TikTok status listener failed"));
      }
    }
  }

  private safeNotifyError(error: Error): void {
    for (const listener of Array.from(this.errorListeners)) {
      try {
        listener(error);
      } catch {
        // Error observers are isolated and never recursively notified.
      }
    }
  }

  private wrapError(error: unknown, prefix: string): TikTokConnectorError {
    if (error instanceof TikTokConnectorError) return error;
    const detail = error instanceof Error ? error.message : String(error);
    return new TikTokConnectorError(`${prefix}: ${detail}`);
  }

  private clearProviderListeners(): void {
    for (const unsubscribe of this.providerUnsubscribes.splice(0)) {
      try {
        unsubscribe();
      } catch {
        // Provider cleanup is best effort; local listener ownership is cleared.
      }
    }
  }
}
