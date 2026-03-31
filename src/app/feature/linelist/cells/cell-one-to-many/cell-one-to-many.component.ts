import { Component, effect, inject, input, signal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';

@Component({
  selector: 'td[app-cell-one-to-many]',
  standalone: true,
  template: `
    @if (loading()) {
      <span class="text-body opacity-40">…</span>
    } @else if (displayValues().length > 0) {

        @for (val of displayValues(); track $index) {
          <span class="bg-brand-softer text-fg-brand-strong text-xs font-medium px-1.5 py-0.5 rounded">{{ val }}</span>
        }

    } @else {
      <span class="bg-brand-softer text-fg-brand-strong text-xs font-medium px-1.5 py-0.5 rounded">None</span>
    }
  `,
  host: { class: 'px-4 py-2' },
})
export class CellOneToManyComponent {
  rowId = input.required<string>();
  table = input.required<string>();
  foreignKey = input.required<string>();
  displayProperty = input.required<string>();

  private dataRepository = inject(DataRepository);

  displayValues = signal<string[]>([]);
  loading = signal(true);

  constructor() {
    effect(() => {
      void this.load(this.rowId(), this.table(), this.foreignKey(), this.displayProperty());
    });
  }

  private async load(id: string, tableName: string, foreignKey: string, property: string): Promise<void> {
    this.loading.set(true);
    const records = await this.dataRepository.getByForeignKey(tableName, foreignKey, id);
    this.displayValues.set(
      records.map(r => String(r[property] ?? '—')),
    );
    this.loading.set(false);
  }
}
