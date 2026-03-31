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

const BATCH_SIZE = 20_000;

@Injectable({ providedIn: 'root' })
export class SearchEngineService {
  private db = inject(DbService);

  async isIndexed(): Promise<boolean> {
    return (await this.db.instance.table('searchEngine').count()) > 0;
  }

  async clearIndex(): Promise<void> {
    await this.db.instance.table('searchEngine').clear();
  }

  async indexItems(
    tableName: string,
    properties: string[],
    items: Record<string, unknown>[],
  ): Promise<void> {
    if (items.length === 0 || properties.length === 0) return;
    const store = this.db.instance.table<SearchEntry>('searchEngine');
    const batch: SearchEntry[] = [];

    for (const item of items) {
      const objectId = item['id'] as string;
      for (const propertyPath of properties) {
        const localPath = propertyPath.slice(tableName.length + 1);
        const raw = this.resolvePath(item, localPath);
        if (raw === null || raw === undefined) continue;
        for (const token of this.tokenize(raw)) {
          batch.push({ objectId, tableName, property: propertyPath, value: token });
          if (batch.length >= BATCH_SIZE) {
            await store.bulkAdd(batch.splice(0, BATCH_SIZE));
          }
        }
      }
    }

    if (batch.length > 0) {
      await store.bulkAdd(batch);
    }
  }

  private resolvePath(
    item: Record<string, unknown>,
    path: string,
  ): unknown {
    const segments = path.split('.');

    if (segments.length === 1) return item[segments[0]] ?? null;

    let current: unknown = item;
    for (const seg of segments) {
      if (current === null || current === undefined) return null;
      current = (current as Record<string, unknown>)[seg];
    }
    return current ?? null;
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
