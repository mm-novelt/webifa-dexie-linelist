import { inject, Injectable } from '@angular/core';
import { DbService } from '../services/db.service';
import { IdbObject, IdbObjectSchema } from '../models/idb-object.model';

@Injectable({ providedIn: 'root' })
export class DataRepository {
  private db = inject(DbService);

  async getFirst10ByCreatedAtDesc(tableName: string): Promise<IdbObject[]> {
    const rows = await this.db.instance
      .table(tableName)
      .orderBy('createdAt')
      .reverse()
      .limit(10)
      .toArray();

    return rows.map(row => IdbObjectSchema.parse(row));
  }
}
