import { z } from "zod";

/**
 * Technical metadata attached to a normalized event.
 */
export const EventMetadataSchema = z.object({
  connectorId: z.string().min(1),
  connectorVersion: z.string().min(1).optional(),
  sequenceId: z.string().min(1).optional(),
  isReplay: z.boolean(),
  rawStored: z.boolean(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;
