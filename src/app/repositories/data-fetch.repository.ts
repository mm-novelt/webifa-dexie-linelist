import { inject, Injectable } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';
import { DbService } from '../services/db.service';

interface PageMeta {
  hasNext: boolean;
  page: number;
}

interface PagedResponse {
  data: Record<string, unknown>[];
  meta: PageMeta;
}

@Injectable({ providedIn: 'root' })
export class DataFetchRepository {
  private queryClient = inject(QueryClient);
  private db = inject(DbService);

  async fetchAndStore(tableName: string, url: string): Promise<void> {
    let page = 1;
    let hasNext = true;

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

      hasNext = response.meta.hasNext;
      page++;
    }
  }
}
