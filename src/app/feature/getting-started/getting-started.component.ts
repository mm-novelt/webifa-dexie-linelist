import { Component, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { ConfigService } from '../../services/config.service';
import { DataFetchRepository, TableFetchProgress } from '../../repositories/data-fetch.repository';
import { SearchEngineService } from '../../services/search-engine.service';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  imports: [FormsModule],
  host: { class: 'flex justify-center items-center min-h-screen bg-gradient-to-br from-white via-blue-50 to-sky-200' },
  templateUrl: './getting-started.component.html',
})
export class GettingStartedComponent {
  private db = inject(DbService);
  private configService = inject(ConfigService);
  private dataFetchRepository = inject(DataFetchRepository);
  private searchEngine = inject(SearchEngineService);
  private router = inject(Router);

  query = this.configService.query;

  isLoggedIn = signal(false);
  username = 'admin';
  password = 'password123';

  isFetching = signal(false);
  isDone = signal(false);

  private tableProgressSignals = signal<WritableSignal<TableFetchProgress>[]>([]);
  tableProgressList = computed(() => this.tableProgressSignals().map((s) => s()));

  constructor() {
    effect(async () => {
      if (!this.isLoggedIn()) return;

      const config = this.query.data();
      if (!config) return;

      if (!this.db.isInitialized) {
        await this.db.initialize(config.tables);
      }

      const entries = Object.entries(config.fetch);
      if (entries.length === 0) {
        this.isDone.set(true);
        return;
      }

      const progressSignals = entries.map(([tableName]) =>
        signal<TableFetchProgress>({ tableName, recordsLoaded: 0, total: 0, percent: 0, done: false }),
      );

      this.tableProgressSignals.set(progressSignals);
      this.isFetching.set(true);

      await Promise.all(
        entries.map(async ([tableName, url], i) => {
          const count = await this.db.instance.table(`${tableName}_data`).count();
          if (count > 0) {
            progressSignals[i].set({ tableName, recordsLoaded: count, total: count, percent: 100, done: true });
          } else {
            await this.dataFetchRepository.fetchAndStore(tableName, url, config.tables[tableName] ?? ['id'], progressSignals[i], undefined, config.multiEntry[tableName]);
          }
        }),
      );

      for (const [i, [tableName]] of entries.entries()) {
        const indexedBy = config.indexedBy[tableName];
        if (indexedBy?.length) {
          await this.dataFetchRepository.enrichIndexed(tableName, indexedBy, progressSignals[i]);
        }
      }

      this.isFetching.set(false);
      this.isDone.set(true);
    });
  }

  login() {
    this.isLoggedIn.set(true);
  }

  startApplication() {
    this.router.navigate(['/linelist', 'cases']);
  }
}
