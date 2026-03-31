import { Component, inject, input, signal, WritableSignal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';
import { SelectOption } from './filter-select.models';

export type { SelectOption };

/**
 * Dropdown (select) filter component.
 *
 * Renders a `<select>` element populated from a static list of {@link SelectOption}
 * values. On selection it performs an exact-value match against the configured
 * indexed field and updates the shared filter-results signal.
 *
 * Choosing the empty placeholder option removes this filter key from the map,
 * effectively disabling the filter.
 *
 * When `multiple` is true the element becomes a multi-select. Selecting several
 * values unions their matching IDs (OR logic within this filter). Deselecting all
 * values removes the filter key from the map.
 *
 * ### Inputs
 * | Input | Description |
 * |---|---|
 * | `filterKey` | Unique key identifying this filter in the shared results map. |
 * | `table` | Logical name of the table to search. |
 * | `field` | Indexed field to match against. |
 * | `multiple` | When true, allows selecting several values simultaneously. |
 * | `placeholder` | Label shown for the "no filter" option (single mode only). |
 * | `options` | List of selectable options. |
 * | `filterResultsSignal` | Shared signal holding all active filter results. |
 * | `reloadFn` | Callback invoked after the filter map is updated to refresh the list. |
 */
@Component({
  selector: 'app-filter-select',
  standalone: true,
  template: `
    @if (multiple()) {
      <div class="relative">
        <button
          type="button"
          class="py-2 ps-3 pe-3 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs appearance-none cursor-pointer"
          (click)="dropdownOpen.set(!dropdownOpen())">
          {{ placeholder() }}
        </button>
        @if (dropdownOpen()) {
          <select
            multiple
            [size]="options().length"
            class="absolute z-10 top-full left-0 mt-1 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs appearance-none cursor-pointer"
            (change)="onChangeMultiple($event)"
            (blur)="dropdownOpen.set(false)">
            @for (opt of options(); track opt.value) {
              <option [value]="opt.value" [selected]="selectedValues().includes(opt.value)">{{ opt.label }}</option>
            }
          </select>
        }
      </div>
    } @else {
      <select
        class="py-2 ps-3 pe-8 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body appearance-none cursor-pointer"
        (change)="onChange($event)">
        <option value="">{{ placeholder() }}</option>
        @for (opt of options(); track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>
    }
  `,
})
export class FilterSelectComponent {
  filterKey = input.required<string>();
  table = input.required<string>();
  field = input.required<string>();
  multiple = input<boolean>(false);
  placeholder = input<string>('All');
  options = input.required<SelectOption[]>();
  filterResultsSignal = input.required<WritableSignal<Map<string, string[]>>>();
  reloadFn = input.required<() => Promise<void>>();

  private dataRepository = inject(DataRepository);

  dropdownOpen = signal(false);
  selectedValues = signal<string[]>([]);

  /**
   * Handles selection changes in single-value mode.
   *
   * When an option is selected, performs an exact-value IndexedDB lookup and
   * stores the matching IDs in the shared filter-results signal.
   * When the empty option is selected, removes this filter key from the map.
   */
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

  /**
   * Handles selection changes in multiple-value mode.
   *
   * Collects all selected option values, queries each one independently, and
   * unions the resulting IDs (OR logic). When no values are selected, removes
   * this filter key from the map.
   */
  async onChangeMultiple(event: Event): Promise<void> {
    const selected = Array.from((event.target as HTMLSelectElement).selectedOptions).map(o => o.value);
    const sig = this.filterResultsSignal();
    const map = new Map(sig());

    this.selectedValues.set(selected);

    if (selected.length === 0) {
      map.delete(this.filterKey());
    } else {
      const perValue = await Promise.all(
        selected.map(v => this.dataRepository.searchByExactValue(this.table(), this.field(), v))
      );
      const union = [...new Set(perValue.flat())];
      map.set(this.filterKey(), union);
    }

    sig.set(map);
    await this.reloadFn()();
  }
}
