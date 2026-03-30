import { z } from 'zod';

export const IdbObjectSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
}).passthrough();

export type IdbObject = z.infer<typeof IdbObjectSchema>;
