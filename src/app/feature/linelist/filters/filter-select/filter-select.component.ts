import { Component, inject, input, WritableSignal } from '@angular/core';
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
 * ### Inputs
 * | Input | Description |
 * |---|---|
 * | `filterKey` | Unique key identifying this filter in the shared results map. |
 * | `table` | Logical name of the table to search. |
 * | `field` | Indexed field to match against. |
 * | `placeholder` | Label shown for the "no filter" option. |
 * | `options` | List of selectable options. |
 * | `filterResultsSignal` | Shared signal holding all active filter results. |
 * | `reloadFn` | Callback invoked after the filter map is updated to refresh the list. |
 */
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

  /**
   * Handles selection changes.
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
}
