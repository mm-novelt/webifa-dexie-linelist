import { inject, Injectable, WritableSignal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { DbService } from '../services/db.service';
import { SearchEngineService } from '../services/search-engine.service';

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
}

@Injectable({ providedIn: 'root' })
export class DataFetchRepository {
  private queryClient = inject(QueryClient);
  private db = inject(DbService);
  private searchEngine = inject(SearchEngineService);

  async fetchAndStore(
    tableName: string,
    url: string,
    indexDefinitions: string[],
    progress: WritableSignal<TableFetchProgress>,
    searchProperties?: string[],
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

      const indexedRecords = response.data.map(record => pick(record, indexedFields));

      const writes: Promise<unknown>[] = [
        dataTable.bulkPut(response.data),
        indexedTable.bulkPut(indexedRecords),
      ];
      if (searchProperties?.length) {
        writes.push(this.searchEngine.indexItems(tableName, searchProperties, indexedRecords));
      }
      await Promise.all(writes);

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
