import type {
  ConnectionInfo,
  ConnectionStatus,
  ConnectionStatusMessage,
  ConnectorConfig,
  ErrorListener,
  GiftStreakEvidence,
  EventListener,
  LiveConnector,
  RawConnectorEvent,
  StatusListener,
  Unsubscribe,
} from "@crowdcircuit/connector-core";
import { IsoDateTimeSchema } from "@crowdcircuit/contracts";

export const CONNECTOR_MOCK_VERSION = "0.1.0" as const;

/**
 * Error thrown when input validation fails on MockConnector.
 * Includes caller payload validation failures, malformed timestamps, or invalid state transitions.
 * Caller validation failures throw directly and do not notify onError listeners.
 */
export class MockConnectorInputError extends Error {
  public readonly code = "MOCK_CONNECTOR_INPUT_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "MockConnectorInputError";
    Object.setPrototypeOf(this, MockConnectorInputError.prototype);
  }
}

export interface MockSenderOptions {
  userId?: string | null;
  uniqueId?: string | null;
  nickname?: string;
  avatarUrl?: string | null;
  roles?: string[];
}

export interface MockGiftOptions {
  giftId?: string;
  giftName?: string;
  giftImage?: string | null;
  diamondValue?: number | null;
  repeatCount?: number;
  totalCount?: number;
  streakable?: boolean;
  sender?: MockSenderOptions;
  roomId?: string | null;
  streamerUniqueId?: string;
  occurredAt?: string;
  connectorEventId?: string;
  sequenceId?: string;
  giftStreak?: GiftStreakEvidence;
}

export interface MockCommentOptions {
  commentText?: string;
  sender?: MockSenderOptions;
  roomId?: string | null;
  streamerUniqueId?: string;
  occurredAt?: string;
  connectorEventId?: string;
  sequenceId?: string;
}

export interface MockFollowOptions {
  sender?: MockSenderOptions;
  roomId?: string | null;
  streamerUniqueId?: string;
  occurredAt?: string;
  connectorEventId?: string;
  sequenceId?: string;
}

export interface MockLikeOptions {
  likeCount?: number;
  totalLikes?: number | null;
  sender?: MockSenderOptions;
  roomId?: string | null;
  streamerUniqueId?: string;
  occurredAt?: string;
  connectorEventId?: string;
  sequenceId?: string;
}

export interface MockConnectorOptions {
  id?: string;
  roomId?: string | null;
  streamerUniqueId?: string;
  clock?: () => string;
}

/**
 * Safely clones raw values defensively without assertions, prototype pollution, or lossy JSON serialization.
 * Accepts JSON-safe primitives, dense arrays, plain objects with Object.prototype, and null-prototype objects.
 * Rejects undefined, BigInt, symbol values, functions, NaN, Infinity, sparse arrays, accessors/getters/setters,
 * non-plain object instances, cyclic graphs, and dangerous keys (__proto__, constructor, prototype).
 * Handles acyclic repeated shared references deterministically using memoization.
 */
