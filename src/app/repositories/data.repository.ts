import { inject, Injectable } from '@angular/core';
import { IndexableType } from 'dexie';
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

  async getById(tableName: string, id: unknown): Promise<IdbObject | undefined> {
    const table = this.db.instance.table(tableName);
    const record = await table.get(id as string);
    if (!record) return undefined;
    return IdbObjectSchema.parse(record);
  }

  async getByForeignKey(tableName: string, foreignKey: string, value: unknown): Promise<IdbObject[]> {
    const table = this.db.instance.table(tableName);
    const records = await table.where(foreignKey).equals(value as IndexableType).toArray();
    return records.map(r => IdbObjectSchema.parse(r));
  }

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
