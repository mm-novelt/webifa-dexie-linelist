import { inject, Injectable } from '@angular/core';
import { DbService } from '../services/db.service';
import { IdbObject, IdbObjectSchema } from '../models/idb-object.model';

export type SortDirection = 'ASC' | 'DESC';

export interface PaginatedResult {
  data: IdbObject[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class DataRepository {
  private db = inject(DbService);

  async getPaginated(
    tableName: string,
    page: number,
    pageSize: number,
    orderColumn: string,
    orderDirection: SortDirection,
  ): Promise<PaginatedResult> {
    const offset = (page - 1) * pageSize;
    const table = this.db.instance.table(tableName);

    let collection = table.orderBy(orderColumn);
    if (orderDirection === 'DESC') {
      collection = collection.reverse();
    }

    const [total, rows] = await Promise.all([
      table.count(),
      collection.offset(offset).limit(pageSize).toArray(),
    ]);

    return {
      data: rows.map(row => IdbObjectSchema.parse(row)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
