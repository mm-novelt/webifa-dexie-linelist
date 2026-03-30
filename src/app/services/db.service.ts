import { Injectable } from '@angular/core';
import Dexie from 'dexie';

@Injectable({ providedIn: 'root' })
export class DbService {
  private db: Dexie | null = null;

  async initialize(tables: Record<string, string[]>): Promise<void> {
    if (this.db) return;

    const schema: Record<string, string> = {};
    for (const [table, indexes] of Object.entries(tables)) {
      schema[table] = [...new Set(indexes)].join(', ');
    }
    schema['searchEngine'] = '++id, objectId, tableName, property, value, [tableName+value], [property+value]';

    console.log('Schema', schema);

    this.db = new Dexie('webifa');
    this.db.version(1).stores(schema);
    await this.db.open();
  }

  async openExisting(): Promise<void> {
    if (this.db) return;
    this.db = new Dexie('webifa');
    await this.db.open();
  }

  get isInitialized(): boolean {
    return this.db !== null;
  }

  async deleteDatabase(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    await Dexie.delete('webifa');
  }

  get instance(): Dexie {
    if (!this.db) throw new Error('DB not initialized');
    return this.db;
  }
}
