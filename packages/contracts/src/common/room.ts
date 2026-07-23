import { z } from "zod";

/**
 * Normalized reference to a LIVE broadcast room.
 */
export const RoomRefSchema = z.object({
  roomId: z.string().min(1).nullable(),
  streamerUniqueId: z.string().min(1),
});

export type RoomRef = z.infer<typeof RoomRefSchema>;
