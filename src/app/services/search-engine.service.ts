import { inject, Injectable } from '@angular/core';
import { DbService } from './db.service';

export interface SearchEntry {
  id?: number;
  objectId: string;
  tableName: string;
  property: string;
  value: string;
}

export interface SearchCriterion {
  property: string;
  term: string;
}

export interface IndexingProgress {
  current: number;
  total: number;
  percent: number;
}

const BATCH_SIZE = 5_000;

@Injectable({ providedIn: 'root' })
export class SearchEngineService {
  private db = inject(DbService);

  async isIndexed(): Promise<boolean> {
    return (await this.db.instance.table('searchEngine').count()) > 0;
  }

  async clearIndex(): Promise<void> {
    await this.db.instance.table('searchEngine').clear();
  }

  async buildIndexForTable(
    tableName: string,
    properties: string[],
    onProgress?: (progress: IndexingProgress) => void,
  ): Promise<void> {
    const store = this.db.instance.table<SearchEntry>('searchEngine');
    const relatedData = await this.preloadRelatedTablesForTable(tableName, properties);

    const items = await this.db.instance.table(`${tableName}_indexed`).toArray() as Record<string, unknown>[];
    const total = items.length;
    let current = 0;
    let lastPercent = -1;

    const reportProgress = () => {
      if (!onProgress) return;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress({ current, total, percent });
      }
    };

    reportProgress();

    const batch: SearchEntry[] = [];
    for (const item of items) {
      const objectId = item['id'] as string;
      for (const propertyPath of properties) {
        const localPath = propertyPath.slice(tableName.length + 1);
        const raw = this.resolvePath(item, localPath, relatedData);
        if (raw === null || raw === undefined) continue;
        for (const token of this.tokenize(raw)) {
          batch.push({ objectId, tableName, property: propertyPath, value: token });
          if (batch.length >= BATCH_SIZE) {
            await store.bulkAdd(batch.splice(0, BATCH_SIZE));
          }
        }
      }
      current++;
      reportProgress();
    }

