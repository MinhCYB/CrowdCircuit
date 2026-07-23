import { z } from "zod";

/**
 * Recursive TypeScript type for JSON-safe data structures.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

/**
 * Recursive Zod schema validating JSON-safe values.
 * Strictly rejects undefined, functions, BigInts, Symbols, NaNs, infinities, Date objects, Maps, Sets, and non-plain objects.
 */
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.unknown().superRefine((val, ctx) => {
    if (val === null || typeof val === "boolean" || typeof val === "string") {
      return;
    }
    if (typeof val === "number") {
      if (!Number.isFinite(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Number must be finite (not NaN or Infinity)",
        });
      }
      return;
    }
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const result = JsonValueSchema.safeParse(val[i]);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Array element at index ${i} is not a valid JSON value`,
          });
          return;
        }
      }
      return;
    }
    if (typeof val === "object") {
      const proto = Object.getPrototypeOf(val);
      if (proto !== Object.prototype && proto !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Object must be a plain JSON object",
        });
        return;
      }
      for (const [key, value] of Object.entries(val)) {
        const result = JsonValueSchema.safeParse(value);
        if (!result.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Property '${key}' is not a valid JSON value`,
          });
          return;
        }
      }
      return;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Value is not a valid JSON value",
    });
  }) as z.ZodType<JsonValue>
);
