import { inject, Injectable } from '@angular/core';
import { IndexableType, Table } from 'dexie';
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
    filteredIds?: string[],
  ): Promise<PaginatedResult> {
    const offset = (page - 1) * pageSize;
    const table = this.db.instance.table(tableName);

    if (filteredIds !== undefined) {
      const primaryKey = table.schema.primKey.name;
      const rows = await table.where(primaryKey).anyOf(filteredIds).toArray();
      rows.sort((a, b) => {
        const av = a[orderColumn] as string;
        const bv = b[orderColumn] as string;
        if (av < bv) return orderDirection === 'ASC' ? -1 : 1;
        if (av > bv) return orderDirection === 'ASC' ? 1 : -1;
        return 0;
      });
      const total = rows.length;
      return {
        data: rows.slice(offset, offset + pageSize).map(row => IdbObjectSchema.parse(row)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

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

  async searchByText(tableName: string, fields: string[], term: string): Promise<string[]> {
    if (!term) return [];
    const table = this.db.instance.table(tableName);
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

  private getIndexedFields(table: Table, fields: string[]): string[] {
    const indexed = new Set([
      table.schema.primKey.name,
      ...table.schema.indexes.map((idx: { name: string }) => idx.name),
    ]);
    return fields.filter(f => indexed.has(f));
  }
}
