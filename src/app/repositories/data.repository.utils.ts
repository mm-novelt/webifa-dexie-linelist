import { InternalFilter } from '../models/config.model';

/**
 * Extracts the scalar field values from a compound index key and an
 * {@link InternalFilter} value map, preserving the order defined by the index.
 *
 * Example: index `"[status+year]"`, value `{ status: 'open', year: 2024 }`
 * → `['open', 2024]`
 */
export function compoundValues(index: string, value: Record<string, string | number>): (string | number)[] {
  return index.slice(1, -1).split('+').map(f => value[f]);
}

/**
 * Builds a stable cache key for the filtered-order cache.
 *
 * The key encodes the table name, sort column, sort direction, and the sorted
 * set of filtered IDs so that any change to the active filter invalidates the
 * cache.
 */
export function buildCacheKey(tableName: string, ids: string[], orderColumn: string, orderDirection: string): string {
  return `${tableName}:${orderColumn}:${orderDirection}:${ids.slice().sort().join(',')}`;
}

/**
 * Builds a stable cache key for the effective-filter cache.
 *
 * Encodes the table name, internal filter definition, and the current set of
 * user-selected IDs so the compound-index intersection is only recomputed when
 * any of these inputs change.
 */
export function buildEffectiveFilterCacheKey(
  tableName: string,
  filteredIds: string[] | undefined,
  selectedInternalFilter: InternalFilter,
): string {
  const filterPart = `${selectedInternalFilter.index}:${JSON.stringify(selectedInternalFilter.value)}`;
  const idsPart = filteredIds?.length ? filteredIds.slice().sort().join(',') : '';
  return `${tableName}:${filterPart}|${idsPart}`;
}
