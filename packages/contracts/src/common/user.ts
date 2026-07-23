import { z } from "zod";

/**
 * Normalized reference to a live broadcast viewer or user.
 */
export const UserRefSchema = z.object({
  id: z.string().min(1).nullable(),
  uniqueId: z.string().min(1).nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  roles: z.array(z.string()),
});

export type UserRef = z.infer<typeof UserRefSchema>;
