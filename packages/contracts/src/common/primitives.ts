import { z } from "zod";

/**
 * Platform specification version constant.
 */
export const SPEC_VERSION = "0.1" as const;

/**
 * Zod schema restricting specVersion strictly to "0.1".
 */
export const SpecVersionSchema = z.literal(SPEC_VERSION);
export type SpecVersion = z.infer<typeof SpecVersionSchema>;

/**
 * Zod schema for ISO 8601 UTC datetime strings (e.g. "2026-07-20T03:00:00.000Z").
 */
export const IsoDateTimeSchema = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * Supported event source platform types.
 */
export const EventSourceSchema = z.enum(["tiktok", "tikfinity", "mock"]);
export type EventSource = z.infer<typeof EventSourceSchema>;