function cloneRawValueInternal(
  val: unknown,
  activePath: WeakSet<object>,
  memo: WeakMap<object, object>
): unknown {
  if (val === null) {
    return null;
  }
  if (val === undefined) {
    throw new MockConnectorInputError("Unsupported undefined value in raw payload");
  }
  const valType = typeof val;
  if (valType === "boolean" || valType === "string") {
    return val;
  }
  if (valType === "number") {
    if (!Number.isFinite(val)) {
      throw new MockConnectorInputError(`Unsupported raw payload number: ${val}`);
    }
    return val;
  }
  if (valType === "bigint" || valType === "symbol" || valType === "function") {
    throw new MockConnectorInputError(`Unsupported raw payload value of type '${valType}'`);
  }

  if (valType === "object") {
    const obj = val;

    // 1. Check for true recursion cycle
    if (activePath.has(obj)) {
      throw new MockConnectorInputError("Cannot clone cyclic raw payload object");
    }

    // 2. Check memo for already cloned shared reference
    const cachedClone = memo.get(obj);
    if (cachedClone !== undefined) {
      return cachedClone;
    }

    // 3. Dense Array Check & Clone
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const desc = Object.getOwnPropertyDescriptor(obj, String(i));
        if (!desc) {
          throw new MockConnectorInputError("Unsupported sparse array in raw payload");
        }
      }

      activePath.add(obj);
      const arrCopy: unknown[] = [];
      memo.set(obj, arrCopy);

      try {
        for (let i = 0; i < obj.length; i++) {
          const desc = Object.getOwnPropertyDescriptor(obj, String(i));
          if (!desc || desc.get !== undefined || desc.set !== undefined) {
            throw new MockConnectorInputError("Unsupported accessor property in raw array");
          }
          arrCopy.push(cloneRawValueInternal(desc.value, activePath, memo));
        }
      } finally {
        activePath.delete(obj);
      }
      return arrCopy;
    }

    // 4. Plain Object Prototype Check
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      throw new MockConnectorInputError("Unsupported non-plain object container in raw payload");
    }

    // 5. Inspect Own Property Descriptors without invoking accessors
    const keys = Reflect.ownKeys(obj);
    activePath.add(obj);
    const objCopy: Record<string, unknown> = Object.create(proto);
    memo.set(obj, objCopy);

    try {
      for (const key of keys) {
        if (typeof key === "symbol") {
          throw new MockConnectorInputError("Unsupported symbol property key in raw payload");
        }
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          throw new MockConnectorInputError(`Dangerous property key '${key}' is not allowed in raw payload`);
        }

        const desc = Object.getOwnPropertyDescriptor(obj, key);
        if (!desc) {
          throw new MockConnectorInputError(`Property descriptor missing for key '${String(key)}'`);
        }
        if (desc.get !== undefined || desc.set !== undefined) {
          throw new MockConnectorInputError(`Unsupported accessor property '${String(key)}' in raw payload`);
        }

        const propVal = desc.value;
        objCopy[key] = cloneRawValueInternal(propVal, activePath, memo);
      }
    } finally {
      activePath.delete(obj);
    }
    return objCopy;
  }

  throw new MockConnectorInputError(`Unsupported raw payload value of type '${valType}'`);
}

/**
 * Contains every reflection or proxy failure behind the public input-error
 * boundary while preserving deliberate validation failures.
 */
function cloneRawValue(val: unknown): unknown {
  try {
    return cloneRawValueInternal(
      val,
      new WeakSet<object>(),
      new WeakMap<object, object>()
    );
  } catch (error) {
    if (error instanceof MockConnectorInputError) {
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new MockConnectorInputError(
      `Unable to inspect raw payload safely: ${detail}`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneOptionRecord(
  value: unknown,
  label: string
): Record<string, unknown> {
  const cloned = cloneRawValue(value);
  if (!isRecord(cloned)) {
    throw new MockConnectorInputError(`${label} must be a plain object`);
  }
  return cloned;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
  label: string
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new MockConnectorInputError(`${label}.${key} must be a string`);
  }
  return value;
}

function readOptionalNullableString(
  record: Record<string, unknown>,
  key: string,
  label: string
): string | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") {
    throw new MockConnectorInputError(
      `${label}.${key} must be a string or null`
    );
  }
  return value;
}

function readOptionalNumber(
  record: Record<string, unknown>,
  key: string,
  label: string
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MockConnectorInputError(
      `${label}.${key} must be a finite number`
    );
  }
  return value;
}

function readOptionalNullableNumber(
  record: Record<string, unknown>,
  key: string,
  label: string
): number | null | undefined {
  const value = record[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MockConnectorInputError(
      `${label}.${key} must be a finite number or null`
    );
  }
  return value;
}

function readOptionalBoolean(
  record: Record<string, unknown>,
  key: string,
  label: string
): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new MockConnectorInputError(`${label}.${key} must be a boolean`);
  }
  return value;
}

