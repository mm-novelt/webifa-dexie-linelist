import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DataRepository } from '../../../../repositories/data.repository';
import { IdbObject } from '../../../../models/idb-object.model';
import { SubColumnConfig } from '../../linelist.models';
import { BadgeVariant } from '../cell-enum/cell-enum.models';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  info: 'bg-brand-softer text-fg-brand-strong',
  secondary: 'bg-neutral-primary-soft text-heading',
  default: 'bg-neutral-secondary-medium text-heading',
  danger: 'bg-danger-soft text-fg-danger-strong',
  success: 'bg-success-soft text-fg-success-strong',
  warning: 'bg-warning-soft text-fg-warning',
};

@Component({
  selector: 'app-row-expanded-one-to-many',
  standalone: true,
  imports: [DatePipe],
  template: `
    @if (loading()) {
      <div class="px-4 py-2 text-body opacity-40 text-sm">…</div>
    } @else if (records().length === 0) {
      <div class="px-4 py-2 text-sm text-body opacity-60">No records</div>
    } @else {
      <div class="p-4 bg-neutral-50">
        <table class="w-full text-sm text-left border border-default">
          <thead class="text-xs text-body bg-neutral-secondary-medium">
          <tr>
            @for (col of subColumns(); track col.key) {
              <th class="px-3 py-1.5 font-medium">{{ col.label }}</th>
            }
          </tr>
          </thead>
          <tbody class="bg-white">
            @for (record of records(); track $index) {
              <tr class="border-t border-default">
                @for (col of subColumns(); track col.key) {
                  @switch (col.type) {
                    @case ('title') {
                      <td class="p-3 font-medium">{{ cellValue(record, col.key) }}</td>
                    }
                    @case ('string') {
                      <td class="p-3">{{ cellValue(record, col.key) }}</td>
                    }
                    @case ('date') {
                      <td class="p-3">{{ cellValue(record, col.key) | date: $any(col).format }}</td>
                    }
                    @case ('enum') {
                      <td class="p-3">
                      <span [class]="enumBadgeClass($any(col), cellValue(record, col.key))">
                        {{ cellValue(record, col.key) }}
                      </span>
                      </td>
                    }
                  }
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class RowExpandedOneToManyComponent {
  rowId = input.required<string>();
  table = input.required<string>();
  foreignKey = input.required<string>();
  subColumns = input.required<SubColumnConfig[]>();

  private dataRepository = inject(DataRepository);

  records = signal<IdbObject[]>([]);
  loading = signal(true);

  constructor() {
    effect(() => {
      void this.load(this.rowId(), this.table(), this.foreignKey());
    });
  }

  private async load(id: string, table: string, fk: string): Promise<void> {
    this.loading.set(true);
    const records = await this.dataRepository.getByForeignKey(table, fk, id);
    this.records.set(records);
    this.loading.set(false);
  }

  cellValue(row: IdbObject, key: string): string {
    return String(row[key] ?? '');
  }

  enumBadgeClass(col: SubColumnConfig, value: string): string {
    const base = 'text-xs font-medium px-1.5 py-0.5 rounded';
    if (col.type !== 'enum') return `${VARIANT_CLASSES['default']} ${base}`;
    if (col.variants && value in col.variants) {
      return `${VARIANT_CLASSES[col.variants[value]]} ${base}`;
    }
    if (col.containsVariants) {
      for (const [substring, variant] of Object.entries(col.containsVariants)) {
        if (value.includes(substring)) return `${VARIANT_CLASSES[variant]} ${base}`;
      }
    }
    return `${VARIANT_CLASSES['default']} ${base}`;
  }
}
