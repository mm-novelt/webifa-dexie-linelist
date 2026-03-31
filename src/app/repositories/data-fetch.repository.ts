import { inject, Injectable, WritableSignal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { DbService } from '../services/db.service';
import { ForeignFieldConfig } from '../models/config.model';
import { extractIndexedFieldNames, pick } from './data-fetch.repository.utils';

/** Pagination metadata returned by the remote API. */
interface PageMeta {
  total: number;
  perPage: number;
  totalPages: number;
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Shape of a single paginated response from the remote API. */
interface PagedResponse {
  data: Record<string, unknown>[];
  meta: PageMeta;
}

/**
 * Progress snapshot for a single table fetch operation.
 *
 * Emitted via a {@link WritableSignal} so the UI can show a live progress bar.
 */
export interface TableFetchProgress {
  /** Logical name of the table being processed. */
  tableName: string;
  /** Number of records loaded so far. */
  recordsLoaded: number;
  /** Total number of records reported by the API. */
  total: number;
  /** Integer percentage (0–100). */
  percent: number;
  /** `true` when all pages have been fetched and stored. */
  done: boolean;
  /** Optional human-readable label for the current phase (e.g. `"Indexing"`). */
  label?: string;
}

/**
 * Repository that handles the initial data synchronisation from the remote API
 * into the local IndexedDB database.
 *
 * ### Responsibilities
 * 1. **{@link fetchAndStore}** – pages through a remote endpoint, transforms
 *    each record into an indexed projection, and bulk-inserts both the raw
 *    data and the projection into their respective IndexedDB stores.
 * 2. **{@link enrichIndexed}** – after all tables are loaded, joins foreign
 *    table values into the indexed projections so they can be filtered and
 *    sorted without re-querying related tables at render time.
 *
 * TanStack Query is used as the HTTP cache layer so that individual API pages
 * are never re-fetched within the same session.
 */
@Injectable({ providedIn: 'root' })
export class DataFetchRepository {
  private queryClient = inject(QueryClient);
  private db = inject(DbService);

  /**
   * Fetches all pages from a remote API endpoint and stores the results in
   * the IndexedDB `<tableName>_data` and `<tableName>_indexed` stores.
   *
   * **Processing pipeline per record:**
   * 1. Extract only the fields referenced by the Dexie index definitions
   *    (`indexDefinitions`) to create the indexed projection.
   * 2. If a field is declared in `computedFields` but absent from the record,
   *    initialise it to `null` so the index slot exists for later enrichment.
   * 3. If a field is declared in `multiEntry`, split its string value on the
   *    given separator and store the result as an array (Dexie multi-entry
   *    index) while keeping the original value as the first element.
   *
   * Progress is reported after every page via the `progress` signal.
   *
   * @param tableName Logical table name (used to derive `_data` / `_indexed` store names).
   * @param url Base URL of the paginated API endpoint (page number is appended as `?page=N`).
   * @param indexDefinitions Dexie index definition strings for this table
   *                         (used to extract the set of indexed field names).
   * @param progress Signal updated after each page with the current {@link TableFetchProgress}.
   * @param multiEntry Optional map of field name → separator string for multi-entry fields.
   * @param computedFields Optional list of fields that will be computed during enrichment
   *                       and must be pre-initialised to `null` in the indexed projection.
   */
  async fetchAndStore(
    tableName: string,
    url: string,
    indexDefinitions: string[],
    progress: WritableSignal<TableFetchProgress>,
    multiEntry?: Record<string, string>,
    computedFields?: string[],
  ): Promise<void> {
    const indexedFields = extractIndexedFieldNames(indexDefinitions);
    let page = 1;
    let hasNext = true;
    let recordsLoaded = 0;

    const dataTable = this.db.instance.table(`${tableName}_data`);
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);

    while (hasNext) {
      const response = await this.queryClient.fetchQuery<PagedResponse>({
        queryKey: ['fetch', tableName, page],
        queryFn: async () => {
          const res = await fetch(`${url}?page=${page}`);
          if (!res.ok) throw new Error(`Failed to fetch ${url}?page=${page}`);
          return res.json() as Promise<PagedResponse>;
        },
        staleTime: Infinity,
        gcTime: Infinity,
      });

      const indexedRecords = response.data.map(record => {
        const picked = pick(record, indexedFields);
        if (computedFields) {
          for (const field of computedFields) {
            if (!(field in picked)) picked[field] = null;
          }
        }
        if (multiEntry) {
          for (const [field, separator] of Object.entries(multiEntry)) {
            if (field in picked && typeof picked[field] === 'string') {
              const original = picked[field] as string;
              // Store as [original, ...tokens] so the full value is also queryable.
              picked[field] = [original, ...original.split(separator)];
            }
          }
        }
        return picked;
      });

      await Promise.all([
        dataTable.bulkPut(response.data),
        indexedTable.bulkPut(indexedRecords),
      ]);

      recordsLoaded += response.data.length;
      hasNext = response.meta.hasNext;
      const { total } = response.meta;
      page++;
      progress.set({
        tableName,
        recordsLoaded,
        total,
        percent: Math.round((recordsLoaded / total) * 100),
        done: !hasNext,
      });
    }
  }

  /**
   * Enriches the `<tableName>_indexed` store by joining values from related
   * (foreign) tables into each record's indexed projection.
   *
   * This is a post-fetch step that allows the linelist to filter and sort by
   * denormalised foreign values (e.g. the name of a linked patient) without
   * performing live joins at query time.
   *
   * **Algorithm:**
   * 1. Build one in-memory lookup `Map<id, record>` per unique foreign table.
   * 2. Process the indexed records in batches of 500 to avoid holding too many
   *    objects in memory at once.
   * 3. For each record, resolve every foreign field from the appropriate lookup
   *    map and write the resolved value (or `null`) into the projection.
   * 4. Bulk-write the enriched batch back to the indexed store.
   *
   * @param tableName Logical table name whose indexed store will be enriched.
   * @param foreignFields Map of target field name → {@link ForeignFieldConfig}
   *                      describing how to resolve the value from the foreign table.
   * @param progress Optional signal for progress reporting (labelled `"Indexing"`).
   */
  async enrichIndexed(
    tableName: string,
    foreignFields: Record<string, ForeignFieldConfig>,
    progress?: WritableSignal<TableFetchProgress>,
  ): Promise<void> {
    const BATCH_SIZE = 500;
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);
    const allRecords = await indexedTable.toArray() as Record<string, unknown>[];
    const total = allRecords.length;

    // Build one lookup map per unique foreign table to avoid redundant full-table scans.
    const tableMaps = new Map<string, Map<unknown, Record<string, unknown>>>();
    for (const cfg of Object.values(foreignFields)) {
      if (!tableMaps.has(cfg.foreignTable)) {
        const rows = await this.db.instance.table(`${cfg.foreignTable}_indexed`).toArray() as Record<string, unknown>[];
        const map = new Map<unknown, Record<string, unknown>>();
        for (const r of rows) map.set(r['id'], r);
        tableMaps.set(cfg.foreignTable, map);
      }
    }

    progress?.set({ tableName, recordsLoaded: 0, total, percent: 0, done: false, label: 'Indexing' });

    let processed = 0;
    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE).map(record => {
        const result = { ...record };
        for (const [fieldName, cfg] of Object.entries(foreignFields)) {
          const tableMap = tableMaps.get(cfg.foreignTable);
          const foreignRecord = tableMap?.get(record[cfg.foreignKey]);
          result[fieldName] = foreignRecord ? (foreignRecord[cfg.property] ?? null) : null;
        }
        return result;
      });

      await indexedTable.bulkPut(batch);
      processed += batch.length;
      progress?.set({
        tableName,
        recordsLoaded: processed,
        total,
        percent: Math.round((processed / total) * 100),
        done: processed >= total,
        label: 'Indexing',
      });
    }
  }
}