function readOptionalIdentityFields(
  record: Record<string, unknown>,
  label: string
): { connectorEventId?: string; sequenceId?: string } {
  const connectorEventId = readOptionalString(record, "connectorEventId", label);
  const sequenceId = readOptionalString(record, "sequenceId", label);
  return {
    ...(connectorEventId === undefined ? {} : { connectorEventId }),
    ...(sequenceId === undefined ? {} : { sequenceId }),
  };
}

function readOptionalGiftStreak(
  record: Record<string, unknown>,
  label: string
): GiftStreakEvidence | undefined {
  const value = record.giftStreak;
  if (value === undefined) return undefined;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new MockConnectorInputError(`${label}.giftStreak must be a plain object`);
  }
  const streakId = Reflect.get(value, "streakId");
  const lifecycle = Reflect.get(value, "lifecycle");
  const sequenceId = Reflect.get(value, "sequenceId");
  if (typeof streakId !== "string" || streakId.length === 0) {
    throw new MockConnectorInputError(`${label}.giftStreak.streakId must be a non-empty string`);
  }
  if (lifecycle !== "start" && lifecycle !== "update" && lifecycle !== "end") {
    throw new MockConnectorInputError(`${label}.giftStreak.lifecycle is invalid`);
  }
  if (sequenceId !== undefined && (typeof sequenceId !== "string" || sequenceId.length === 0)) {
    throw new MockConnectorInputError(`${label}.giftStreak.sequenceId must be a non-empty string`);
  }
  return {
    streakId,
    lifecycle,
    ...(sequenceId === undefined ? {} : { sequenceId }),
  };
}

function sanitizeRawIdentity(
  value: unknown
): RawConnectorEvent["identity"] | undefined {
  if (value === undefined) return undefined;
  const record = cloneOptionRecord(value, "RawConnectorEvent.identity");
  const identity = readOptionalIdentityFields(
    record,
    "RawConnectorEvent.identity"
  );
  if (
    identity.connectorEventId === undefined &&
    identity.sequenceId === undefined
  ) {
    throw new MockConnectorInputError(
      "RawConnectorEvent.identity must contain connectorEventId or sequenceId"
    );
  }
  return identity;
}

function sanitizeRawGiftStreak(value: unknown): GiftStreakEvidence | undefined {
  if (value === undefined) return undefined;
  return readOptionalGiftStreak(
    { giftStreak: cloneRawValue(value) },
    "RawConnectorEvent"
  );
}

function readOptionalSender(
  record: Record<string, unknown>,
  label: string
): MockSenderOptions | undefined {
  const value = record.sender;
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new MockConnectorInputError(`${label}.sender must be a plain object`);
  }

  const sender: MockSenderOptions = {};
  const userId = readOptionalNullableString(value, "userId", `${label}.sender`);
  const uniqueId = readOptionalNullableString(
    value,
    "uniqueId",
    `${label}.sender`
  );
  const nickname = readOptionalString(value, "nickname", `${label}.sender`);
  const avatarUrl = readOptionalNullableString(
    value,
    "avatarUrl",
    `${label}.sender`
  );
  const roles = value.roles;

  if (userId !== undefined) sender.userId = userId;
  if (uniqueId !== undefined) sender.uniqueId = uniqueId;
  if (nickname !== undefined) sender.nickname = nickname;
  if (avatarUrl !== undefined) sender.avatarUrl = avatarUrl;
  if (roles !== undefined) {
    if (
      !Array.isArray(roles) ||
      !roles.every((role) => typeof role === "string")
    ) {
      throw new MockConnectorInputError(
        `${label}.sender.roles must be an array of strings`
      );
    }
    sender.roles = [...roles];
  }

  return sender;
}

