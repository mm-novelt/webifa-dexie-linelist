import { Component, computed, effect, inject, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { DbService } from '../../services/db.service';
import { ConfigService } from '../../services/config.service';
import { DataFetchRepository, TableFetchProgress } from '../../repositories/data-fetch.repository';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  host: { class: 'flex justify-center items-center h-screen' },
  template: `
    <div class="bg-neutral-primary-soft block max-w-sm p-6 border border-default rounded-base shadow-xs">
      <h5 class="mb-3 text-2xl font-semibold tracking-tight text-heading leading-8">IDB Sync</h5>
      <p class="text-body mb-6">Chargement des données, veuillez patienter</p>
        @if (query.isPending()) {
          <p class="text-lg font-medium mb-4">Initialisation...</p>
        } @else if (query.isError()) {
          <p class="text-lg font-medium text-red-500">Erreur lors du chargement de la configuration.</p>
        } @else if (isFetching() || isDone()) {
          <p class="text-lg font-medium mb-4">{{ isDone() ? 'Chargement terminé.' : 'Chargement des données...' }}</p>
          @for (progress of tableProgressList(); track progress.tableName) {
            <div class="mb-3">
              <div class="flex justify-between text-sm mb-1">
                <span class="font-medium">{{ progress.tableName }}</span>
                <span class="text-gray-500">{{ progress.recordsLoaded }}/{{ progress.total }} ({{ progress.percent }}%)</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  [class]="progress.done ? 'bg-green-500' : 'bg-blue-600'"
                  class="h-2.5 rounded-full transition-all duration-300"
                  [style.width.%]="progress.percent"
                ></div>
              </div>
            </div>
          }
          @if (isDone()) {
            <button
              (click)="startApplication()"
              class="mt-4 w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-base hover:bg-blue-700 transition-colors">
              Start application
            </button>
          }
        }
    </div>
  `,
})
export class GettingStartedComponent {
  private db = inject(DbService);
  private configService = inject(ConfigService);
  private dataFetchRepository = inject(DataFetchRepository);
  private router = inject(Router);

  query = this.configService.query;

  isFetching = signal(false);
  isDone = signal(false);

  private tableProgressSignals = signal<WritableSignal<TableFetchProgress>[]>([]);
  tableProgressList = computed(() => this.tableProgressSignals().map((s) => s()));

  constructor() {
    effect(async () => {
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
          const count = await this.db.instance.table(tableName).count();
          if (count > 0) {
            progressSignals[i].set({ tableName, recordsLoaded: count, total: count, percent: 100, done: true });
          } else {
            await this.dataFetchRepository.fetchAndStore(tableName, url, progressSignals[i]);
          }
        }),
      );

      this.isFetching.set(false);
      this.isDone.set(true);
    });
  }

  startApplication() {
    this.router.navigate(['/linelist', 'cases']);
  }
}
