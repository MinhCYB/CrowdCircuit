import { z } from "zod";

function hasControlChar(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Validates audioUrl string conservatively:
 * 1. Absolute http: or https: URL (valid host, no username/password credentials).
 * 2. Conservative root-relative local media path (starts with single '/', no backslashes, no dot traversal segments, no control chars, no query/fragment), verified after one decodeURIComponent pass.
 */
function isValidAudioUrl(val: string): boolean {
  if (typeof val !== "string" || val.length === 0) return false;
  if (hasControlChar(val)) return false;

  if (val.startsWith("/")) {
    if (val.startsWith("//")) return false;
    if (val.includes("\\")) return false;
    if (val.includes("?") || val.includes("#")) return false;

    let decoded: string;
    try {
      decoded = decodeURIComponent(val);
    } catch {
      return false;
    }

    if (!decoded.startsWith("/") || decoded.startsWith("//")) return false;
    if (hasControlChar(decoded)) return false;
    if (decoded.includes("\\")) return false;
    if (decoded.includes("?") || decoded.includes("#")) return false;

    const segments = decoded.split("/");
    const nonEmpties = segments.filter((s) => s.length > 0);
    if (nonEmpties.length === 0) return false;
    for (const seg of nonEmpties) {
      if (seg === "." || seg === "..") return false;
    }
    return true;
  }

  try {
    const url = new URL(val);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname) return false;
    if (url.username || url.password) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Strict runtime Zod schema for voice play message (voice.play).
 * Delivered to voice output client to trigger audio playback.
 */
export const VoicePlayMessageSchema = z
  .object({
    type: z.literal("voice.play"),
    jobId: z.string().min(1),
    audioUrl: z.string().min(1).refine(isValidAudioUrl, {
      message:
        "Must be a conservative root-relative path (starting with single '/') or a valid absolute http/https URL without credentials",
    }),
    subtitle: z.string().min(1),
    volume: z.number().finite().min(0).max(1),
  })
  .strict();

export type VoicePlayMessage = z.infer<typeof VoicePlayMessageSchema>;

/**
 * Strict runtime Zod schema for playback started callback (playback.started).
 */
export const VoicePlaybackStartedMessageSchema = z
  .object({
    type: z.literal("playback.started"),
    jobId: z.string().min(1),
  })
  .strict();

export type VoicePlaybackStartedMessage = z.infer<
  typeof VoicePlaybackStartedMessageSchema
>;

/**
 * Strict runtime Zod schema for playback finished callback (playback.finished).
 */
export const VoicePlaybackFinishedMessageSchema = z
  .object({
    type: z.literal("playback.finished"),
    jobId: z.string().min(1),
  })
  .strict();

export type VoicePlaybackFinishedMessage = z.infer<
  typeof VoicePlaybackFinishedMessageSchema
>;

/**
 * Strict runtime Zod schema for playback interrupted callback (playback.interrupted).
 */
export const VoicePlaybackInterruptedMessageSchema = z
  .object({
    type: z.literal("playback.interrupted"),
    jobId: z.string().min(1),
  })
  .strict();

export type VoicePlaybackInterruptedMessage = z.infer<
  typeof VoicePlaybackInterruptedMessageSchema
>;

/**
 * Strict runtime Zod schema for voice playback error object.
 */
export const VoicePlaybackErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export type VoicePlaybackError = z.infer<typeof VoicePlaybackErrorSchema>;

/**
 * Strict runtime Zod schema for playback failed callback (playback.failed).
 */
export const VoicePlaybackFailedMessageSchema = z
  .object({
    type: z.literal("playback.failed"),
    jobId: z.string().min(1),
    error: VoicePlaybackErrorSchema,
  })
  .strict();

export type VoicePlaybackFailedMessage = z.infer<
  typeof VoicePlaybackFailedMessageSchema
>;

/**
 * Discriminated union Zod schema for public Voice Output playback callback messages.
 * Discriminated on the type property using playback.* literals (ADR-010).
 */
export const VoicePlaybackCallbackMessageSchema = z.discriminatedUnion("type", [
  VoicePlaybackStartedMessageSchema,
  VoicePlaybackFinishedMessageSchema,
  VoicePlaybackInterruptedMessageSchema,
  VoicePlaybackFailedMessageSchema,
]);

export const VoicePlaybackMessageSchema = VoicePlaybackCallbackMessageSchema;

export type VoicePlaybackCallbackMessage = z.infer<
  typeof VoicePlaybackCallbackMessageSchema
>;

export type VoicePlaybackMessage = VoicePlaybackCallbackMessage;
