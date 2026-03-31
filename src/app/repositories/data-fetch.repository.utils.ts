/**
 * Parses Dexie index definition strings and returns the set of plain field
 * names they reference.
 *
 * Supported formats:
 * - Simple: `"id"`, `"+createdAt"`, `"&email"`, `"*tags"` → field name after stripping prefix characters.
 * - Compound: `"[status+year]"` → each `+`-separated part is extracted individually.
 *
 * @param indexes Array of raw Dexie index definition strings.
 * @returns Deduplicated array of field names.
 */
export function extractIndexedFieldNames(indexes: string[]): string[] {
  const fields = new Set<string>();
  for (const idx of indexes) {
    const clean = idx.trim();
    if (clean.startsWith('[') && clean.endsWith(']')) {
      for (const part of clean.slice(1, -1).split('+')) {
        fields.add(part.trim());
      }
    } else {
      const name = clean.replace(/^[+&*]+/, '');
      if (name) fields.add(name);
    }
  }
  return [...fields];
}

/**
 * Returns a shallow copy of `record` containing only the keys listed in `fields`.
 * Keys absent from the record are omitted from the result.
 */
export function pick(record: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in record) result[field] = record[field];
  }
  return result;
}
