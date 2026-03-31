import { inject, Injectable, WritableSignal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { DbService } from '../services/db.service';
import { ForeignFieldConfig } from '../models/config.model';

interface PageMeta {
  total: number;
  perPage: number;
  totalPages: number;
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PagedResponse {
  data: Record<string, unknown>[];
  meta: PageMeta;
}

export interface TableFetchProgress {
  tableName: string;
  recordsLoaded: number;
  total: number;
  percent: number;
  done: boolean;
  label?: string;
}

@Injectable({ providedIn: 'root' })
export class DataFetchRepository {
  private queryClient = inject(QueryClient);
  private db = inject(DbService);

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

  async enrichIndexed(
    tableName: string,
    foreignFields: Record<string, ForeignFieldConfig>,
    progress?: WritableSignal<TableFetchProgress>,
  ): Promise<void> {
    const BATCH_SIZE = 500;
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);
    const allRecords = await indexedTable.toArray() as Record<string, unknown>[];
    const total = allRecords.length;

    // Build one lookup map per unique foreignTable
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

function extractIndexedFieldNames(indexes: string[]): string[] {
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

function pick(record: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in record) result[field] = record[field];
  }
  return result;
}
