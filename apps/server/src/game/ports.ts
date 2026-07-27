/**
 * Transport-neutral game session identity and registry port interfaces for CrowdCircuit.
 * Pure type definitions for session management, delivery routing, and generation fencing.
 * Zero Socket.IO runtime or persistence dependencies.
 */

import type { GameProtocolErrorCode } from "@crowdcircuit/contracts";

export type ServerRuntimeGeneration = string;
export type ConnectionGeneration = number;

/**
 * Authenticated client identity bound during handshake authentication.
 */
export interface AuthenticatedClientIdentity {
  readonly clientId: string;
  readonly authenticatedAt: number;
}

/**
 * Game session target identity tuple.
 */
export interface GameSessionIdentity {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
}

/**
 * Client registration payload input.
 */
export interface GameRegistrationInput {
  readonly gameId: string;
  readonly instanceId: string;
  readonly sdkVersion: string;
}

/**
 * Registration result union.
 */
export type GameRegistrationOutcome =
  | {
      readonly status: "registered";
      readonly sessionGeneration: ConnectionGeneration;
      readonly heartbeatIntervalMs: number;
    }
  | {
      readonly status: "rejected";
      readonly errorCode: GameProtocolErrorCode;
      readonly reason: string;
    };

/**
 * Snapshot of an active registered game session.
 */
export interface RegisteredGameSessionSnapshot {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
  readonly serverRuntimeGeneration: ServerRuntimeGeneration;
  readonly connectionGeneration: ConnectionGeneration;
  readonly registeredAt: number;
  readonly lastHeartbeatAt: number;
  readonly sdkVersion: string;
}

/**
 * Destination lookup query parameter.
 */
export interface SessionLookupQuery {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string | null;
}

/**
 * Destination lookup outcome.
 */
export type SessionLookupResult =
  | {
      readonly status: "found";
      readonly session: RegisteredGameSessionSnapshot;
    }
  | {
      readonly status: "not_found";
    };

/**
 * Abstract port for game session registry read operations.
 */
export interface GameSessionRegistryReadPort {
  lookupDestination(query: SessionLookupQuery): Promise<SessionLookupResult>;
  getSession(clientId: string, gameId: string, gameInstanceId: string): RegisteredGameSessionSnapshot | null;
  listSessionsForClient(clientId: string): readonly RegisteredGameSessionSnapshot[];
  getActiveSessionCount(): number;
}

/**
 * Abstract port for game session lifecycle operations.
 */
export interface GameSessionLifecyclePort {
  registerSession(
    identity: AuthenticatedClientIdentity,
    input: GameRegistrationInput,
  ): Promise<GameRegistrationOutcome>;
  recordHeartbeat(identity: GameSessionIdentity, connectionGeneration: ConnectionGeneration): boolean;
  removeIfCurrent(identity: GameSessionIdentity, connectionGeneration: ConnectionGeneration, reason: string): boolean;
}