function sanitizeGiftOptions(value: unknown): MockGiftOptions {
  const record = cloneOptionRecord(value, "MockGiftOptions");
  const result: MockGiftOptions = {};
  const giftId = readOptionalString(record, "giftId", "MockGiftOptions");
  const giftName = readOptionalString(record, "giftName", "MockGiftOptions");
  const giftImage = readOptionalNullableString(
    record,
    "giftImage",
    "MockGiftOptions"
  );
  const diamondValue = readOptionalNullableNumber(
    record,
    "diamondValue",
    "MockGiftOptions"
  );
  const repeatCount = readOptionalNumber(
    record,
    "repeatCount",
    "MockGiftOptions"
  );
  const totalCount = readOptionalNumber(
    record,
    "totalCount",
    "MockGiftOptions"
  );
  const streakable = readOptionalBoolean(
    record,
    "streakable",
    "MockGiftOptions"
  );
  const sender = readOptionalSender(record, "MockGiftOptions");
  const roomId = readOptionalNullableString(
    record,
    "roomId",
    "MockGiftOptions"
  );
  const streamerUniqueId = readOptionalString(
    record,
    "streamerUniqueId",
    "MockGiftOptions"
  );
  const occurredAt = readOptionalString(
    record,
    "occurredAt",
    "MockGiftOptions"
  );
  const identity = readOptionalIdentityFields(record, "MockGiftOptions");
  const giftStreak = readOptionalGiftStreak(record, "MockGiftOptions");

  if (giftId !== undefined) result.giftId = giftId;
  if (giftName !== undefined) result.giftName = giftName;
  if (giftImage !== undefined) result.giftImage = giftImage;
  if (diamondValue !== undefined) result.diamondValue = diamondValue;
  if (repeatCount !== undefined) result.repeatCount = repeatCount;
  if (totalCount !== undefined) result.totalCount = totalCount;
  if (streakable !== undefined) result.streakable = streakable;
  if (sender !== undefined) result.sender = sender;
  if (roomId !== undefined) result.roomId = roomId;
  if (streamerUniqueId !== undefined) {
    result.streamerUniqueId = streamerUniqueId;
  }
  if (occurredAt !== undefined) result.occurredAt = occurredAt;
  Object.assign(result, identity);
  if (giftStreak !== undefined) result.giftStreak = giftStreak;
  return result;
}

function sanitizeCommentOptions(value: unknown): MockCommentOptions {
  const record = cloneOptionRecord(value, "MockCommentOptions");
  const result: MockCommentOptions = {};
  const commentText = readOptionalString(
    record,
    "commentText",
    "MockCommentOptions"
  );
  const sender = readOptionalSender(record, "MockCommentOptions");
  const roomId = readOptionalNullableString(
    record,
    "roomId",
    "MockCommentOptions"
  );
  const streamerUniqueId = readOptionalString(
    record,
    "streamerUniqueId",
    "MockCommentOptions"
  );
  const occurredAt = readOptionalString(
    record,
    "occurredAt",
    "MockCommentOptions"
  );
  const identity = readOptionalIdentityFields(record, "MockCommentOptions");

  if (commentText !== undefined) result.commentText = commentText;
  if (sender !== undefined) result.sender = sender;
  if (roomId !== undefined) result.roomId = roomId;
  if (streamerUniqueId !== undefined) {
    result.streamerUniqueId = streamerUniqueId;
  }
  if (occurredAt !== undefined) result.occurredAt = occurredAt;
  Object.assign(result, identity);
  return result;
}

function sanitizeFollowOptions(value: unknown): MockFollowOptions {
  const record = cloneOptionRecord(value, "MockFollowOptions");
  const result: MockFollowOptions = {};
  const sender = readOptionalSender(record, "MockFollowOptions");
  const roomId = readOptionalNullableString(
    record,
    "roomId",
    "MockFollowOptions"
  );
  const streamerUniqueId = readOptionalString(
    record,
    "streamerUniqueId",
    "MockFollowOptions"
  );
  const occurredAt = readOptionalString(
    record,
    "occurredAt",
    "MockFollowOptions"
  );
  const identity = readOptionalIdentityFields(record, "MockFollowOptions");

  if (sender !== undefined) result.sender = sender;
  if (roomId !== undefined) result.roomId = roomId;
  if (streamerUniqueId !== undefined) {
    result.streamerUniqueId = streamerUniqueId;
  }
  if (occurredAt !== undefined) result.occurredAt = occurredAt;
  Object.assign(result, identity);
  return result;
}

