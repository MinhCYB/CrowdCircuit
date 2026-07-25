import {
  MappingEngine,
  type BudgetAdmissionRequest,
  type DurableBudgetRepository,
  type MappingProfile,
} from "@crowdcircuit/mapping-engine";

const repository: DurableBudgetRepository = {
  admit(_request: BudgetAdmissionRequest) {
    return { admitted: true };
  },
};
const engine = new MappingEngine(repository, { now: () => 1 });

const profile: MappingProfile = {
  gameProfileId: "profile",
  gameId: "game",
  matchMode: "all",
  globalActionBudget: {
    maxPerSecond: 30,
    burst: 50,
    overflowPolicy: "drop_low_priority",
    deferredTtlMs: null,
  },
  capacity: {
    maxUserBuckets: 10,
    inactiveRetentionMs: 60_000,
    sweepLimit: 2,
  },
  rules: [],
};

// @ts-expect-error matchMode is finite
profile.matchMode = "some";
// @ts-expect-error repository requires an atomic admission method
const invalidRepository: DurableBudgetRepository = {};
// @ts-expect-error final actionId is not part of mapping profiles
profile.actionId = "action";
// @ts-expect-error JSON-unsafe values cannot be action parameters
const invalidParams: BudgetAdmissionRequest["candidate"]["params"] = new Date();

void engine;
void invalidRepository;
void invalidParams;
