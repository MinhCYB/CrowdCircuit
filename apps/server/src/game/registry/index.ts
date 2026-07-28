import { randomBytes } from "node:crypto";
import type {
  AuthenticatedClientIdentity,
  ConnectionGeneration,
  GameRegistrationInput,
  GameRegistrationOutcome,
  GameSessionIdentity,
  GameSessionRegistryReadPort,
  RegisteredGameSessionSnapshot,
  ServerRuntimeGeneration,
  SessionLookupQuery,
  SessionLookupResult,
} from "../ports.js";

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
  implements GameSessionRegistryReadPort
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
    const candidates = [...this.#entries.values()]
      .filter(
        (entry) =>
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

  #rejected(errorCode: Extract<GameRegistrationOutcome, { status: "rejected" }>["errorCode"]) {
    return { status: "rejected" as const, errorCode, reason: errorCode };
  }
}
