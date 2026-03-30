import { z } from 'zod';

export const ConfigSchema = z.object({
  app: z.string(),
  version: z.string(),
  env: z.string(),
  tables: z.record(z.string(), z.array(z.string())),
  fetch: z.record(z.string(), z.string()),
});

export type Config = z.infer<typeof ConfigSchema>;
