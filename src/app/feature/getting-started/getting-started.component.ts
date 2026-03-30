import { Component, effect, inject, signal } from '@angular/core';
import { DbService } from '../../services/db.service';
import { ConfigService } from '../../services/config.service';
import { DataFetchRepository } from '../../repositories/data-fetch.repository';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  template: `
    <div class="flex items-center justify-center min-h-screen">
      <div class="rounded-lg border bg-white p-8 shadow-md w-96">
        @if (query.isPending()) {
          <p class="text-lg font-medium mb-4">Initialisation...</p>
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div class="bg-blue-600 h-2.5 rounded-full animate-pulse" style="width: 20%"></div>
          </div>
        } @else if (query.isError()) {
          <p class="text-lg font-medium text-red-500">Erreur lors du chargement de la configuration.</p>
        } @else if (isFetching()) {
          <p class="text-lg font-medium mb-2">Chargement des données...</p>
          <p class="text-sm text-gray-500 mb-4">{{ fetchLabel() }}</p>
          <div class="w-full bg-gray-200 rounded-full h-2.5">
            <div
              class="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              [style.width.%]="fetchProgress()"
            ></div>
          </div>
        } @else if (isDone()) {
          <p class="text-lg font-medium text-green-600">Base de données initialisée.</p>
        }
      </div>
    </div>
  `,
})
export class GettingStartedComponent {
  private db = inject(DbService);
  private configService = inject(ConfigService);
  private dataFetchRepository = inject(DataFetchRepository);

  query = this.configService.query;

  isFetching = signal(false);
  isDone = signal(false);
  fetchLabel = signal('');
  fetchProgress = signal(0);

  constructor() {
    effect(async () => {
      const config = this.query.data();
      if (!config) return;

      await this.db.initialize(config.tables);

      const entries = Object.entries(config.fetch);
      if (entries.length === 0) {
        this.isDone.set(true);
        return;
      }

      this.isFetching.set(true);

      for (let i = 0; i < entries.length; i++) {
        const [tableName, url] = entries[i];
        this.fetchLabel.set(tableName);
        this.fetchProgress.set(Math.round((i / entries.length) * 100));
        await this.dataFetchRepository.fetchAndStore(tableName, url);
      }

      this.fetchProgress.set(100);
      this.isFetching.set(false);
      this.isDone.set(true);
    });
  }
}
