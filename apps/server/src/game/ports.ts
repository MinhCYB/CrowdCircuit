/**
 * Transport-neutral game session identity and registry port interfaces for CrowdCircuit.
 * Pure type definitions for session management, delivery routing, and generation fencing.
 * Zero Socket.IO runtime or persistence dependencies.
 */

import type {
  GameActionDeliveryMessage,
  GameProtocolErrorCode,
} from "@crowdcircuit/contracts";

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
 * Complete transport-neutral fence for one resolved live game session.
 */
export interface GameSessionSendFence {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
  readonly serverRuntimeGeneration: ServerRuntimeGeneration;
  readonly sessionGeneration: ConnectionGeneration;
  readonly connectionGeneration: ConnectionGeneration;
}

export type GameConnectionSendResult =
  | { readonly status: "sent" }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "disconnected"
        | "backpressured"
        | "emit_failed";
    };

export type GameSessionSendResult =
  | { readonly status: "sent" }
  | {
      readonly status: "stale";
      readonly reason:
        | "malformed_fence"
        | "runtime_generation_mismatch"
        | "session_generation_mismatch"
        | "connection_generation_mismatch"
        | "auth_expired"
        | "entry_replaced";
    }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "registry_closed"
        | "entry_missing"
        | "disconnected"
        | "backpressured"
        | "emit_failed";
    }
  | { readonly status: "invariant_violation" };

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
 * Narrow internal bridge used by outbound game action delivery.
 */
export interface GameSessionDeliveryPort {
  lookupDestination(query: SessionLookupQuery): Promise<SessionLookupResult>;
  sendIfCurrent(
    message: GameActionDeliveryMessage,
    destinationGeneration: string,
  ): GameSessionSendResult;
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
