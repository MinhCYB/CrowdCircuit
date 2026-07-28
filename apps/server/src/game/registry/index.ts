import { randomBytes } from "node:crypto";
import type {
  AuthenticatedClientIdentity,
  ConnectionGeneration,
  GameConnectionSendResult,
  GameRegistrationInput,
  GameRegistrationOutcome,
  GameSessionDeliveryPort,
  GameSessionIdentity,
  GameSessionRegistryReadPort,
  GameSessionSendFence,
  GameSessionSendResult,
  RegisteredGameSessionSnapshot,
  ServerRuntimeGeneration,
  SessionLookupQuery,
  SessionLookupResult,
} from "../ports.js";
import type { GameActionDeliveryMessage } from "@crowdcircuit/contracts";

export const GAME_SESSION_LIMITS = {
  maxTotal: 256,
  maxPerClient: 4,
  maxSweep: 128,
  heartbeatIntervalMs: 10_000,
  staleAfterMs: 30_000,
} as const;

export interface GameConnectionHandle {
  readonly id: string;
  disconnect(reason: "SESSION_REPLACED" | "SESSION_STALE" | "SERVER_SHUTDOWN"): void;
  sendAction(message: GameActionDeliveryMessage): GameConnectionSendResult;
}

interface RegistryEntry
  extends Omit<RegisteredGameSessionSnapshot, "lastHeartbeatAt"> {
  lastHeartbeatAt: number;
  readonly authExpiresAt: number;
  readonly authFingerprint: string;
  readonly protocolVersion: string;
  readonly handle: GameConnectionHandle;
}

export interface RegisterLiveSessionInput extends GameRegistrationInput {
  readonly specVersion: string;
  readonly authExpiresAt: number;
  readonly authFingerprint: string;
  readonly handle: GameConnectionHandle;
}

export type LiveRegistrationOutcome =
  | (Extract<GameRegistrationOutcome, { status: "registered" }> & {
      readonly session: RegisteredGameSessionSnapshot;
      readonly replaced: GameConnectionHandle | null;
    })
  | Extract<GameRegistrationOutcome, { status: "rejected" }>;

