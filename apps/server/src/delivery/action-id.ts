import { createHash } from "node:crypto";
import { PersistenceError } from "../persistence/types.js";

const ACTION_ID_FORMAT_VERSION = 1 as const;

export function computeActionId(idempotencySeed: string): string {
  if (typeof idempotencySeed !== "string" || idempotencySeed.length === 0 || idempotencySeed.length > 1024) {
    throw new PersistenceError("INVALID_INPUT", "Idempotency seed is invalid");
  }
  const canonical = JSON.stringify({
    formatVersion: ACTION_ID_FORMAT_VERSION,
    idempotencySeed,
  });
  return `act_${createHash("sha256").update(canonical).digest("hex").slice(0, 32)}`;
}
