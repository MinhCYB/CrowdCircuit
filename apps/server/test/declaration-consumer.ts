import type { GameActionEnvelope, JsonValue } from "@crowdcircuit/contracts";
import {
  ActionGateway,
  ActionLifecycleWorker,
  computeActionId,
  MAX_SEND_ATTEMPTS,
  SqliteDurableActionRepository,
  type ActionDeliveryOutcome,
  type ActionDeliveryPort,
  type AuthenticatedClientIdentity,
  type BudgetAdmissionSnapshot,
  type CreateDurableAction,
  type DeliveryDestination,
  type DeliveryResolution,
  type DestinationGeneration,
  type DurableActionRecord,
  type DurableActionRepository,
  type DurableActionStatus,
  type GameRegistrationInput,
  type GameRegistrationOutcome,
  type GameSessionIdentity,
  type GameSessionLifecyclePort,
  type GameSessionRegistryReadPort,
  type PreparedActionDelivery,
  type RegisteredGameSessionSnapshot,
  type SendAuthorization,
  type SessionLookupQuery,
  type SessionLookupResult,
} from "@crowdcircuit/server";
import type {
  BudgetAdmissionRequest,
  DurableBudgetRepository,
} from "@crowdcircuit/mapping-engine";

const budgetRepository: DurableBudgetRepository =
  SqliteDurableActionRepository.open({ filename: ":memory:" });
declare const budgetRequest: BudgetAdmissionRequest;
budgetRepository.admit(budgetRequest);
const derivedActionId: string = computeActionId("seed");
const maximumAttempts: 3 = MAX_SEND_ATTEMPTS;
void derivedActionId;
void maximumAttempts;

// @ts-expect-error final action identity is not accepted by budget admission
budgetRequest.candidate.actionId = "action";

const params: JsonValue = { count: 1 };
const input: CreateDurableAction = {
  actionId: "a",
  idempotencyKey: "i",
  eventId: null,
  mappingId: null,
  gameId: "g",
  gameInstanceId: "inst-1",
  actionType: "SPAWN",
  params,
  priority: 0,
  ttlMs: 1,
  createdAt: 0,
  expiresAt: 1,
  runtimeId: "runtime",
  nextAttemptAt: 100,
};
const repository: DurableActionRepository = SqliteDurableActionRepository.open({
  filename: ":memory:",
});
declare const deliveryPort: ActionDeliveryPort;
const gateway = new ActionGateway(repository, deliveryPort, { now: () => 0 }, "runtime");
const lifecycleWorker = new ActionLifecycleWorker(repository, { now: () => 0 });
void gateway;
void lifecycleWorker;
const createRes = repository.createBeforeFirstSend(input);
if (createRes.created) {
  const authorizedAttempt = repository.recordAttempt(
    createRes.sendAuthorization,
    { role: "game", clientId: "g", gameInstanceId: "inst-1" },
    10,
    "send_started",
  );
  const attemptGameInstanceId: string | null = authorizedAttempt.gameInstanceId;
  void attemptGameInstanceId;
}

const record: DurableActionRecord | null = repository.findById("a");
if (record !== null) {
  const gameInstanceId: string | null = record.gameInstanceId ?? null;
  const nextAttemptAt: number | null = record.nextAttemptAt;
  void gameInstanceId;
  void nextAttemptAt;
}

repository.close();

const validStatus: DurableActionStatus = "delivery_unknown_restart";
// @ts-expect-error arbitrary states are forbidden
const invalidStatus: DurableActionStatus = "sent";
// @ts-expect-error required timestamps cannot be omitted
const missingTimestamp: CreateDurableAction = {
  actionId: "a",
  idempotencyKey: "i",
  eventId: null,
  mappingId: null,
  gameId: "g",
  actionType: "SPAWN",
  params,
  priority: 0,
  ttlMs: 1,
  expiresAt: 1,
  runtimeId: "runtime",
};
// @ts-expect-error params must be JSON safe
const invalidParams: CreateDurableAction = { ...input, params: new Date() };
// @ts-expect-error send authorizations cannot be constructed from public fields
const forgedAuthorization: SendAuthorization = { actionId: "a" };

// @ts-expect-error authorizeRetry requires explicit gameInstanceId fourth argument
repository.authorizeRetry("a", 1, "runtime");

// Snapshot declaration assertions
const validSnapshot: BudgetAdmissionSnapshot = {
  gameProfileId: "prof-1",
  ruleId: "rule-1",
  userBudgetKey: "user-1",
  userLimit: { limitPerMinute: 60 },
  cooldownMs: 1000,
  ruleLimit: { limitPerMinute: 120 },
  globalToken: { maxPerSecond: 10, burst: 20 },
  capacityConfig: { maxUserBuckets: 100, inactiveRetentionMs: 60000, sweepLimit: 50 },
};

// @ts-expect-error BudgetAdmissionSnapshot fields are readonly
validSnapshot.gameProfileId = "prof-2";

// @ts-expect-error null userLimit is rejected
const nullUserLimitSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, userLimit: null };
// @ts-expect-error null cooldownMs is rejected
const nullCooldownMsSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, cooldownMs: null };
// @ts-expect-error null ruleLimit is rejected
const nullRuleLimitSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, ruleLimit: null };
// @ts-expect-error null globalToken is rejected
const nullGlobalTokenSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, globalToken: null };
// @ts-expect-error null capacityConfig is rejected
const nullCapacityConfigSnapshot: BudgetAdmissionSnapshot = { ...validSnapshot, capacityConfig: null };