function validPositiveSafe(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export class GameSessionRegistry
  implements GameSessionRegistryReadPort, GameSessionDeliveryPort
{
  readonly #entries = new Map<string, RegistryEntry>();
  readonly #clock: () => number;
  readonly #runtimeGeneration: ServerRuntimeGeneration;
  #nextConnectionGeneration = 0;
  #closed = false;

  constructor(options: {
    readonly clock?: () => number;
    readonly runtimeGeneration?: ServerRuntimeGeneration;
  } = {}) {
    this.#clock = options.clock ?? Date.now;
    this.#runtimeGeneration =
      options.runtimeGeneration ?? randomBytes(16).toString("hex");
  }

  get runtimeGeneration(): ServerRuntimeGeneration {
    return this.#runtimeGeneration;
  }

  registerLiveSession(
    identity: AuthenticatedClientIdentity,
    input: RegisterLiveSessionInput,
  ): LiveRegistrationOutcome {
    if (this.#closed) return this.#rejected("SESSION_STALE");
    const now = this.#now();
    const key = this.#key(input.gameId, input.instanceId);
    const current = this.#entries.get(key);
    if (current !== undefined && current.clientId !== identity.clientId) {
      return this.#rejected("INSTANCE_OWNED_BY_OTHER_CLIENT");
    }
    if (current === undefined) {
      if (this.#entries.size >= GAME_SESSION_LIMITS.maxTotal) {
        return this.#rejected("SESSION_CAPACITY");
      }
      if (this.listSessionsForClient(identity.clientId).length >= GAME_SESSION_LIMITS.maxPerClient) {
        return this.#rejected("SESSION_CAPACITY");
      }
    }
    const connectionGeneration = this.#allocateGeneration();
    const entry: RegistryEntry = {
      clientId: identity.clientId,
      gameId: input.gameId,
      gameInstanceId: input.instanceId,
      serverRuntimeGeneration: this.#runtimeGeneration,
      connectionGeneration,
      registeredAt: now,
      lastHeartbeatAt: now,
      sdkVersion: input.sdkVersion,
      authExpiresAt: input.authExpiresAt,
      authFingerprint: input.authFingerprint,
      protocolVersion: input.specVersion,
      handle: input.handle,
    };
    this.#entries.set(key, entry);
    return {
      status: "registered",
      sessionGeneration: connectionGeneration,
      heartbeatIntervalMs: GAME_SESSION_LIMITS.heartbeatIntervalMs,
      session: this.#snapshot(entry),
      replaced: current?.handle ?? null,
    };
  }

  lookupDestination(query: SessionLookupQuery): Promise<SessionLookupResult> {
    if (this.#closed) return Promise.resolve({ status: "not_found" });
    const now = this.#now();
    const candidates = [...this.#entries.values()]
      .filter(
        (entry) =>
          now < entry.authExpiresAt &&
          entry.clientId === query.clientId &&
          entry.gameId === query.gameId &&
          (query.gameInstanceId === null ||
            entry.gameInstanceId === query.gameInstanceId),
      )
      .sort((left, right) =>
        left.gameInstanceId.localeCompare(right.gameInstanceId) ||
        right.connectionGeneration - left.connectionGeneration,
      );
    const entry = candidates[0];
    return Promise.resolve(
      entry === undefined
        ? { status: "not_found" }
        : { status: "found", session: this.#snapshot(entry) },
    );
  }

  sendIfCurrent(
    message: GameActionDeliveryMessage,
    destinationGeneration: string,
  ): GameSessionSendResult {
    const fence = this.#decodeFence(destinationGeneration);
    if (fence === null) {
      return { status: "stale", reason: "malformed_fence" };
    }
    if (this.#closed) {
      return { status: "unavailable", reason: "registry_closed" };
    }
    if (fence.serverRuntimeGeneration !== this.#runtimeGeneration) {
      return { status: "stale", reason: "runtime_generation_mismatch" };
    }
    const entry = this.#entries.get(
      this.#key(fence.gameId, fence.gameInstanceId),
    );
    if (entry === undefined) {
      return { status: "unavailable", reason: "entry_missing" };
    }
    if (
      entry.clientId !== fence.clientId ||
      entry.gameId !== fence.gameId ||
      entry.gameInstanceId !== fence.gameInstanceId
    ) {
      return { status: "stale", reason: "entry_replaced" };
    }
    if (entry.connectionGeneration !== fence.sessionGeneration) {
      return { status: "stale", reason: "session_generation_mismatch" };
    }
    if (entry.connectionGeneration !== fence.connectionGeneration) {
      return { status: "stale", reason: "connection_generation_mismatch" };
    }
    if (
      message.sessionGeneration !== fence.sessionGeneration ||
      message.data.gameId !== fence.gameId ||
      message.data.gameInstanceId !== fence.gameInstanceId
    ) {
      return { status: "invariant_violation" };
    }
    if (this.#now() >= entry.authExpiresAt) {
      return { status: "stale", reason: "auth_expired" };
    }
    return entry.handle.sendAction(message);
  }

  getSession(clientId: string, gameId: string, gameInstanceId: string) {
    const entry = this.#entries.get(this.#key(gameId, gameInstanceId));
    return entry?.clientId === clientId ? this.#snapshot(entry) : null;
  }

  listSessionsForClient(clientId: string) {
    return [...this.#entries.values()]
      .filter((entry) => entry.clientId === clientId)
      .map((entry) => this.#snapshot(entry));
  }

  getActiveSessionCount(): number {
    return this.#entries.size;
  }

  recordHeartbeat(
    identity: GameSessionIdentity,
    connectionGeneration: ConnectionGeneration,
  ): boolean {
    const entry = this.#current(identity, connectionGeneration);
    if (entry === undefined || this.#now() >= entry.authExpiresAt) return false;
    entry.lastHeartbeatAt = this.#now();
    return true;
  }

  removeIfCurrent(
    identity: GameSessionIdentity,
    connectionGeneration: ConnectionGeneration,
    _reason: string,
  ): boolean {
    const key = this.#key(identity.gameId, identity.gameInstanceId);
    const entry = this.#entries.get(key);
    if (
      entry === undefined ||
      entry.clientId !== identity.clientId ||
      entry.connectionGeneration !== connectionGeneration
    ) {
      return false;
    }
    return this.#entries.delete(key);
  }

  sweepStale(): number {
    const now = this.#now();
    const candidates = [...this.#entries.values()]
      .filter(
        (entry) =>
          now - entry.lastHeartbeatAt >= GAME_SESSION_LIMITS.staleAfterMs ||
          now >= entry.authExpiresAt,
      )
      .sort((left, right) =>
        left.lastHeartbeatAt - right.lastHeartbeatAt ||
        left.gameId.localeCompare(right.gameId) ||
        left.gameInstanceId.localeCompare(right.gameInstanceId),
      )
      .slice(0, GAME_SESSION_LIMITS.maxSweep);
    let removed = 0;
    for (const entry of candidates) {
      if (
        this.removeIfCurrent(entry, entry.connectionGeneration, "stale")
      ) {
        removed += 1;
        entry.handle.disconnect("SESSION_STALE");
      }
    }
    return removed;
  }

  closeAll(): void {
    if (this.#closed) return;
    this.#closed = true;
    const entries = [...this.#entries.values()];
    this.#entries.clear();
    for (const entry of entries) entry.handle.disconnect("SERVER_SHUTDOWN");
  }

  #current(identity: GameSessionIdentity, generation: number) {
    const entry = this.#entries.get(this.#key(identity.gameId, identity.gameInstanceId));
    return entry?.clientId === identity.clientId &&
      entry.connectionGeneration === generation
      ? entry
      : undefined;
  }

  #allocateGeneration(): number {
    if (this.#nextConnectionGeneration >= Number.MAX_SAFE_INTEGER) {
      throw new Error("Game session generation exhausted");
    }
    this.#nextConnectionGeneration += 1;
    return this.#nextConnectionGeneration;
  }

  #now(): number {
    const value = this.#clock();
    if (!validPositiveSafe(value)) throw new Error("Clock returned invalid time");
    return value;
  }

  #key(gameId: string, instanceId: string): string {
    return `${gameId}\u0000${instanceId}`;
  }

  #snapshot(entry: RegistryEntry): RegisteredGameSessionSnapshot {
    return {
      clientId: entry.clientId,
      gameId: entry.gameId,
      gameInstanceId: entry.gameInstanceId,
      serverRuntimeGeneration: entry.serverRuntimeGeneration,
      connectionGeneration: entry.connectionGeneration,
      registeredAt: entry.registeredAt,
      lastHeartbeatAt: entry.lastHeartbeatAt,
      sdkVersion: entry.sdkVersion,
    };
  }

  #decodeFence(value: string): GameSessionSendFence | null {
    try {
      const parsed: unknown = JSON.parse(value);
      if (
        !Array.isArray(parsed) ||
        parsed.length !== 7 ||
        parsed[0] !== 1 ||
        typeof parsed[1] !== "string" ||
        typeof parsed[2] !== "string" ||
        typeof parsed[3] !== "string" ||
        typeof parsed[4] !== "string" ||
        !Number.isSafeInteger(parsed[5]) ||
        (parsed[5] as number) <= 0 ||
        !Number.isSafeInteger(parsed[6]) ||
        (parsed[6] as number) <= 0
      ) {
        return null;
      }
      return {
        clientId: parsed[1],
        gameId: parsed[2],
        gameInstanceId: parsed[3],
        serverRuntimeGeneration: parsed[4],
        sessionGeneration: parsed[5] as number,
        connectionGeneration: parsed[6] as number,
      };
    } catch {
      return null;
    }
  }

  #rejected(errorCode: Extract<GameRegistrationOutcome, { status: "rejected" }>["errorCode"]) {
    return { status: "rejected" as const, errorCode, reason: errorCode };
  }
}
