import { Component, inject, input, WritableSignal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';

export interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-filter-select',
  standalone: true,
  template: `
    <select
      class="py-2 ps-3 pe-8 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body appearance-none cursor-pointer"
      (change)="onChange($event)">
      <option value="">{{ placeholder() }}</option>
      @for (opt of options(); track opt.value) {
        <option [value]="opt.value">{{ opt.label }}</option>
      }
    </select>
  `,
})
export class FilterSelectComponent {
  filterKey = input.required<string>();
  table = input.required<string>();
  field = input.required<string>();
  placeholder = input<string>('All');
  options = input.required<SelectOption[]>();
  filterResultsSignal = input.required<WritableSignal<Map<string, string[]>>>();
  reloadFn = input.required<() => Promise<void>>();

  private dataRepository = inject(DataRepository);

  async onChange(event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    const sig = this.filterResultsSignal();
    const map = new Map(sig());

    if (!value) {
      map.delete(this.filterKey());
    } else {
      const ids = await this.dataRepository.searchByExactValue(this.table(), this.field(), value);
      map.set(this.filterKey(), ids);
    }

    sig.set(map);
    await this.reloadFn()();
  }
}