    if (batch.length > 0) {
      await store.bulkAdd(batch);
    }
  }

  async buildIndex(
    searchConfig: Record<string, string[]>,
    onProgress?: (progress: IndexingProgress) => void,
  ): Promise<void> {
    const store = this.db.instance.table<SearchEntry>('searchEngine');
    await store.clear();

    const [relatedData, itemCounts] = await Promise.all([
      this.preloadRelatedTables(searchConfig),
      this.countItems(searchConfig),
    ]);

    const total = itemCounts.reduce((sum, c) => sum + c, 0);
    let current = 0;
    let lastPercent = -1;

    const reportProgress = () => {
      if (!onProgress) return;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress({ current, total, percent });
      }
    };

    reportProgress();

    const batch: SearchEntry[] = [];

    for (const [tableName, properties] of Object.entries(searchConfig)) {
      const items = await this.db.instance.table(`${tableName}_indexed`).toArray() as Record<string, unknown>[];

      for (const item of items) {
        const objectId = item['id'] as string;

        for (const propertyPath of properties) {
          const localPath = propertyPath.slice(tableName.length + 1);
          const raw = this.resolvePath(item, localPath, relatedData);
          if (raw === null || raw === undefined) continue;

          for (const token of this.tokenize(raw)) {
            batch.push({ objectId, tableName, property: propertyPath, value: token });
            if (batch.length >= BATCH_SIZE) {
              await store.bulkAdd(batch.splice(0, BATCH_SIZE));
            }
          }
        }

        current++;
        reportProgress();
      }
    }

    if (batch.length > 0) {
      await store.bulkAdd(batch);
    }
  }

  /**
   * Full-text search within a table. Returns matching objectIds.
   * If properties are specified, only those properties are searched.
   */
  async search(tableName: string, term: string, properties?: string[]): Promise<string[]> {
    const normalized = term.toLowerCase().trim();
    if (!normalized) return [];

    const store = this.db.instance.table<SearchEntry>('searchEngine');

    const entries = await store
      .where('[tableName+value]')
      .between([tableName, normalized], [tableName, normalized + '\uffff'])
      .toArray();

    const filtered = properties
      ? entries.filter(e => properties.includes(e.property))
      : entries;

    return [...new Set(filtered.map(e => e.objectId))];
  }

  /**
   * Multi-criteria search: each criterion filters by property + term prefix.
   * Returns the intersection of matching objectIds (AND logic).
   */
  async searchMultiCriteria(criteria: SearchCriterion[]): Promise<string[]> {
    if (criteria.length === 0) return [];

    const store = this.db.instance.table<SearchEntry>('searchEngine');

    const resultSets = await Promise.all(
      criteria.map(async ({ property, term }) => {
        const normalized = term.toLowerCase().trim();
        if (!normalized) return null;
        const entries = await store
          .where('[property+value]')
          .between([property, normalized], [property, normalized + '\uffff'])
          .toArray();
        return new Set(entries.map(e => e.objectId));
      }),
    );

    const validSets = resultSets.filter((s): s is Set<string> => s !== null);
    if (validSets.length === 0) return [];

    return [...validSets.reduce((acc, set) => new Set([...acc].filter(id => set.has(id))))];
  }

  // ---------------------------------------------------------------------------

  private async countItems(searchConfig: Record<string, string[]>): Promise<number[]> {
    return Promise.all(
      Object.keys(searchConfig).map(tableName => this.db.instance.table(`${tableName}_indexed`).count()),
    );
  }

  private async preloadRelatedTables(
    searchConfig: Record<string, string[]>,
  ): Promise<Map<string, Map<string, Record<string, unknown>>>> {
    const needed = new Set<string>();

    for (const [tableName, properties] of Object.entries(searchConfig)) {
      for (const prop of properties) {
        const segments = prop.slice(tableName.length + 1).split('.');
        if (segments.length > 1) {
          needed.add(segments[0] + 's'); // simple pluralisation: 'area' → 'areas'
        }
      }
    }

    return this.loadRelatedTables(needed);
  }

  private async preloadRelatedTablesForTable(
    tableName: string,
    properties: string[],
  ): Promise<Map<string, Map<string, Record<string, unknown>>>> {
    const needed = new Set<string>();

    for (const prop of properties) {
      const segments = prop.slice(tableName.length + 1).split('.');
      if (segments.length > 1) {
        needed.add(segments[0] + 's');
      }
    }

    return this.loadRelatedTables(needed);
  }

  private async loadRelatedTables(
    needed: Set<string>,
  ): Promise<Map<string, Map<string, Record<string, unknown>>>> {
    const result = new Map<string, Map<string, Record<string, unknown>>>();
    await Promise.all(
      [...needed].map(async relTable => {
        const rows = await this.db.instance.table(`${relTable}_data`).toArray() as Record<string, unknown>[];
        const map = new Map<string, Record<string, unknown>>();
        for (const row of rows) map.set(row['id'] as string, row);
        result.set(relTable, map);
      }),
    );

    return result;
  }

  private resolvePath(
    item: Record<string, unknown>,
    path: string,
    relatedData: Map<string, Map<string, Record<string, unknown>>>,
  ): unknown {
    const segments = path.split('.');

    // Direct single-field access
    if (segments.length === 1) return item[segments[0]] ?? null;

    // Try direct nested traversal first (in case data is already denormalized)
    let current: unknown = item;
    for (const seg of segments) {
      if (current === null || current === undefined) break;
      current = (current as Record<string, unknown>)[seg];
    }
    if (current !== null && current !== undefined) return current;

    // Join resolution: 'area.name' → look for 'areaId', join 'areas' table
    const [relation, ...rest] = segments;
    const foreignKey = `${relation}Id`;
    const relatedTable = `${relation}s`;

    const foreignId = item[foreignKey] as string | undefined;
    if (!foreignId) return null;

    const relMap = relatedData.get(relatedTable);
    if (!relMap) return null;

    const related = relMap.get(foreignId);
    if (!related) return null;

    return rest.length === 1 ? (related[rest[0]] ?? null) : this.resolvePath(related, rest.join('.'), relatedData);
  }

  private tokenize(value: unknown): string[] {
    const raw = String(value).toLowerCase().trim();
    if (!raw) return [];

    const tokens = new Set<string>();
    tokens.add(raw);

    // Split by whitespace, comma, slash, hyphen, underscore
    for (const part of raw.split(/[\s,/\-_]+/).filter(p => p.length > 0)) {
      tokens.add(part);
    }

    return [...tokens];
  }
}