function sanitizeLikeOptions(value: unknown): MockLikeOptions {
  const record = cloneOptionRecord(value, "MockLikeOptions");
  const result: MockLikeOptions = {};
  const likeCount = readOptionalNumber(
    record,
    "likeCount",
    "MockLikeOptions"
  );
  const totalLikes = readOptionalNullableNumber(
    record,
    "totalLikes",
    "MockLikeOptions"
  );
  const sender = readOptionalSender(record, "MockLikeOptions");
  const roomId = readOptionalNullableString(
    record,
    "roomId",
    "MockLikeOptions"
  );
  const streamerUniqueId = readOptionalString(
    record,
    "streamerUniqueId",
    "MockLikeOptions"
  );
  const occurredAt = readOptionalString(
    record,
    "occurredAt",
    "MockLikeOptions"
  );
  const identity = readOptionalIdentityFields(record, "MockLikeOptions");

  if (likeCount !== undefined) result.likeCount = likeCount;
  if (totalLikes !== undefined) result.totalLikes = totalLikes;
  if (sender !== undefined) result.sender = sender;
  if (roomId !== undefined) result.roomId = roomId;
  if (streamerUniqueId !== undefined) {
    result.streamerUniqueId = streamerUniqueId;
  }
  if (occurredAt !== undefined) result.occurredAt = occurredAt;
  Object.assign(result, identity);
  return result;
}

/**
 * Deterministic mock connector for development and unit testing.
 * Produces mock gift, comment, follow, and like raw input events.
 */
export class MockConnector implements LiveConnector {
  public readonly id: string;
  public readonly source = "mock" as const;

  private roomId: string | null;
  private streamerUniqueId: string;
  private status: ConnectionStatus = "disconnected";
  private isDestroyed = false;
  private clock: () => string;
  private activeConnectionInfo: ConnectionInfo | null = null;

  private eventListeners = new Set<EventListener>();
  private errorListeners = new Set<ErrorListener>();
  private statusListeners = new Set<StatusListener>();

  constructor(options: MockConnectorOptions = {}) {
    this.id = options.id ?? "mock_connector_001";
    this.roomId = options.roomId !== undefined ? options.roomId : "room_mock_001";
    this.streamerUniqueId = options.streamerUniqueId ?? "streamer_mock_001";
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  private readClock(): string {
    let timeStr: string;
    try {
      timeStr = this.clock();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MockConnectorInputError(`Clock read failed: ${msg}`);
    }
    if (typeof timeStr !== "string" || !IsoDateTimeSchema.safeParse(timeStr).success) {
      throw new MockConnectorInputError(`Invalid clock output '${String(timeStr)}': must be a valid ISO 8601 UTC datetime string`);
    }
    return timeStr;
  }

  public async connect(config?: ConnectorConfig): Promise<ConnectionInfo> {
    if (this.isDestroyed) {
      throw new MockConnectorInputError("Cannot connect a destroyed MockConnector");
    }

    if (this.status === "connected" && this.activeConnectionInfo) {
      return this.activeConnectionInfo;
    }

    // Read and validate clock BEFORE mutating status
    const connectedAt = this.readClock();

    if (config) {
      if (config.roomId !== undefined) {
        this.roomId = config.roomId;
      }
      if (config.streamerUniqueId !== undefined) {
        this.streamerUniqueId = config.streamerUniqueId;
      }
    }

    this.setStatus("connecting", connectedAt);
    this.setStatus("connected", connectedAt);

    this.activeConnectionInfo = {
      connectorId: this.id,
      source: this.source,
      status: this.status,
      roomId: this.roomId,
      streamerUniqueId: this.streamerUniqueId,
      connectedAt,
    };

    return this.activeConnectionInfo;
  }

  public async disconnect(): Promise<void> {
    if (this.isDestroyed || this.status === "disconnected") {
      return;
    }
    const timestamp = this.readClock();
    this.activeConnectionInfo = null;
    this.setStatus("disconnected", timestamp);
  }

  public async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    this.isDestroyed = true;
    let timestamp: string | null = null;
    try {
      if (this.status !== "disconnected") {
        timestamp = this.readClock();
      }
    } catch {
      // Clock failure during destroy: omit final status notification rather than inventing a timestamp
      timestamp = null;
    } finally {
      const prevStatus = this.status;
      this.status = "disconnected";
      this.activeConnectionInfo = null;
      if (timestamp !== null && prevStatus !== "disconnected") {
        const message: ConnectionStatusMessage = {
          status: "disconnected",
          timestamp,
        };
        const listenersCopy = Array.from(this.statusListeners);
        for (const listener of listenersCopy) {
          try {
            listener(message);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.safeNotifyError(error);
          }
        }
      }
      this.eventListeners.clear();
      this.errorListeners.clear();
      this.statusListeners.clear();
    }
  }

