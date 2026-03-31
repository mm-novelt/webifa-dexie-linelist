import { z } from 'zod';

/**
 * Base schema for every record stored in IndexedDB.
 *
 * All tables share these two mandatory fields. Additional domain-specific
 * properties are allowed via `.passthrough()` and are preserved at runtime
 * even though they are not part of the schema definition.
 */
export const IdbObjectSchema = z.object({
  /** Unique string identifier for the record (primary key in IndexedDB). */
  id: z.string(),
  /** ISO 8601 creation timestamp. */
  createdAt: z.string(),
}).passthrough();

/** Typed representation of a generic IndexedDB record. */
export type IdbObject = z.infer<typeof IdbObjectSchema>;
