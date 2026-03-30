import { Component, effect, inject } from '@angular/core';
import { DbService } from '../../services/db.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-getting-started',
  standalone: true,
  template: `
    <div class="flex items-center justify-center min-h-screen">
      <div class="rounded-lg border bg-white p-8 shadow-md">
        @if (query.isPending()) {
          <p class="text-lg font-medium">Initialisation...</p>
        } @else if (query.isError()) {
          <p class="text-lg font-medium text-red-500">Erreur lors du chargement de la configuration.</p>
        } @else {
          <p class="text-lg font-medium text-green-600">Base de données initialisée.</p>
        }
      </div>
    </div>
  `,
})
export class GettingStartedComponent {
  private db = inject(DbService);
  private configService = inject(ConfigService);

  query = this.configService.query;

  constructor() {
    effect(async () => {
      const config = this.query.data();
      if (config) {
        await this.db.initialize(config.tables);
      }
    });
  }
}
