import type {
  GameActionDeliveryMessage,
  GameActionError,
  JsonValue,
} from "@crowdcircuit/contracts";

/**
 * CrowdCircuit Game SDK configuration options.
 */
export interface GameClientConfig {
  /** Target server URL (e.g. "https://game.crowdcircuit.io"). */
  readonly serverUrl: string;
  /** Opaque handshake authentication token. */
  readonly token: string;
  /** Game identifier. */
  readonly gameId: string;
  /** Game instance identifier. */
  readonly instanceId: string;
  /** Optional heartbeat interval override in milliseconds. */
  readonly heartbeatIntervalMs?: number;
  /** Optional auto-reconnect setting. */
  readonly autoReconnect?: boolean;
}

/**
 * Connection and registration states for CrowdCircuit Game SDK.
 */
export type GameClientState =
  | "disconnected"
  | "connecting"
  | "authenticated"
  | "registered"
  | "reconnecting"
  | "closed";

/**
 * Action handler payload passed to registered SDK action handlers.
 */
export type ActionHandlerInput<TParams extends JsonValue = JsonValue> =
  GameActionDeliveryMessage<TParams>;

/**
 * Successful action execution result returned by an SDK action handler.
 */
export interface ActionCompletedOutcome {
  readonly status: "completed";
  readonly durationMs: number;
  readonly details?: JsonValue;
}

/**
 * Failed action execution result returned by an SDK action handler.
 */
export interface ActionFailedOutcome {
  readonly status: "failed";
  readonly error: GameActionError;
}

/**
 * Union of action execution outcomes produced by SDK action handlers.
 */
export type ActionHandlerOutcome = ActionCompletedOutcome | ActionFailedOutcome;

/**
 * Action handler function signature.
 * Handlers process delivered actions and return or resolve an ActionHandlerOutcome.
 */
export type ActionHandler<TParams extends JsonValue = JsonValue> = (
  input: ActionHandlerInput<TParams>,
) => Promise<ActionHandlerOutcome> | ActionHandlerOutcome;

/**
 * Disposer function returned when registering an action handler or listener.
 */
export type UnsubscribeFn = () => void;

/**
 * State change listener function.
 */
export type StateChangeListener = (
  newState: GameClientState,
  previousState: GameClientState,
) => void;

/**
 * Public CrowdCircuit Game Client interface contract.
 */
export interface CrowdCircuitGameClient {
  /** Current connection/registration state. */
  readonly state: GameClientState;
  /** Server-assigned client ID (available after registration). */
  readonly clientId: string | null;
  /** Current session generation (available after registration). */
  readonly sessionGeneration: number | null;

  /** Initiate connection and registration sequence. */
  connect(): Promise<void>;
  /** Disconnect client session. */
  disconnect(): Promise<void>;
  /** Register an action handler for a specific action type. */
  onAction<TParams extends JsonValue = JsonValue>(
    actionType: string,
    handler: ActionHandler<TParams>,
  ): UnsubscribeFn;
  /** Subscribe to connection state changes. */
  onStateChange(listener: StateChangeListener): UnsubscribeFn;
  /** Clean up resources and permanently close client. */
  dispose(): Promise<void>;
}
