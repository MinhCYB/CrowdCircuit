import {
  EventDeduplicator,
  EventIntegrityPipeline,
  EventNormalizer,
  GiftStreakAggregator,
  HeadlessEventGateway,
  LikeAggregator,
  RawEventDeduplicator,
} from "@crowdcircuit/event-core";
import type {
  NormalizationResult,
  NormalizationError,
  PipelineEmission,
} from "@crowdcircuit/event-core";
import type { LiveEvent } from "@crowdcircuit/contracts";

const normalizer = new EventNormalizer();
const deduplicator = new EventDeduplicator({ maxKeys: 10 });
const rawDeduplicator = new RawEventDeduplicator({ maxKeys: 10 });
const giftStreaks = new GiftStreakAggregator({ maxOpenStreaks: 10 });
const likes = new LikeAggregator({ milestones: [1000] });
const pipeline = new EventIntegrityPipeline();
const gateway = new HeadlessEventGateway();
const pipelineOutput: PipelineEmission[] = pipeline.tick();

function handleResult(result: NormalizationResult): LiveEvent | NormalizationError {
  if (result.success) {
    // Proves narrowing by success: true exposes approved LiveEvent
    const event: LiveEvent = result.event;
    return event;
  } else {
    // Proves narrowing by success: false exposes NormalizationError
    const error: NormalizationError = result.error;
    return error;
  }
}

// 2. Negative compilation checks
// @ts-expect-error - Invalid error code in NormalizationError
const _badError: NormalizationError = { code: "INVALID_ERROR_CODE", message: "fail" };

// @ts-expect-error - Invalid discriminator literal in NormalizationResult
const _badDiscriminator: NormalizationResult = { success: "maybe", event: null };

// @ts-expect-error - Success result missing event property
const _missingEvent: NormalizationResult = { success: true };

// @ts-expect-error - Failure result missing error property
const _missingError: NormalizationResult = { success: false };

// @ts-expect-error - Incompatible success with error property
const _successWithError: NormalizationResult = { success: true, error: { code: "VALIDATION_FAILED", message: "fail" } };

// @ts-expect-error - Incompatible failure with event property
const _failureWithEvent: NormalizationResult = { success: false, event: {} };

// @ts-expect-error - Success event must be a complete LiveEvent
const _malformedSuccessEvent: NormalizationResult = { success: true, event: { eventType: "gift.sent" } };

// @ts-expect-error - Failure error must be a complete NormalizationError
const _malformedFailureError: NormalizationResult = { success: false, error: { message: "missing code" } };

// @ts-expect-error - maxKeys must be numeric
new EventDeduplicator({ maxKeys: "many" });

// @ts-expect-error - raw deduplicator capacity must be numeric
new RawEventDeduplicator({ maxKeys: "many" });

// @ts-expect-error - flush reason is finite
pipeline.flush("manual");

// @ts-expect-error - gateway flush reason is finite
gateway.flush("manual");

console.log(normalizer, deduplicator, rawDeduplicator, giftStreaks, likes, pipeline, gateway, pipelineOutput, handleResult, _badError, _badDiscriminator, _missingEvent, _missingError, _successWithError, _failureWithEvent, _malformedSuccessEvent, _malformedFailureError);
