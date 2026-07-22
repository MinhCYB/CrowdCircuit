import { z } from "zod";

/**
 * Minimal non-domain schema used to verify Zod runtime validation,
 * TypeScript type inference, and public package exports for @crowdcircuit/contracts.
 */
export const SampleContractSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().positive(),
  active: z.boolean(),
});

export type SampleContract = z.infer<typeof SampleContractSchema>;
