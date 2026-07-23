import type { RawConnectorEvent } from "@crowdcircuit/connector-core";
import {
  ChatCommentEventSchema,
  EngagementLikeEventSchema,
  GiftSentEventSchema,
  LiveEventEnvelopeSchema,
  SocialFollowEventSchema,
  type LiveEvent,
} from "@crowdcircuit/contracts";

export const EVENT_CORE_VERSION = "0.1.0" as const;

export * from "./pipeline.js";
export * from "./gateway.js";

export type NormalizationErrorCode =
  | "UNSUPPORTED_EVENT_KIND"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_DATA_TYPE"
  | "VALIDATION_FAILED";

export interface NormalizationError {
  code: NormalizationErrorCode;
  message: string;
  rawKind?: string;
  details?: unknown;
}

export type NormalizationResult<T = LiveEvent> =
  | { success: true; event: T }
  | { success: false; error: NormalizationError };

export interface NormalizerOptions {
  connectorId?: string;
  now?: () => string;
  idGenerator?: () => string;
}

let defaultSequence = 0;

/**
 * Assertion-free type guard to check if a value is a non-null object record.
 */
function isObjectRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * EventNormalizer converts raw connector events into normalized, runtime-validated
 * specialized LiveEventEnvelopes from @crowdcircuit/contracts.
 */
export class EventNormalizer {
  /**
   * Normalizes a raw connector event into a specialized LiveEvent envelope.
   * Returns a conservative typed NormalizationResult without throwing untyped errors.
   */
  public normalize(
    raw: RawConnectorEvent,
    options: NormalizerOptions = {}
  ): NormalizationResult {
    if (!isObjectRecord(raw)) {
      return {
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELD",
          message: "Raw connector event must be a non-null object",
        },
      };
    }

