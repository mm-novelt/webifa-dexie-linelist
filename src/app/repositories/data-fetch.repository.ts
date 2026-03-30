import { inject, Injectable, WritableSignal } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { DbService } from '../services/db.service';

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

  async fetchAndStore(
    tableName: string,
    url: string,
    progress: WritableSignal<TableFetchProgress>,
  ): Promise<void> {
    let page = 1;
    let hasNext = true;
    let recordsLoaded = 0;

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

      const table = this.db.instance.table(tableName);
      await table.bulkPut(response.data);

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
