import { Component, effect, inject, input, signal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';

@Component({
  selector: 'td[app-cell-many-to-one]',
  standalone: true,
  template: `
    @if (loading()) {
      <span class="text-body opacity-40">…</span>
    } @else if (displayValue() !== null) {
      <span class="text-blue-600">
        <span class="bg-brand-softer text-fg-brand-strong text-xs font-medium px-1.5 py-0.5 rounded">
          {{ displayValue() }}
        </span>
      </span>
    } @else {
      <span class="text-body opacity-40 italic">Not found</span>
    }
  `,
  host: { class: 'px-4 py-2' },
})
export class CellManyToOneComponent {
  value = input.required<unknown>();
  table = input.required<string>();
  displayProperty = input.required<string>();

  private dataRepository = inject(DataRepository);

  displayValue = signal<string | null>(null);
  loading = signal(true);

  constructor() {
    effect(() => {
      void this.load(this.value(), this.table(), this.displayProperty());
    });
  }

  private async load(id: unknown, tableName: string, property: string): Promise<void> {
    this.loading.set(true);
    const record = await this.dataRepository.getById(tableName, id);
    if (record) {
      this.displayValue.set(String((record as Record<string, unknown>)[property] ?? '—'));
    } else {
      this.displayValue.set(null);
    }
    this.loading.set(false);
  }
}
