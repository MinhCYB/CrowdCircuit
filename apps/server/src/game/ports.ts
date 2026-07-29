/**
 * Transport-neutral game session identity and registry port interfaces for CrowdCircuit.
 * Pure type definitions for session management, delivery routing, and generation fencing.
 * Zero Socket.IO runtime or persistence dependencies.
 */

import type {
  GameActionReceivedMessage,
  GameActionResultMessage,
  GameActionDeliveryMessage,
  GameProtocolErrorCode,
} from "@crowdcircuit/contracts";
import type { DurableActionRecord } from "../persistence/types.js";

export type ServerRuntimeGeneration = string;
export type ConnectionGeneration = number;

export interface InboundGameSession {
  readonly clientId: string;
  readonly gameId: string;
  readonly gameInstanceId: string;
  readonly sessionGeneration: ConnectionGeneration;
}

export type InboundLifecycleResult =
  | { readonly status: "accepted"; readonly record: DurableActionRecord }
  | { readonly status: "idempotent"; readonly record: DurableActionRecord }
  | {
      readonly status: "rejected";
      readonly code:
        | "ACTION_NOT_FOUND"
        | "ACTION_BINDING_MISMATCH"
        | "ATTEMPT_NOT_FOUND"
        | "ACTION_NOT_ACCEPTING_RECEIPT"
        | "ACTION_NOT_ACCEPTING_RESULT"
        | "RESULT_CONFLICT";
    };

export interface InboundActionLifecyclePort {
  handleReceipt(
    session: InboundGameSession,
    message: GameActionReceivedMessage,
  ): InboundLifecycleResult;
  handleResult(
    session: InboundGameSession,
    message: GameActionResultMessage,
  ): InboundLifecycleResult;
}

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
export interface GameDestinationQuery {
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
  getSession(clientId: string, gameId: string, gameInstanceId: string): RegisteredGameSessionSnapshot | null;
  listSessionsForClient(clientId: string): readonly RegisteredGameSessionSnapshot[];
  getActiveSessionCount(): number;
}

/**
 * Narrow internal bridge used by outbound game action delivery.
 */
export interface GameSessionDeliveryPort {
  lookupDestination(query: GameDestinationQuery): Promise<SessionLookupResult>;
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
