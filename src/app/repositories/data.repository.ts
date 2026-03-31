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

  async getById(tableName: string, id: string): Promise<IdbObject | undefined> {
    const table = this.db.instance.table(`${tableName}_data`);
    const record = await table.get(id);
    if (!record) return undefined;
    return IdbObjectSchema.parse(record);
  }

  async getByForeignKey(tableName: string, foreignKey: string, value: IndexableType): Promise<IdbObject[]> {
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);
    const ids = await indexedTable.where(foreignKey).equals(value).primaryKeys();
    if (ids.length === 0) return [];
    const dataTable = this.db.instance.table(`${tableName}_data`);
    const records = await dataTable.where('id').anyOf(ids as string[]).toArray();
    return records.map(r => IdbObjectSchema.parse(r));
  }

  async getPaginated(
    tableName: string,
    page: number,
    pageSize: number,
    orderColumn: string,
    orderDirection: SortDirection,
    filteredIds?: string[],
    internalFilters?: Array<{ field: string; value: string | number }>,
  ): Promise<PaginatedResult> {
    const offset = (page - 1) * pageSize;
    const dataTable = this.db.instance.table(`${tableName}_data`);
    const indexedTable = this.db.instance.table(`${tableName}_indexed`);

    let effectiveFilteredIds = filteredIds;
    if (internalFilters?.length) {
      const internalIdSets = await Promise.all(
        internalFilters.map(f => indexedTable.where(f.field).equals(f.value).primaryKeys() as Promise<string[]>),
      );
      const internalIds = internalIdSets.reduce((acc, ids) => {
        const lookup = new Set(ids);
        return acc.filter(id => lookup.has(id));
      });
      effectiveFilteredIds = filteredIds !== undefined
        ? filteredIds.filter(id => new Set(internalIds).has(id))
        : internalIds;
    }

    if (effectiveFilteredIds !== undefined) {
      const allowedSet = new Set(effectiveFilteredIds);
      let collection = indexedTable.orderBy(orderColumn);
      if (orderDirection === 'DESC') collection = collection.reverse();
      const allOrderedIds = await collection.primaryKeys() as string[];
      const orderedFilteredIds = allOrderedIds.filter(id => allowedSet.has(id));
      const total = orderedFilteredIds.length;
      const pageIds = orderedFilteredIds.slice(offset, offset + pageSize);
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

  async searchByExactValue(tableName: string, field: string, value: IndexableType): Promise<string[]> {
    const table = this.db.instance.table(`${tableName}_indexed`);
    const keys = await table.where(field).equals(value).primaryKeys();
    return keys as string[];
  }

  async searchByRange(tableName: string, field: string, lower: IndexableType, upper: IndexableType): Promise<string[]> {
    const table = this.db.instance.table(`${tableName}_indexed`);
    const keys = await table.where(field).between(lower, upper, true, true).primaryKeys();
    return keys as string[];
  }

  async searchByAnyOf(tableName: string, field: string, values: IndexableType[]): Promise<string[]> {
    if (values.length === 0) return [];
    const table = this.db.instance.table(`${tableName}_indexed`);
    const keys = await table.where(field).anyOf(values).primaryKeys();
    return keys as string[];
  }

  async searchByTextAsRecords(tableName: string, fields: string[], term: string): Promise<IdbObject[]> {
    const ids = await this.searchByText(tableName, fields, term);
    if (ids.length === 0) return [];
    const dataTable = this.db.instance.table(`${tableName}_indexed`);
    const records = await dataTable.where('id').anyOf(ids).toArray();
    return records.map(r => IdbObjectSchema.parse(r));
  }

  private getIndexedFields(table: Table, fields: string[]): string[] {
    const indexed = new Set([
      table.schema.primKey.name,
      ...table.schema.indexes.map((idx: { name: string }) => idx.name),
    ]);
    return fields.filter(f => indexed.has(f));
  }
}