  public onEvent(listener: EventListener): Unsubscribe {
    if (this.isDestroyed) {
      return () => {};
    }
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public onError(listener: ErrorListener): Unsubscribe {
    if (this.isDestroyed) {
      return () => {};
    }
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  public onStatus(listener: StatusListener): Unsubscribe {
    if (this.isDestroyed) {
      return () => {};
    }
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Directly emits a raw connector event to all subscribed event listeners if connected.
   *
   * @param event - The raw connector event to emit.
   * @throws {MockConnectorInputError} Thrown when:
   *  - The connector is destroyed or not connected.
   *  - Caller-supplied `occurredAt` or clock-generated timestamp is invalid.
   *  - `rawPayload` contains unsupported data types (undefined, BigInt, symbol, function, NaN, Infinity, sparse arrays, accessors/getters/setters, non-plain object instances, cyclic graphs, or dangerous keys like __proto__, constructor, prototype).
   *
   * On failure:
   *  - No partial event is delivered to event listeners.
   *  - Connector lifecycle state remains unchanged.
   *  - `onError` observers are NOT notified (caller validation errors throw directly; `onError` is reserved for runtime observer errors).
   */
  public emitMockEvent(event: RawConnectorEvent): void {
    if (this.isDestroyed) {
      throw new MockConnectorInputError("Cannot emit event on a destroyed MockConnector");
    }
    if (this.status !== "connected") {
      throw new MockConnectorInputError("MockConnector is not connected");
    }

    // Validate occurredAt timestamp
    let occurredAt: string;
    if (event.occurredAt !== undefined) {
      if (typeof event.occurredAt !== "string" || !IsoDateTimeSchema.safeParse(event.occurredAt).success) {
        throw new MockConnectorInputError(`Invalid supplied occurredAt timestamp '${String(event.occurredAt)}': must be a valid ISO 8601 UTC datetime string`);
      }
      occurredAt = event.occurredAt;
    } else {
      occurredAt = this.readClock();
    }

    // Safe assertion-free cloning of raw payload
    const clonedPayload = cloneRawValue(event.rawPayload);
    const identity = sanitizeRawIdentity(event.identity);
    const giftStreak = sanitizeRawGiftStreak(event.giftStreak);

    const eventCopy: RawConnectorEvent = {
      kind: event.kind,
      source: event.source,
      roomId: event.roomId ?? null,
      streamerUniqueId: event.streamerUniqueId,
      occurredAt,
      ...(identity === undefined ? {} : { identity }),
      ...(giftStreak === undefined ? {} : { giftStreak }),
      rawPayload: clonedPayload,
    };

    const listenersCopy = Array.from(this.eventListeners);
    for (const listener of listenersCopy) {
      try {
        listener(eventCopy);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.safeNotifyError(error);
      }
    }
  }

  /**
   * Directly emits an error to all subscribed error listeners without recursive loops.
   */
  public emitMockError(error: Error): void {
    if (this.isDestroyed) {
      return;
    }
    this.safeNotifyError(error);
  }

  /**
   * Generates and emits a mock gift raw event with defensive copies.
   */
  public emitMockGift(options: MockGiftOptions = {}): RawConnectorEvent {
    const safeOptions = sanitizeGiftOptions(options);
    const defaultSender: MockSenderOptions = {
      userId: "usr_mock_001",
      uniqueId: "viewer_mock_001",
      nickname: "Mock Viewer",
      avatarUrl: "https://example.com/avatar.jpg",
      roles: ["viewer"],
    };

    const senderCloned = safeOptions.sender ?? defaultSender;

    const event: RawConnectorEvent = {
      kind: "gift",
      source: "mock",
      roomId:
        safeOptions.roomId !== undefined ? safeOptions.roomId : this.roomId,
      streamerUniqueId:
        safeOptions.streamerUniqueId ?? this.streamerUniqueId,
      occurredAt: safeOptions.occurredAt,
      ...((safeOptions.connectorEventId === undefined &&
      safeOptions.sequenceId === undefined)
        ? {}
        : {
            identity: {
              ...(safeOptions.connectorEventId === undefined
                ? {}
                : { connectorEventId: safeOptions.connectorEventId }),
              ...(safeOptions.sequenceId === undefined
                ? {}
                : { sequenceId: safeOptions.sequenceId }),
            },
          }),
      ...(safeOptions.giftStreak === undefined
        ? {}
        : { giftStreak: safeOptions.giftStreak }),
      rawPayload: {
        giftId: safeOptions.giftId ?? "gift_rose",
        giftName: safeOptions.giftName ?? "Rose",
        giftImage:
          safeOptions.giftImage !== undefined
            ? safeOptions.giftImage
            : "https://example.com/rose.png",
        diamondValue:
          safeOptions.diamondValue !== undefined
            ? safeOptions.diamondValue
            : 10,
        repeatCount: safeOptions.repeatCount ?? 1,
        totalCount: safeOptions.totalCount ?? 1,
        streakable:
          safeOptions.streakable !== undefined ? safeOptions.streakable : true,
        sender: senderCloned,
      },
    };

    this.emitMockEvent(event);
    return event;
  }

  /**
   * Generates and emits a mock comment raw event with defensive copies.
   */
  public emitMockComment(options: MockCommentOptions = {}): RawConnectorEvent {
    const safeOptions = sanitizeCommentOptions(options);
    const defaultSender: MockSenderOptions = {
      userId: "usr_mock_001",
      uniqueId: "viewer_mock_001",
      nickname: "Mock Viewer",
      avatarUrl: "https://example.com/avatar.jpg",
      roles: ["viewer"],
    };

    const senderCloned = safeOptions.sender ?? defaultSender;

    const event: RawConnectorEvent = {
      kind: "chat",
      source: "mock",
      roomId:
        safeOptions.roomId !== undefined ? safeOptions.roomId : this.roomId,
      streamerUniqueId:
        safeOptions.streamerUniqueId ?? this.streamerUniqueId,
      occurredAt: safeOptions.occurredAt,
      ...((safeOptions.connectorEventId === undefined &&
      safeOptions.sequenceId === undefined)
        ? {}
        : {
            identity: {
              ...(safeOptions.connectorEventId === undefined
                ? {}
                : { connectorEventId: safeOptions.connectorEventId }),
              ...(safeOptions.sequenceId === undefined
                ? {}
                : { sequenceId: safeOptions.sequenceId }),
            },
          }),
      rawPayload: {
        commentText: safeOptions.commentText ?? "Hello CrowdCircuit!",
        sender: senderCloned,
      },
    };

    this.emitMockEvent(event);
    return event;
  }

  /**
   * Generates and emits a mock follow raw event with defensive copies.
   */
  public emitMockFollow(options: MockFollowOptions = {}): RawConnectorEvent {
    const safeOptions = sanitizeFollowOptions(options);
    const defaultSender: MockSenderOptions = {
      userId: "usr_mock_001",
      uniqueId: "viewer_mock_001",
      nickname: "Mock Viewer",
      avatarUrl: "https://example.com/follower_mock.jpg",
      roles: ["follower"],
    };

    const senderCloned = safeOptions.sender ?? defaultSender;

    const event: RawConnectorEvent = {
      kind: "follow",
      source: "mock",
      roomId:
        safeOptions.roomId !== undefined ? safeOptions.roomId : this.roomId,
      streamerUniqueId:
        safeOptions.streamerUniqueId ?? this.streamerUniqueId,
      occurredAt: safeOptions.occurredAt,
      ...((safeOptions.connectorEventId === undefined &&
      safeOptions.sequenceId === undefined)
        ? {}
        : {
            identity: {
              ...(safeOptions.connectorEventId === undefined
                ? {}
                : { connectorEventId: safeOptions.connectorEventId }),
              ...(safeOptions.sequenceId === undefined
                ? {}
                : { sequenceId: safeOptions.sequenceId }),
            },
          }),
      rawPayload: {
        sender: senderCloned,
      },
    };

    this.emitMockEvent(event);
    return event;
  }

  /**
   * Generates and emits a mock like raw event with defensive copies.
   */
  public emitMockLike(options: MockLikeOptions = {}): RawConnectorEvent {
    const safeOptions = sanitizeLikeOptions(options);
    const defaultSender: MockSenderOptions = {
      userId: "usr_mock_001",
      uniqueId: "viewer_mock_001",
      nickname: "Mock Viewer",
      avatarUrl: "https://example.com/avatar.jpg",
      roles: ["viewer"],
    };

    const senderCloned = safeOptions.sender ?? defaultSender;

    const event: RawConnectorEvent = {
      kind: "like",
      source: "mock",
      roomId:
        safeOptions.roomId !== undefined ? safeOptions.roomId : this.roomId,
      streamerUniqueId:
        safeOptions.streamerUniqueId ?? this.streamerUniqueId,
      occurredAt: safeOptions.occurredAt,
      ...((safeOptions.connectorEventId === undefined &&
      safeOptions.sequenceId === undefined)
        ? {}
        : {
            identity: {
              ...(safeOptions.connectorEventId === undefined
                ? {}
                : { connectorEventId: safeOptions.connectorEventId }),
              ...(safeOptions.sequenceId === undefined
                ? {}
                : { sequenceId: safeOptions.sequenceId }),
            },
          }),
      rawPayload: {
        likeCount: safeOptions.likeCount ?? 50,
        totalLikes:
          safeOptions.totalLikes !== undefined ? safeOptions.totalLikes : 1000,
        sender: senderCloned,
      },
    };

    this.emitMockEvent(event);
    return event;
  }

  /**
   * Emits a live stream-ended status.
   */
  public emitMockStreamEnded(reason = "Stream ended by host"): void {
    if (this.isDestroyed) {
      throw new MockConnectorInputError("Cannot emit stream ended on a destroyed MockConnector");
    }
    if (this.status === "ended") {
      return;
    }
    if (this.status !== "connected") {
      throw new MockConnectorInputError("MockConnector must be connected to emit stream ended");
    }

    const timestamp = this.readClock();
    this.setStatus("ended", timestamp, reason);
  }

  private setStatus(newStatus: ConnectionStatus, timestamp: string, reason?: string): void {
    this.status = newStatus;
    const message: ConnectionStatusMessage = {
      status: newStatus,
      timestamp,
      reason,
    };
    const listenersCopy = Array.from(this.statusListeners);
    for (const listener of listenersCopy) {
      try {
        listener(message);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.safeNotifyError(error);
      }
    }
  }

  private safeNotifyError(error: Error): void {
    const listenersCopy = Array.from(this.errorListeners);
    for (const listener of listenersCopy) {
      try {
        listener(error);
      } catch {
        // Prevent recursive error-listener exception dispatch
      }
    }
  }
}
