import { z } from "zod";

/**
 * Strict empty payload schema for lifecycle and social events where extra payload fields are omitted.
 * Context is carried by envelope room and user fields.
 * Native Zod schema: z.record(z.never()) accepts {} and strictly rejects any key or non-object value at runtime.
 * Its inferred Zod input and output types are both Record<string, never>, forbidding property assignment at compile-time.
 */
export const EmptyPayloadSchema = z.record(z.never());

export type EmptyPayload = z.infer<typeof EmptyPayloadSchema>;

/**
 * Strict runtime Zod schema for gift.sent event payload.
 */
export const GiftSentPayloadSchema = z
  .object({
    gift: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        imageUrl: z.string().url().nullable(),
        diamondValue: z.number().finite().nonnegative().nullable(),
        streakable: z.boolean(),
      })
      .strict(),
    quantity: z.number().int().positive(),
    totalQuantity: z.number().int().positive(),
    streak: z
      .object({
        id: z.string().min(1).nullable(),
        status: z.enum(["single", "start", "update", "end"]),
      })
      .strict(),
    estimatedDiamondTotal: z.number().finite().nonnegative().nullable(),
  })
  .strict();

export type GiftSentPayload = z.infer<typeof GiftSentPayloadSchema>;

/**
 * Strict runtime Zod schema for chat.comment event payload.
 */
export const ChatCommentPayloadSchema = z
  .object({
    text: z.string().min(1),
    textNormalized: z.string().min(1),
    mentions: z.array(z.string()),
  })
  .strict();

export type ChatCommentPayload = z.infer<typeof ChatCommentPayloadSchema>;

/**
 * Strict runtime Zod schema for engagement.like event payload.
 */
export const LikePayloadSchema = z
  .object({
    delta: z.number().int().positive(),
    total: z.number().int().nonnegative().nullable(),
    milestone: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type LikePayload = z.infer<typeof LikePayloadSchema>;
