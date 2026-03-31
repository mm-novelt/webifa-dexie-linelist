import { inject, Injectable } from '@angular/core';
import { IndexableType, Table } from 'dexie';
import { DbService } from '../services/db.service';
import { IdbObject, IdbObjectSchema } from '../models/idb-object.model';
import { InternalFilter } from '../models/config.model';
import { buildCacheKey, buildEffectiveFilterCacheKey, compoundValues } from './data.repository.utils';

/** Sort direction used when ordering paginated results. */
export type SortDirection = 'ASC' | 'DESC';

/** Result payload returned by {@link DataRepository.getPaginated}. */
export interface PaginatedResult {
  data: IdbObject[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Cache entry that maps a (filteredIds, orderColumn, orderDirection, tableName)
 * combination to the full ordered list of matching IDs and its pre-computed pages.
 *
 * Avoids re-sorting and re-slicing on every page navigation as long as the
 * filter set, sort column, sort direction, and table name do not change.
 */
interface FilteredOrderCache {
  key: string;
  orderedFilteredIds: string[];
  pageSize: number;
  pages: Map<number, string[]>;
}

/**
 * Cache entry that stores the result of combining an active user filter set
 * with an {@link InternalFilter} compound query.
 *
 * Computing the intersection via a Dexie compound-index lookup is expensive,
 * so the result is memoised until any of the inputs change.
 */
interface EffectiveFilterCache {
  key: string;
  effectiveFilteredIds: string[];
}

/**
 * Repository that provides all read operations against the IndexedDB tables
 * managed by {@link DbService}.
 *
 * ### Table naming convention
 * Each logical table is split into two physical IndexedDB object stores:
 * - `<tableName>_data` – full record payload; primary key only.
 * - `<tableName>_indexed` – lightweight projection with all indexed fields;
 *   used exclusively for filtering, sorting, and search queries.
 *
 * ### Caching
 * {@link getPaginated} maintains two in-memory caches:
 * - {@link effectiveFilterCache} – memoises the intersection of user filters
 *   with an {@link InternalFilter} compound query.
 * - {@link filteredOrderCache} – memoises the ordered list of matching IDs
 *   and slices it into pages so that page changes are O(1) lookups.
 *
 * Both caches are invalidated automatically whenever their inputs change.
 */
@Injectable({ providedIn: 'root' })
export class DataRepository {
  private db = inject(DbService);
  private filteredOrderCache: FilteredOrderCache | null = null;
  private effectiveFilterCache: EffectiveFilterCache | null = null;

  /**
   * Fetches a single record from `<tableName>_data` by its primary key.
   *
   * @param tableName Logical table name (without `_data` suffix).
   * @param id Primary key of the record to retrieve.
   * @returns The parsed {@link IdbObject}, or `undefined` when not found.
   */
  async getById(tableName: string, id: string): Promise<IdbObject | undefined> {
    const table = this.db.instance.table(`${tableName}_data`);
    const record = await table.get(id);
    if (!record) return undefined;
    return IdbObjectSchema.parse(record);
  }

  /**
   * Returns all records from `<tableName>_data` whose indexed projection
   * contains a matching value for the given foreign-key field.
   *
   * The lookup is performed against `<tableName>_indexed` for efficiency,
   * then the full records are fetched from `<tableName>_data`.
   *
   * @param tableName Logical table name.
   * @param foreignKey Indexed field name to filter on.
   * @param value Value to match against `foreignKey`.
   */
  async getByForeignKey(tableName: string, foreignKey: string, value: IndexableType): Promise<IdbObject[]> {
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);
    const ids = await indexedTable.where(foreignKey).equals(value).primaryKeys();
    if (ids.length === 0) return [];
    const dataTable = this.db.instance.table(`${tableName}_data`);
    const records = await dataTable.where('id').anyOf(ids as string[]).toArray();
    return records.map(r => IdbObjectSchema.parse(r));
  }

  /**
   * Returns a single page of records, optionally restricted to a set of
   * pre-filtered IDs and/or an {@link InternalFilter} compound query.
   *
   * **Filtering pipeline:**
   * 1. If `selectedInternalFilter` is provided, compute `effectiveFilteredIds`
   *    by intersecting `filteredIds` (if any) with the compound-index result.
   *    The result is memoised in {@link effectiveFilterCache}.
   * 2. If `effectiveFilteredIds` (or plain `filteredIds`) is set, sort all
   *    matching IDs by `orderColumn` and pre-compute pages.  The ordered list
   *    is memoised in {@link filteredOrderCache}.
   * 3. When no filter is active the query falls back to a direct Dexie
   *    `orderBy().offset().limit()` call.
   *
   * @param tableName Logical table name.
   * @param page 1-based page number.
   * @param pageSize Number of records per page.
   * @param orderColumn Indexed field to sort by.
   * @param orderDirection Sort direction.
   * @param filteredIds Optional set of record IDs to restrict results to
   *                    (produced by the active user-facing filters).
   * @param selectedInternalFilter Optional compound filter to intersect with.
   */
  async getPaginated(
    tableName: string,
    page: number,
    pageSize: number,
    orderColumn: string,
    orderDirection: SortDirection,
    filteredIds?: string[],
    selectedInternalFilter?: InternalFilter | null,
  ): Promise<PaginatedResult> {
    const offset = (page - 1) * pageSize;
    const dataTable = this.db.instance.table(`${tableName}_data`);
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);

    let effectiveFilteredIds: string[] | undefined = undefined;

    if (selectedInternalFilter) {
      const effectiveCacheKey = buildEffectiveFilterCacheKey(tableName, filteredIds, selectedInternalFilter);
      if (this.effectiveFilterCache?.key === effectiveCacheKey) {
        effectiveFilteredIds = this.effectiveFilterCache.effectiveFilteredIds;
      } else {
        const filterVals = compoundValues(selectedInternalFilter.index, selectedInternalFilter.value);
        if (filteredIds?.length) {
          const compounds = filteredIds.map(id => [id, ...filterVals]);
          effectiveFilteredIds = await indexedTable
            .where(selectedInternalFilter.indexWithFilter)
            .anyOf(compounds)
            .primaryKeys() as string[];
        } else {
          effectiveFilteredIds = await indexedTable
            .where(selectedInternalFilter.index)
            .equals(filterVals)
            .primaryKeys() as string[];
        }
        this.effectiveFilterCache = { key: effectiveCacheKey, effectiveFilteredIds };
      }
    } else if (filteredIds) {
      effectiveFilteredIds = filteredIds;
    }

    if (effectiveFilteredIds !== undefined) {
      const cacheKey = buildCacheKey(tableName, effectiveFilteredIds, orderColumn, orderDirection);
      let cache = this.filteredOrderCache;

      if (!cache || cache.key !== cacheKey || cache.pageSize !== pageSize) {
        const allowedSet = new Set(effectiveFilteredIds);
        let collection = indexedTable.orderBy(orderColumn);
        if (orderDirection === 'DESC') collection = collection.reverse();
        const allOrderedIds = await collection.primaryKeys() as string[];
        const orderedFilteredIds = allOrderedIds.filter(id => allowedSet.has(id));

        const pages = new Map<number, string[]>();
        for (let p = 1; p <= Math.ceil(orderedFilteredIds.length / pageSize); p++) {
          const off = (p - 1) * pageSize;
          pages.set(p, orderedFilteredIds.slice(off, off + pageSize));
        }

        cache = { key: cacheKey, orderedFilteredIds, pageSize, pages };
        this.filteredOrderCache = cache;
      }

      const total = cache.orderedFilteredIds.length;
      const pageIds = cache.pages.get(page) ?? [];
      const recordMap = new Map(
        (await dataTable.where('id').anyOf(pageIds).toArray())
          .map(r => [r['id'] as string, r]),
      );
      const rows = pageIds
        .map(id => recordMap.get(id))
        .filter((r): r is IdbObject => r !== undefined);
      return {
        data: rows.map(row => IdbObjectSchema.parse(row)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

    // No active filter — use a direct paginated query.
    let collection = indexedTable.orderBy(orderColumn);
    if (orderDirection === 'DESC') {
      collection = collection.reverse();
    }

    const [total, orderedIds] = await Promise.all([
      indexedTable.count(),
      collection.offset(offset).limit(pageSize).primaryKeys(),
    ]);

    const recordMap = new Map(
      (await dataTable.where('id').anyOf(orderedIds as string[]).toArray())
        .map(r => [r['id'] as string, r]),
    );
    const rows = (orderedIds as string[])
      .map(id => recordMap.get(id))
      .filter((r): r is IdbObject => r !== undefined);

    return {
      data: rows.map(row => IdbObjectSchema.parse(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Returns the primary keys of all records in `<tableName>_indexed` where
   * at least one of the given `fields` starts with `term` (case-insensitive).
   *
   * Only fields that are actually indexed in Dexie are queried; unindexed
   * fields are silently ignored.
   *
   * @param tableName Logical table name.
   * @param fields Fields to search across.
   * @param term Search prefix.
   * @returns Deduplicated array of matching primary keys.
   */
  async searchByText(tableName: string, fields: string[], term: string): Promise<string[]> {
    if (!term) return [];
    const table = this.db.instance.table(`${tableName}_indexed`);
    const indexedFields = this.getIndexedFields(table, fields);
    if (indexedFields.length === 0) return [];

    const results = await Promise.all(
      indexedFields.map(field =>
        table.where(field).startsWithIgnoreCase(term).primaryKeys(),
      ),
    );

    const union = new Set<string>();
    for (const keys of results) {
      for (const key of keys) union.add(key as string);
    }
    return [...union];
  }

  /**
   * Returns the primary keys of all records in `<tableName>_indexed` where
   * `field` equals `value` exactly.
   *
   * @param tableName Logical table name.
   * @param field Indexed field to match.
   * @param value Exact value to filter by.
   */
  async searchByExactValue(tableName: string, field: string, value: IndexableType): Promise<string[]> {
    const table = this.db.instance.table(`${tableName}_indexed`);
    const keys = await table.where(field).equals(value).primaryKeys();
    return keys as string[];
  }

  /**
   * Returns the primary keys of all records in `<tableName>_indexed` where
   * `field` falls within the inclusive range `[lower, upper]`.
   *
   * @param tableName Logical table name.
   * @param field Indexed field to range-query.
   * @param lower Inclusive lower bound.
   * @param upper Inclusive upper bound.
   */
  async searchByRange(tableName: string, field: string, lower: IndexableType, upper: IndexableType): Promise<string[]> {
    const table = this.db.instance.table(`${tableName}_indexed`);
    const keys = await table.where(field).between(lower, upper, true, true).primaryKeys();
    return keys as string[];
  }

  /**
   * Returns the primary keys of all records in `<tableName>_indexed` where
   * `field` matches any of the provided `values`.
   *
   * @param tableName Logical table name.
   * @param field Indexed field to match.
   * @param values List of acceptable values.
   */
  async searchByAnyOf(tableName: string, field: string, values: IndexableType[]): Promise<string[]> {
    if (values.length === 0) return [];
    const table = this.db.instance.table(`${tableName}_indexed`);
    const keys = await table.where(field).anyOf(values).primaryKeys();
    return keys as string[];
  }

  /**
   * Performs a prefix text search and returns the matching records from the
   * `<tableName>_indexed` table.
   *
   * Note: records are returned from the *indexed* projection rather than the
   * full data store. This is intentional: callers (e.g. the foreign-key
   * autocomplete) only need the display property, which is always indexed.
   *
   * @param tableName Logical table name.
   * @param fields Fields to search across.
   * @param term Search prefix.
   * @returns Array of matching indexed records.
   */
  async searchByTextAsRecords(tableName: string, fields: string[], term: string): Promise<IdbObject[]> {
    const ids = await this.searchByText(tableName, fields, term);
    if (ids.length === 0) return [];
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);
    const records = await indexedTable.where('id').anyOf(ids).toArray();
    return records.map(r => IdbObjectSchema.parse(r));
  }

  /**
   * Filters the given `fields` list down to only those that have an index
   * on the provided Dexie `table` (including the primary key).
   *
   * Unindexed fields cannot be used in Dexie `where()` queries; this guard
   * prevents runtime errors when the configuration references non-indexed fields.
   */
  private getIndexedFields(table: Table, fields: string[]): string[] {
    const indexed = new Set([
      table.schema.primKey.name,
      ...table.schema.indexes.map((idx: { name: string }) => idx.name),
    ]);
    return fields.filter(f => indexed.has(f));
  }
}
