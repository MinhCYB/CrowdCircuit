import {
  createLiveEventEnvelopeSchema,
  BaseLiveEventEnvelopeSchema,
  type BaseLiveEventEnvelope,
  type LiveEventEnvelope,
} from "@crowdcircuit/contracts";
import { z } from "zod";

// 1. Factory with payload schema object preserves exact inferred payload type
const SamplePayloadSchema = z.object({
  giftName: z.string(),
  amount: z.number(),
});

const SpecializedEnvelopeSchema = createLiveEventEnvelopeSchema(
  SamplePayloadSchema,
  z.literal("gift.sent")
);

type InferredSpecialized = z.infer<typeof SpecializedEnvelopeSchema>;

// Verify runtime schema parsing on factory schema
const parsedSpecialized = SpecializedEnvelopeSchema.parse({
  specVersion: "0.1",
  eventId: "evt_spec_1",
  eventType: "gift.sent",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: { giftName: "Rose", amount: 10 },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
});

// Verify base envelope schema parsing
const parsedBase = BaseLiveEventEnvelopeSchema.parse(parsedSpecialized);

// Verify payload field inference
const samplePayload: InferredSpecialized["payload"] = {
  giftName: "Rose",
  amount: 10,
};

// Verify eventType literal inference
const sampleEventType: InferredSpecialized["eventType"] = "gift.sent";

// Generic LiveEventEnvelope type helper verification
const genericEnvelope: LiveEventEnvelope<{ giftName: string; amount: number }, "gift.sent"> = {
  specVersion: "0.1",
  eventId: "evt_1",
  eventType: "gift.sent",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  payload: { giftName: "Rose", amount: 10 },
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

// 2. Event-type non-string schema is rejected by TypeScript compiler
// @ts-expect-error - z.number() is not a string schema
createLiveEventEnvelopeSchema(SamplePayloadSchema, z.number());

// 3. Payload shape mismatch is rejected by TypeScript compiler
const invalidPayload: InferredSpecialized["payload"] = {
  giftName: "Rose",
  // @ts-expect-error - amount must be a number, not string
  amount: "ten",
};

// 4. Base envelope requires payload property (cannot omit payload)
// @ts-expect-error - payload property is required
const missingPayloadEnvelope: BaseLiveEventEnvelope = {
  specVersion: "0.1",
  eventId: "evt_1",
  eventType: "test",
  source: "mock",
  room: { roomId: null, streamerUniqueId: "streamer" },
  user: null,
  occurredAt: "2026-07-20T03:00:00.000Z",
  receivedAt: "2026-07-20T03:00:00.000Z",
  metadata: { connectorId: "mock", isReplay: false, rawStored: false },
};

console.log("Declaration consumer type checks passed.", samplePayload, sampleEventType, genericEnvelope, invalidPayload, missingPayloadEnvelope, parsedBase);
