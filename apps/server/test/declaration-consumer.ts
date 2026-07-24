import type { JsonValue } from "@crowdcircuit/contracts";
import {
  SqliteDurableActionRepository,
  type CreateDurableAction,
  type DurableActionRepository,
  type DurableActionStatus,
  type SendAuthorization,
} from "@crowdcircuit/server";

const params: JsonValue = { count: 1 };
const input: CreateDurableAction = {
  actionId: "a",
  idempotencyKey: "i",
  eventId: null,
  mappingId: null,
  gameId: "g",
  actionType: "SPAWN",
  params,
  priority: 0,
  ttlMs: 1,
  createdAt: 0,
  expiresAt: 1,
  runtimeId: "runtime",
};
const repository: DurableActionRepository = SqliteDurableActionRepository.open({
  filename: ":memory:",
});
repository.createBeforeFirstSend(input);
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

void validStatus;
void invalidStatus;
void missingTimestamp;
void invalidParams;
void forgedAuthorization;
