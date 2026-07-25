import { createHash } from "node:crypto";
import type { JsonValue } from "@crowdcircuit/contracts";
import {
  MAPPING_SEED_FORMAT_VERSION,
  type CandidateIdentityInput,
} from "./model.js";

export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${entries.join(",")}}`;
}

export function createCandidateSeed(input: CandidateIdentityInput): string {
  const canonical = canonicalJson({
    seedFormatVersion: MAPPING_SEED_FORMAT_VERSION,
    gameProfileId: input.gameProfileId,
    ruleId: input.ruleId,
    eventId: input.eventId,
    candidateOrdinal: input.candidateOrdinal,
    actionType: input.actionType,
    params: input.params,
  });
  return `m2:v${MAPPING_SEED_FORMAT_VERSION}:${createHash("sha256")
    .update(canonical)
    .digest("hex")}`;
}
