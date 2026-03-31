import { z } from 'zod';

export const ConfigSchema = z.object({
  app: z.string(),
  version: z.string(),
  tables: z.record(z.string(), z.array(z.string())),
  fetch: z.record(z.string(), z.string()),
  searchEngine: z.record(z.string(), z.array(z.string())).default({}),
  multiEntry: z.record(z.string(), z.record(z.string(), z.string())).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
