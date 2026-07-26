import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PersistenceError,
  SqliteDurableActionRepository,
  type CreateDurableAction,
} from "../src/persistence/index.js";

describe("Milestone 3 Slice 1 Mechanical Persistence Extensions", () => {
  let repository: SqliteDurableActionRepository;

  beforeEach(() => {
    repository = SqliteDurableActionRepository.open({ filename: ":memory:" });
  });

  afterEach(() => {
    repository.close();
  });

  const baseInput: CreateDurableAction = {
    actionId: "act_test_1",
    idempotencyKey: "idemp_test_1",
    eventId: "evt_1",
    mappingId: "map_1",
    gameId: "game_1",
    actionType: "SPAWN",
    params: { count: 1 },
    priority: 10,
    ttlMs: 5000,
    createdAt: 1000,
    expiresAt: 6000,
    runtimeId: "runtime_1",
  };

  describe("gameInstanceId pass-through and validation", () => {
    it("persists null when gameInstanceId is omitted", () => {
      const result = repository.createBeforeFirstSend(baseInput);
      expect(result.created).toBe(true);
      if (!result.created) return;

      const attempt = repository.recordAttempt(
        result.sendAuthorization,
        { role: "game", clientId: "game_1" },
        1100,
        "send_started",
      );
      expect(attempt.gameInstanceId).toBeNull();
    });

    it("persists null when gameInstanceId is undefined or explicit null", () => {
      const inputUndefined: CreateDurableAction = {
        ...baseInput,
        actionId: "act_undef",
        idempotencyKey: "idemp_undef",
        gameInstanceId: undefined,
      };
      const inputNull: CreateDurableAction = {
        ...baseInput,
        actionId: "act_null",
        idempotencyKey: "idemp_null",
        gameInstanceId: null,
      };

      const res1 = repository.createBeforeFirstSend(inputUndefined);
      const res2 = repository.createBeforeFirstSend(inputNull);
      expect(res1.created).toBe(true);
      expect(res2.created).toBe(true);
      if (!res1.created || !res2.created) return;

      const att1 = repository.recordAttempt(
        res1.sendAuthorization,
        { role: "game", clientId: "game_1" },
        1100,
        "send_started",
      );
      const att2 = repository.recordAttempt(
        res2.sendAuthorization,
        { role: "game", clientId: "game_1" },
        1100,
        "send_started",
      );

      expect(att1.gameInstanceId).toBeNull();
      expect(att2.gameInstanceId).toBeNull();
    });

    it("persists and round-trips valid nonempty gameInstanceId string", () => {
      const input: CreateDurableAction = {
        ...baseInput,
        gameInstanceId: "inst_alpha_123",
      };

      const result = repository.createBeforeFirstSend(input);
      expect(result.created).toBe(true);
      if (!result.created) return;

      const attempt = repository.recordAttempt(
        result.sendAuthorization,
        { role: "game", clientId: "game_1", gameInstanceId: "inst_alpha_123" },
        1100,
        "send_started",
      );
      expect(attempt.gameInstanceId).toBe("inst_alpha_123");
    });

    it("rejects invalid gameInstanceId formats during action creation", () => {
      const invalidEmpty: CreateDurableAction = {
        ...baseInput,
        gameInstanceId: "",
      };
      expect(() => repository.createBeforeFirstSend(invalidEmpty)).toThrowError(
        PersistenceError,
      );
      expect(() => repository.createBeforeFirstSend(invalidEmpty)).toThrow(
        "Game instance ID is invalid",
      );
    });

    it("copies authorized gameInstanceId into action_attempts when attempt is recorded", () => {
      const input: CreateDurableAction = {
        ...baseInput,
        gameInstanceId: "inst_beta_456",
      };

      const result = repository.createBeforeFirstSend(input);
      expect(result.created).toBe(true);
      if (!result.created) return;

      const attempt = repository.recordAttempt(
        result.sendAuthorization,
        { role: "game", clientId: "game_1", gameInstanceId: "inst_beta_456" },
        1100,
        "send_started",
      );

      expect(attempt.gameInstanceId).toBe("inst_beta_456");

      const attempts = repository.listAttempts(baseInput.actionId);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.gameInstanceId).toBe("inst_beta_456");
    });

    it("fails closed when supplied binding gameInstanceId mismatches authorized gameInstanceId", () => {
      const input: CreateDurableAction = {
        ...baseInput,
        gameInstanceId: "inst_expected",
      };

      const result = repository.createBeforeFirstSend(input);
      expect(result.created).toBe(true);
      if (!result.created) return;

      expect(() =>
        repository.recordAttempt(
          result.sendAuthorization,
          { role: "game", clientId: "game_1", gameInstanceId: "inst_mismatched" },
          1100,
          "send_started",
        ),
      ).toThrowError(PersistenceError);
    });

    it("requires explicit gameInstanceId during authorizeRetry and fails closed on omitted/undefined", () => {
      const input: CreateDurableAction = {
        ...baseInput,
        gameInstanceId: "inst_original",
      };

      const result = repository.createBeforeFirstSend(input);
      expect(result.created).toBe(true);
      if (!result.created) return;

      repository.recordAttempt(
        result.sendAuthorization,
        { role: "game", clientId: "game_1", gameInstanceId: "inst_original" },
        1100,
        "send_started",
      );

      const record = repository.findById(baseInput.actionId);
      expect(record).not.toBeNull();
      if (record === null) return;

      // 1 & 2: Omitted / undefined gameInstanceId fails closed
      expect(() =>
        repository.authorizeRetry(
          record.actionId,
          record.version,
          record.runtimeId,
          undefined as unknown as string,
        ),
      ).toThrowError(PersistenceError);

      // 3: Explicit null succeeds and persists null (does NOT inherit inst_original)
      const retryAuthNull = repository.authorizeRetry(
        record.actionId,
        record.version,
        record.runtimeId,
        null,
      );

      const retryAttemptNull = repository.recordAttempt(
        retryAuthNull,
        { role: "game", clientId: "game_1", gameInstanceId: null },
        1200,
        "send_started",
      );
      expect(retryAttemptNull.gameInstanceId).toBeNull();

      const record2 = repository.findById(baseInput.actionId);
      expect(record2).not.toBeNull();
      if (record2 === null) return;

      // 4, 5 & 6: Explicit valid string succeeds and copies explicit binding without inheriting previous
      const retryAuthNew = repository.authorizeRetry(
        record2.actionId,
        record2.version,
        record2.runtimeId,
        "inst_new_destination",
      );

      const retryAttemptNew = repository.recordAttempt(
        retryAuthNew,
        { role: "game", clientId: "game_1", gameInstanceId: "inst_new_destination" },
        1300,
        "send_started",
      );
      expect(retryAttemptNew.gameInstanceId).toBe("inst_new_destination");

      // 7: Attempt recording mismatch against new authorization fails closed
      const record3 = repository.findById(baseInput.actionId);
      expect(record3).not.toBeNull();
      if (record3 === null) return;

      const retryAuthMismatch = repository.authorizeRetry(
        record3.actionId,
        record3.version,
        record3.runtimeId,
        "inst_auth_bound",
      );

      expect(() =>
        repository.recordAttempt(
          retryAuthMismatch,
          { role: "game", clientId: "game_1", gameInstanceId: "inst_wrong" },
          1400,
          "send_started",
        ),
      ).toThrowError(PersistenceError);
    });
  });

  describe("nextAttemptAt structural persistence support", () => {
    it("defaults nextAttemptAt to null when omitted during creation", () => {
      const result = repository.createBeforeFirstSend(baseInput);
      expect(result.created).toBe(true);

      const record = repository.findById(baseInput.actionId);
      expect(record?.nextAttemptAt).toBeNull();
    });

    it("round-trips explicit nonnegative nextAttemptAt integer value", () => {
      const input: CreateDurableAction = {
        ...baseInput,
        nextAttemptAt: 15000,
      };

      const result = repository.createBeforeFirstSend(input);
      expect(result.created).toBe(true);

      const record = repository.findById(baseInput.actionId);
      expect(record?.nextAttemptAt).toBe(15000);
    });

    it("rejects negative nextAttemptAt during validation", () => {
      const invalidInput: CreateDurableAction = {
        ...baseInput,
        nextAttemptAt: -1,
      };

      expect(() => repository.createBeforeFirstSend(invalidInput)).toThrowError(
        PersistenceError,
      );
      expect(() => repository.createBeforeFirstSend(invalidInput)).toThrow(
        "Next attempt timestamp is invalid",
      );
    });
  });
});
