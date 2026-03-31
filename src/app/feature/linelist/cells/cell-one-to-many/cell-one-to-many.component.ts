import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';
import { SubColumnConfig } from '../../linelist.models';

@Component({
  selector: 'td[app-cell-one-to-many]',
  standalone: true,
  template: `
    @if (loading()) {
      <span class="text-body opacity-40">…</span>
    } @else {
      <span class="inline-flex items-center gap-2">
        <span class="inline-flex flex-wrap gap-1">
          @if (displayValues().length > 0) {
            @for (val of displayValues(); track $index) {
              <span class="bg-brand-softer text-fg-brand-strong text-xs font-medium px-1.5 py-0.5 rounded">{{ val }}</span>
            }
          } @else {
            <span class="bg-brand-softer text-fg-brand-strong text-xs font-medium px-1.5 py-0.5 rounded">None</span>
          }
        </span>
        @if (subColumns()) {
          <button
            type="button"
            (click)="toggleExpand.emit()"
            class="p-0.5 rounded hover:bg-neutral-secondary-medium text-body opacity-60 hover:opacity-100 transition-opacity">
            @if (expanded()) {
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
              </svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            }
          </button>
        }
      </span>
    }
  `,
  host: { class: 'px-4 py-2' },
})
export class CellOneToManyComponent {
  rowId = input.required<string>();
  table = input.required<string>();
  foreignKey = input.required<string>();
  displayProperty = input.required<string>();
  subColumns = input<SubColumnConfig[] | undefined>();
  expanded = input<boolean>(false);

  toggleExpand = output<void>();

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
