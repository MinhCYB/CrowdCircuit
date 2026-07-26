import type { GameActionEnvelope, JsonValue } from "@crowdcircuit/contracts";
import {
  SqliteDurableActionRepository,
  type ActionDeliveryOutcome,
  type ActionDeliveryPort,
  type BudgetAdmissionSnapshot,
  type CreateDurableAction,
  type DeliveryDestination,
  type DeliveryResolution,
  type DurableActionRecord,
  type DurableActionRepository,
  type DurableActionStatus,
  type PreparedActionDelivery,
  type SendAuthorization,
} from "@crowdcircuit/server";
import type {
  BudgetAdmissionRequest,
  DurableBudgetRepository,
} from "@crowdcircuit/mapping-engine";

const budgetRepository: DurableBudgetRepository =
  SqliteDurableActionRepository.open({ filename: ":memory:" });
declare const budgetRequest: BudgetAdmissionRequest;
budgetRepository.admit(budgetRequest);

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

// @ts-expect-error missing required snapshot fields fail
const missingSnapshotField: BudgetAdmissionSnapshot = {
  gameProfileId: "prof-1",
  ruleId: "rule-1",
  userBudgetKey: "user-1",
  userLimit: null,
  cooldownMs: null,
  ruleLimit: null,
  globalToken: null,
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
const validDestination: DeliveryDestination = {
  clientId: "g",
  gameInstanceId: "inst-1",
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
void preparedDelivery;
void invalidPreparedDelivery;
void resolutionAvailable;
void invalidResolution;
void outcomeSent;
void invalidOutcome;
void socketIoOutcome;
void FakeActionDeliveryPort;