    if (typeof raw.kind !== "string" || !raw.kind.trim()) {
      return {
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELD",
          message: "Raw event kind is required",
        },
      };
    }

    const rawKind = raw.kind.trim().toLowerCase();

    if (typeof raw.source !== "string" || !["tiktok", "tikfinity", "mock"].includes(raw.source)) {
      return {
        success: false,
        error: {
          code: "INVALID_DATA_TYPE",
          message: `Invalid or unsupported event source '${String(raw.source)}'`,
          rawKind: raw.kind,
        },
      };
    }

    const rawPayload = raw.rawPayload;
    if (!isObjectRecord(rawPayload)) {
      return {
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELD",
          message: "rawPayload is required and must be an object",
          rawKind: raw.kind,
        },
      };
    }

    // streamerUniqueId is required non-null string
    if (typeof raw.streamerUniqueId !== "string" || !raw.streamerUniqueId.trim()) {
      return {
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELD",
          message: "streamerUniqueId is required and must be a non-empty string",
          rawKind: raw.kind,
        },
      };
    }
    const streamerUniqueId = raw.streamerUniqueId.trim();

    // Determine deterministic timestamps
    const nowIso = options.now ? options.now() : new Date().toISOString();
    let occurredAt = nowIso;
    if (raw.occurredAt !== undefined) {
      if (typeof raw.occurredAt !== "string" || isNaN(Date.parse(raw.occurredAt))) {
        return {
          success: false,
          error: {
            code: "INVALID_DATA_TYPE",
            message: "occurredAt must be a valid ISO 8601 UTC datetime string",
            rawKind: raw.kind,
          },
        };
      }
      occurredAt = raw.occurredAt;
    }

    const receivedAt = nowIso;

    // Generate unique event ID
    defaultSequence += 1;
    const eventId = options.idGenerator
      ? options.idGenerator()
      : `evt_norm_${Date.now()}_${defaultSequence}`;

    const connectorId = options.connectorId ?? "mock-connector";

    // Room normalized structure
    const roomId = raw.roomId === undefined ? null : raw.roomId;
    if (roomId !== null && typeof roomId !== "string") {
      return {
        success: false,
        error: {
          code: "INVALID_DATA_TYPE",
          message: "roomId must be a string or null",
          rawKind: raw.kind,
        },
      };
    }

    const room = {
      roomId,
      streamerUniqueId,
    };

    // User normalized structure via assertion-free, non-fabricating inspection
    const rawSender = rawPayload.sender;
    let user: {
      id: string | null;
      uniqueId: string | null;
      displayName: string;
      avatarUrl: string | null;
      roles: string[];
    } | null = null;

    if (rawSender !== undefined && rawSender !== null) {
      if (!isObjectRecord(rawSender)) {
        return {
          success: false,
          error: {
            code: "INVALID_DATA_TYPE",
            message: "sender must be an object or null/undefined",
            rawKind: raw.kind,
          },
        };
      }

      // Check userId type
      let userId: string | null = null;
      if (rawSender.userId !== undefined && rawSender.userId !== null) {
        if (typeof rawSender.userId !== "string") {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "sender.userId must be a string or null",
              rawKind: raw.kind,
            },
          };
        }
        userId = rawSender.userId.trim() ? rawSender.userId.trim() : null;
      }

      // Check uniqueId type
      let uniqueId: string | null = null;
      if (rawSender.uniqueId !== undefined && rawSender.uniqueId !== null) {
        if (typeof rawSender.uniqueId !== "string") {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "sender.uniqueId must be a string or null",
              rawKind: raw.kind,
            },
          };
        }
        uniqueId = rawSender.uniqueId.trim() ? rawSender.uniqueId.trim() : null;
      }

      // Check nickname and displayName types and ensure non-empty
      if (rawSender.nickname !== undefined && rawSender.nickname !== null && typeof rawSender.nickname !== "string") {
        return {
          success: false,
          error: {
            code: "INVALID_DATA_TYPE",
            message: "sender.nickname must be a string or null",
            rawKind: raw.kind,
          },
        };
      }
      if (rawSender.displayName !== undefined && rawSender.displayName !== null && typeof rawSender.displayName !== "string") {
        return {
          success: false,
          error: {
            code: "INVALID_DATA_TYPE",
            message: "sender.displayName must be a string or null",
            rawKind: raw.kind,
          },
        };
      }

      let displayName: string | null = null;
      if (typeof rawSender.nickname === "string" && rawSender.nickname.trim()) {
        displayName = rawSender.nickname.trim();
      } else if (typeof rawSender.displayName === "string" && rawSender.displayName.trim()) {
        displayName = rawSender.displayName.trim();
      }

      if (!displayName) {
        return {
          success: false,
          error: {
            code: "MISSING_REQUIRED_FIELD",
            message: "sender.nickname or sender.displayName is required and must be a non-empty string",
            rawKind: raw.kind,
          },
        };
      }

      // Check avatarUrl type
      let avatarUrl: string | null = null;
      if (rawSender.avatarUrl !== undefined && rawSender.avatarUrl !== null) {
        if (typeof rawSender.avatarUrl !== "string") {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "sender.avatarUrl must be a string or null",
              rawKind: raw.kind,
            },
          };
        }
        avatarUrl = rawSender.avatarUrl.trim() ? rawSender.avatarUrl.trim() : null;
      }

      // Check roles type and element types strictly
      let roles: string[] = [];
      if (rawSender.roles !== undefined && rawSender.roles !== null) {
        if (!Array.isArray(rawSender.roles)) {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "sender.roles must be an array or null/undefined",
              rawKind: raw.kind,
            },
          };
        }
        for (const roleItem of rawSender.roles) {
          if (typeof roleItem !== "string") {
            return {
              success: false,
              error: {
                code: "INVALID_DATA_TYPE",
                message: "sender.roles elements must be strings",
                rawKind: raw.kind,
              },
            };
          }
        }
        roles = rawSender.roles;
      }

      user = {
        id: userId,
        uniqueId,
        displayName,
        avatarUrl,
        roles,
      };
    }

    const metadata = {
      connectorId,
      isReplay: false,
      rawStored: false,
    };

    // Normalize per event kind
    switch (rawKind) {
      case "gift":
      case "gift.sent": {
        const rawGiftId = rawPayload.giftId;
        if (typeof rawGiftId !== "string" || !rawGiftId.trim()) {
          return {
            success: false,
            error: {
              code: "MISSING_REQUIRED_FIELD",
              message: "giftId is required and must be a non-empty string",
              rawKind: raw.kind,
            },
          };
        }
        const giftId = rawGiftId.trim();

        const rawGiftName = rawPayload.giftName;
        if (typeof rawGiftName !== "string" || !rawGiftName.trim()) {
          return {
            success: false,
            error: {
              code: "MISSING_REQUIRED_FIELD",
              message: "giftName is required and must be a non-empty string",
              rawKind: raw.kind,
            },
          };
        }
        const giftName = rawGiftName.trim();

        let imageUrl: string | null = null;
        if (rawPayload.giftImage !== undefined && rawPayload.giftImage !== null) {
          if (typeof rawPayload.giftImage !== "string") {
            return {
              success: false,
              error: {
                code: "INVALID_DATA_TYPE",
                message: "giftImage must be a string or null",
                rawKind: raw.kind,
              },
            };
          }
          imageUrl = rawPayload.giftImage;
        }

        let diamondValue: number | null = null;
        if (rawPayload.diamondValue !== undefined && rawPayload.diamondValue !== null) {
          if (
            typeof rawPayload.diamondValue !== "number" ||
            !Number.isFinite(rawPayload.diamondValue) ||
            rawPayload.diamondValue < 0
          ) {
            return {
              success: false,
              error: {
                code: "INVALID_DATA_TYPE",
                message: "diamondValue must be a finite, non-negative number or null",
                rawKind: raw.kind,
              },
            };
          }
          diamondValue = rawPayload.diamondValue;
        }

        const repeatCount = rawPayload.repeatCount;
        const totalCount = rawPayload.totalCount;

        if (
          typeof repeatCount !== "number" ||
          !Number.isFinite(repeatCount) ||
          !Number.isInteger(repeatCount) ||
          repeatCount < 1 ||
          typeof totalCount !== "number" ||
          !Number.isFinite(totalCount) ||
          !Number.isInteger(totalCount) ||
          totalCount < 1
        ) {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "Gift quantities (repeatCount, totalCount) must be finite positive integers",
              rawKind: raw.kind,
            },
          };
        }

        if (rawPayload.streakable === undefined || rawPayload.streakable === null) {
          return {
            success: false,
            error: {
              code: "MISSING_REQUIRED_FIELD",
              message: "streakable is required and must be a boolean",
              rawKind: raw.kind,
            },
          };
        }
        if (typeof rawPayload.streakable !== "boolean") {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "streakable must be a boolean",
              rawKind: raw.kind,
            },
          };
        }
        const streakable = rawPayload.streakable;

        const estimatedDiamondTotal =
          diamondValue !== null ? diamondValue * repeatCount : null;

        const candidate = {
          specVersion: "0.1",
          eventId,
          eventType: "gift.sent",
          source: raw.source,
          room,
          user,
          payload: {
            gift: {
              id: giftId,
              name: giftName,
              imageUrl,
              diamondValue,
              streakable,
            },
            quantity: repeatCount,
            totalQuantity: totalCount,
            streak: {
              id: null,
              status: "single",
            },
            estimatedDiamondTotal,
          },
          occurredAt,
          receivedAt,
          metadata,
        };

        const parseResult = GiftSentEventSchema.safeParse(candidate);
        if (!parseResult.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `GiftSentEvent validation failed: ${parseResult.error.message}`,
              rawKind: raw.kind,
              details: parseResult.error.format(),
            },
          };
        }

        const unionParse = LiveEventEnvelopeSchema.safeParse(candidate);
        if (!unionParse.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `LiveEventEnvelope union validation failed: ${unionParse.error.message}`,
              rawKind: raw.kind,
              details: unionParse.error.format(),
            },
          };
        }

        return { success: true, event: parseResult.data };
      }

      case "chat":
      case "chat.comment":
      case "comment": {
        const commentText = rawPayload.commentText;
        if (typeof commentText !== "string") {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "commentText must be a string",
              rawKind: raw.kind,
            },
          };
        }

        const candidate = {
          specVersion: "0.1",
          eventId,
          eventType: "chat.comment",
          source: raw.source,
          room,
          user,
          payload: {
            text: commentText,
            textNormalized: commentText.trim().toLowerCase(),
            mentions: [],
          },
          occurredAt,
          receivedAt,
          metadata,
        };

        const parseResult = ChatCommentEventSchema.safeParse(candidate);
        if (!parseResult.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `ChatCommentEvent validation failed: ${parseResult.error.message}`,
              rawKind: raw.kind,
              details: parseResult.error.format(),
            },
          };
        }

        const unionParse = LiveEventEnvelopeSchema.safeParse(candidate);
        if (!unionParse.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `LiveEventEnvelope union validation failed: ${unionParse.error.message}`,
              rawKind: raw.kind,
              details: unionParse.error.format(),
            },
          };
        }

        return { success: true, event: parseResult.data };
      }

      case "follow":
      case "social.follow": {
        const candidate = {
          specVersion: "0.1",
          eventId,
          eventType: "social.follow",
          source: raw.source,
          room,
          user,
          payload: {},
          occurredAt,
          receivedAt,
          metadata,
        };

        const parseResult = SocialFollowEventSchema.safeParse(candidate);
        if (!parseResult.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `SocialFollowEvent validation failed: ${parseResult.error.message}`,
              rawKind: raw.kind,
              details: parseResult.error.format(),
            },
          };
        }

        const unionParse = LiveEventEnvelopeSchema.safeParse(candidate);
        if (!unionParse.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `LiveEventEnvelope union validation failed: ${unionParse.error.message}`,
              rawKind: raw.kind,
              details: unionParse.error.format(),
            },
          };
        }

        return { success: true, event: parseResult.data };
      }

      case "like":
      case "engagement.like": {
        const likeCount = rawPayload.likeCount;
        if (
          typeof likeCount !== "number" ||
          !Number.isFinite(likeCount) ||
          !Number.isInteger(likeCount) ||
          likeCount < 1
        ) {
          return {
            success: false,
            error: {
              code: "INVALID_DATA_TYPE",
              message: "likeCount must be a finite positive integer",
              rawKind: raw.kind,
            },
          };
        }

        let total: number | null = null;
        if (rawPayload.totalLikes !== undefined && rawPayload.totalLikes !== null) {
          if (
            typeof rawPayload.totalLikes !== "number" ||
            !Number.isFinite(rawPayload.totalLikes) ||
            !Number.isInteger(rawPayload.totalLikes) ||
            rawPayload.totalLikes < 0
          ) {
            return {
              success: false,
              error: {
                code: "INVALID_DATA_TYPE",
                message: "totalLikes must be a finite non-negative integer or null",
                rawKind: raw.kind,
              },
            };
          }
          total = rawPayload.totalLikes;
        }

        // Milestone 1 ALWAYS sets milestone: null. Never reads or propagates rawPayload.milestone.
        const milestone: null = null;

        const candidate = {
          specVersion: "0.1",
          eventId,
          eventType: "engagement.like",
          source: raw.source,
          room,
          user,
          payload: {
            delta: likeCount,
            total,
            milestone,
          },
          occurredAt,
          receivedAt,
          metadata,
        };

        const parseResult = EngagementLikeEventSchema.safeParse(candidate);
        if (!parseResult.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `EngagementLikeEvent validation failed: ${parseResult.error.message}`,
              rawKind: raw.kind,
              details: parseResult.error.format(),
            },
          };
        }

        const unionParse = LiveEventEnvelopeSchema.safeParse(candidate);
        if (!unionParse.success) {
          return {
            success: false,
            error: {
              code: "VALIDATION_FAILED",
              message: `LiveEventEnvelope union validation failed: ${unionParse.error.message}`,
              rawKind: raw.kind,
              details: unionParse.error.format(),
            },
          };
        }

        return { success: true, event: parseResult.data };
      }

      default: {
        return {
          success: false,
          error: {
            code: "UNSUPPORTED_EVENT_KIND",
            message: `Unsupported raw event kind '${raw.kind}'`,
            rawKind: raw.kind,
          },
        };
      }
    }
  }
}
