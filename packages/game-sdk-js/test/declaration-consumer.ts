import type {
  CrowdCircuitGameClient,
  GameClientConfig,
  GameClientState,
  ActionHandler,
  ActionHandlerInput,
  ActionCompletedOutcome,
  ActionFailedOutcome,
  ActionHandlerOutcome,
  UnsubscribeFn,
} from "@crowdcircuit/game-sdk-js";
import { GAME_SDK_VERSION } from "@crowdcircuit/game-sdk-js";
import type { GameActionError } from "@crowdcircuit/contracts";

const sdkVersion: "0.1.0" = GAME_SDK_VERSION;
void sdkVersion;

const validConfig: GameClientConfig = {
  serverUrl: "http://127.0.0.1:3100",
  token: "opaque-handshake-token-123",
  gameId: "zombie-survival",
  instanceId: "inst-001",
  heartbeatIntervalMs: 10000,
  autoReconnect: true,
};

// @ts-expect-error serverUrl is required
const missingServerUrl: GameClientConfig = {
  token: "tok",
  gameId: "g",
  instanceId: "i",
};

// @ts-expect-error token is required
const missingToken: GameClientConfig = {
  serverUrl: "http://127.0.0.1:3100",
  gameId: "g",
  instanceId: "i",
};

const validState: GameClientState = "registered";
// @ts-expect-error invalid state string rejected
const invalidState: GameClientState = "authenticating";

const sampleHandler: ActionHandler<{ spawnCount: number }> = (
  input: ActionHandlerInput<{ spawnCount: number }>,
): ActionHandlerOutcome => {
  const count: number = input.data.params.spawnCount;
  if (count > 10) {
    const error: GameActionError = {
      code: "CAP_EXCEEDED",
      message: "Spawn limit exceeded",
      retryable: false,
    };
    return { status: "failed", error };
  }
  return { status: "completed", durationMs: 25, details: { spawned: count } };
};

declare const client: CrowdCircuitGameClient;
const currentState: GameClientState = client.state;
const clientIdent: string | null = client.clientId;
const sessionGen: number | null = client.sessionGeneration;
void currentState;
void clientIdent;
void sessionGen;

const unsubAction: UnsubscribeFn = client.onAction("SPAWN_ZOMBIE", sampleHandler);
const unsubState: UnsubscribeFn = client.onStateChange((newState, oldState) => {
  void newState;
  void oldState;
});
unsubAction();
unsubState();

// @ts-expect-error Date does not satisfy JsonValue constraint for action params
const invalidHandler: ActionHandler<Date> = (_input) => {
  return { status: "completed", durationMs: 0 };
};

// @ts-expect-error handler outcome must have status completed or failed
const invalidOutcomeHandler: ActionHandler = (_input) => {
  return { status: "pending" };
};

void validConfig;
void missingServerUrl;
void missingToken;
void validState;
void invalidState;
void invalidHandler;
void invalidOutcomeHandler;