// @ts-expect-error missing required snapshot fields fail
const missingSnapshotField: BudgetAdmissionSnapshot = {
  gameProfileId: "prof-1",
  ruleId: "rule-1",
  userBudgetKey: "user-1",
  userLimit: { limitPerMinute: 60 },
  cooldownMs: 1000,
  ruleLimit: { limitPerMinute: 120 },
  globalToken: { maxPerSecond: 10, burst: 20 },
};

function mutateSnapshot(snapshot: BudgetAdmissionSnapshot): void {
  // @ts-expect-error BudgetAdmissionSnapshot fields are readonly
  snapshot.gameProfileId = "prof-2";
}
void mutateSnapshot;

const nonJsonSnapshot: BudgetAdmissionSnapshot = {
  ...validSnapshot,
  // @ts-expect-error non-JSON-safe snapshot values fail
  cooldownMs: true as unknown as boolean,
};

// Transport Port declaration assertions
declare const envelope: GameActionEnvelope;
const genFence: DestinationGeneration = "gen-1";
const validDestination: DeliveryDestination = {
  clientId: "g",
  gameInstanceId: "inst-1",
  destinationGeneration: genFence,
};

const preparedDelivery: PreparedActionDelivery = {
  envelope,
  attemptNumber: 1,
  destination: validDestination,
};

const invalidPreparedDelivery: PreparedActionDelivery = {
  envelope,
  attemptNumber: 1,
  destination: validDestination,
  // @ts-expect-error PreparedActionDelivery does not accept SendAuthorization
  authorization: createRes.sendAuthorization,
};

const resolutionAvailable: DeliveryResolution = {
  status: "available",
  destination: validDestination,
};

// @ts-expect-error invalid delivery resolution discriminator fails
const invalidResolution: DeliveryResolution = { status: "ready" };

const outcomeSent: ActionDeliveryOutcome = { status: "sent" };
// @ts-expect-error invalid delivery outcome discriminator fails
const invalidOutcome: ActionDeliveryOutcome = { status: "completed" };

// @ts-expect-error transport-specific or Socket.IO fields cannot be invented
const socketIoOutcome: ActionDeliveryOutcome = { status: "sent", socketId: "soc_123" };

declare const port: ActionDeliveryPort;
port.resolveDestination(envelope);
port.send(preparedDelivery);

// Game Session Registry & Lifecycle Port assertions
const clientIdent: AuthenticatedClientIdentity = {
  clientId: "client-1",
  authenticatedAt: 1000,
};

const sessionIdent: GameSessionIdentity = {
  clientId: "client-1",
  gameId: "zombie-survival",
  gameInstanceId: "inst-1",
};

const regInput: GameRegistrationInput = {
  gameId: "zombie-survival",
  instanceId: "inst-1",
  sdkVersion: "0.1.0",
};

const regOutcome: GameRegistrationOutcome = {
  status: "registered",
  sessionGeneration: 1,
  heartbeatIntervalMs: 10000,
};

// @ts-expect-error errorCode must be a valid GameProtocolErrorCode, not a broad string
const rejectedWithBadCode: GameRegistrationOutcome["errorCode" & keyof Extract<GameRegistrationOutcome, { status: "rejected" }>] = "COMPLETELY_MADE_UP_CODE";
void rejectedWithBadCode;

const rejectedOutcome: GameRegistrationOutcome = {
  status: "rejected",
  errorCode: "GAME_NOT_FOUND",
  reason: "Game not found",
};
void rejectedOutcome;

const sessionSnap: RegisteredGameSessionSnapshot = {
  clientId: "client-1",
  gameId: "zombie-survival",
  gameInstanceId: "inst-1",
  serverRuntimeGeneration: "srv-gen-1",
  connectionGeneration: 1,
  registeredAt: 1000,
  lastHeartbeatAt: 1000,
  sdkVersion: "0.1.0",
};

const lookupQuery: SessionLookupQuery = {
  clientId: "client-1",
  gameId: "zombie-survival",
  gameInstanceId: "inst-1",
};

const lookupRes: SessionLookupResult = {
  status: "found",
  session: sessionSnap,
};

declare const registryReadPort: GameSessionRegistryReadPort;
declare const registryLifecyclePort: GameSessionLifecyclePort;

void registryReadPort.getSession("client-1", "zombie-survival", "inst-1");
void registryReadPort.listSessionsForClient("client-1");
void registryReadPort.getActiveSessionCount();
void registryReadPort.lookupDestination(lookupQuery);
void registryLifecyclePort.registerSession(clientIdent, regInput);
void registryLifecyclePort.recordHeartbeat(sessionIdent, 1);
void registryLifecyclePort.removeIfCurrent(sessionIdent, 1, "test");

// @ts-expect-error FakeActionDeliveryPort is not exported from production package surfaces
import { FakeActionDeliveryPort } from "@crowdcircuit/server";

void validStatus;
void invalidStatus;
void missingTimestamp;
void invalidParams;
void forgedAuthorization;
void validSnapshot;
void missingSnapshotField;
void nonJsonSnapshot;
void nullUserLimitSnapshot;
void nullCooldownMsSnapshot;
void nullRuleLimitSnapshot;
void nullGlobalTokenSnapshot;
void nullCapacityConfigSnapshot;
void preparedDelivery;
void invalidPreparedDelivery;
void resolutionAvailable;
void invalidResolution;
void outcomeSent;
void invalidOutcome;
void socketIoOutcome;
void FakeActionDeliveryPort;
void clientIdent;
void sessionIdent;
void regInput;
void regOutcome;
void sessionSnap;
void lookupQuery;
void lookupRes;
