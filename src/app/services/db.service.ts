import { Injectable } from '@angular/core';
import Dexie from 'dexie';

/**
 * Manages the lifecycle of the application's Dexie (IndexedDB) database.
 *
 * The service holds a single Dexie instance and exposes it through the
 * {@link instance} getter. All repositories depend on this service to obtain
 * table references.
 *
 * Typical flow:
 * 1. On first run: `initialize()` creates the schema and opens the database.
 * 2. On subsequent visits: `openExisting()` re-opens the already-versioned DB.
 * 3. On reset: `deleteDatabase()` closes and permanently deletes the database.
 */
@Injectable({ providedIn: 'root' })
export class DbService {
  private db: Dexie | null = null;

  /**
   * Creates and opens a new Dexie database with the provided schema.
   *
   * For each table name two physical IndexedDB object stores are created:
   * - `<table>_data` – stores the full raw records, indexed only by primary key `id`.
   * - `<table>_indexed` – stores a lightweight projection used for filtering
   *   and sorting; indexed by the provided field definitions.
   *
   * Calling this method when the database is already open is a no-op.
   *
   * @param tables Map of table name → array of Dexie index definition strings
   *               (e.g. `["id", "+createdAt", "[status+year]"]`).
   */
  async initialize(tables: Record<string, string[]>): Promise<void> {
    if (this.db) return;

    const schema: Record<string, string> = {};
    for (const [table, indexes] of Object.entries(tables)) {
      schema[`${table}_data`] = 'id';
      schema[`${table}_indexed`] = [...new Set(indexes)].join(', ');
    }

    this.db = new Dexie('webifa');
    this.db.version(1).stores(schema);
    await this.db.open();
  }

  /**
   * Opens an existing `webifa` database without declaring a schema.
   *
   * Use this when the database was initialised in a previous session and the
   * schema is already persisted in IndexedDB. Calling this method when the
   * database is already open is a no-op.
   */
  async openExisting(): Promise<void> {
    if (this.db) return;
    this.db = new Dexie('webifa');
    await this.db.open();
  }

  /** Returns `true` when a Dexie instance is currently open. */
  get isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Closes the current database connection and permanently deletes the
   * `webifa` IndexedDB database.
   *
   * After this call {@link isInitialized} returns `false` and a subsequent
   * call to {@link initialize} is required before any data access.
   */
  async deleteDatabase(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    await Dexie.delete('webifa');
  }

  /**
   * Returns the active Dexie database instance.
   *
   * @throws {Error} When the database has not been opened yet.
   */
  get instance(): Dexie {
    if (!this.db) throw new Error('DB not initialized');
    return this.db;
  }
}
