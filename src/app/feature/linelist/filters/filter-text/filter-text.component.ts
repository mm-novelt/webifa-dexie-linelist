import { Component, inject, input, signal, WritableSignal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';
import { FieldOption, RelatedFieldSearch } from './filter-text.models';

export type { FieldOption, RelatedFieldSearch };

/**
 * Full-text search filter component.
 *
 * Performs a prefix search across one or more indexed fields on the main table.
 * Optionally resolves results from related tables (cross-table search) and
 * unions them with the direct matches.
 *
 * When `fieldOptions` is provided, a dropdown is rendered before the input
 * allowing the user to restrict the search to a single field. Selecting "All"
 * (the default) searches across all configured `fields` and `relatedSearches`.
 * Selecting a specific field skips `relatedSearches` and searches only that
 * field on the main table.
 *
 * Input is debounced by 300 ms before triggering the search. Clearing the
 * input removes this filter key from the shared filter-results map.
 *
 * ### Inputs
 * | Input | Description |
 * |---|---|
 * | `filterKey` | Unique key identifying this filter in the shared results map. |
 * | `table` | Logical name of the main table to search. |
 * | `fields` | Indexed fields on the main table to search across. |
 * | `fieldOptions` | Optional list of field choices shown in the scope dropdown. |
 * | `relatedSearches` | Optional cross-table search configurations. |
 * | `placeholder` | Input placeholder text. |
 * | `filterResultsSignal` | Shared signal holding all active filter results. |
 * | `reloadFn` | Callback invoked after the filter map is updated to refresh the list. |
 */
@Component({
  selector: 'app-filter-text',
  standalone: true,
  template: `
    <label [for]="inputId" class="sr-only">{{ placeholder() }}</label>
    <div class="flex max-w-96">
      @if (fieldOptions().length > 0) {
        <select
          class="shrink-0 py-2 ps-3 pe-8 bg-neutral-secondary-medium border border-default-medium border-e-0 text-heading text-sm rounded-s-base focus:ring-brand focus:border-brand shadow-xs appearance-none cursor-pointer"
          (change)="onFieldChange($event)">
          <option value="">Tous les champs</option>
          @for (opt of fieldOptions(); track opt.value) {
            <option [value]="opt.value">{{ opt.label }}</option>
          }
        </select>
      }
      <div class="relative flex-1">
        <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
          <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
               fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-width="2"
                  d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>
          </svg>
        </div>
        <input [id]="inputId" type="text"
               [class]="fieldOptions().length > 0
                 ? 'block w-full ps-9 pe-3 py-2 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-e-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body'
                 : 'block w-full ps-9 pe-3 py-2 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body'"
               [placeholder]="placeholder()"
               (input)="onInput($event)">
      </div>
    </div>
  `,
})
export class FilterTextComponent {
  /** Stable unique ID used to associate the `<label>` with the `<input>`. */
  readonly inputId = `filter-text-${Math.random().toString(36).slice(2)}`;

  filterKey = input.required<string>();
  table = input.required<string>();
  fields = input<string[]>([]);
  fieldOptions = input<FieldOption[]>([]);
  relatedSearches = input<RelatedFieldSearch[]>([]);
  placeholder = input<string>('Search');
  filterResultsSignal = input.required<WritableSignal<Map<string, string[]>>>();
  reloadFn = input.required<() => Promise<void>>();

  /** The currently selected field scope; empty string means "all fields". */
  selectedField = signal('');

  private dataRepository = inject(DataRepository);
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private currentTerm = '';

  /** Updates the selected field scope and re-runs the last search term. */
  onFieldChange(event: Event): void {
    this.selectedField.set((event.target as HTMLSelectElement).value);
    void this.performSearch(this.currentTerm);
  }

  /** Debounces user input by 300 ms before triggering {@link performSearch}. */
  onInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim();
    this.currentTerm = term;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.performSearch(term), 300);
  }

  /**
   * Executes the search and updates the shared filter-results signal.
   *
   * When a specific field is selected via the dropdown, only that field on the
   * main table is searched and `relatedSearches` are skipped.
   *
   * When no specific field is selected (default "all"):
   * 1. Search the main table across all configured `fields`.
   * 2. For each `relatedSearch`, search the related table, then resolve the
   *    matching IDs back to the main table via the foreign key.
   * 3. Union all matched IDs (deduplicated) and write them into the signal.
   * 4. Call `reloadFn` to trigger a list refresh.
   *
   * When `term` is empty the filter key is removed from the map (no restriction).
   */
  private async performSearch(term: string): Promise<void> {
    const sig = this.filterResultsSignal();
    const map = new Map(sig());

    if (!term) {
      map.delete(this.filterKey());
      sig.set(map);
      await this.reloadFn()();
      return;
    }

    const field = this.selectedField();

    if (field) {
      const ids = await this.dataRepository.searchByText(this.table(), [field], term);
      map.set(this.filterKey(), ids);
      sig.set(map);
      await this.reloadFn()();
      return;
    }

    const relatedSearches = this.relatedSearches();
    const directIds = await this.dataRepository.searchByText(this.table(), this.fields(), term);

    let allIds: string[] = [...directIds];

    if (relatedSearches.length > 0) {
      const relatedIdSets = await Promise.all(
        relatedSearches.map(rs => this.dataRepository.searchByText(rs.table, [rs.field], term)),
      );
      const fkIdSets = await Promise.all(
        relatedSearches.map((rs, i) =>
          relatedIdSets[i].length > 0
            ? this.dataRepository.searchByAnyOf(this.table(), rs.foreignKey, relatedIdSets[i])
            : Promise.resolve([] as string[]),
        ),
      );
      for (const ids of fkIdSets) allIds = [...allIds, ...ids];
    }

    map.set(this.filterKey(), [...new Set(allIds)]);
    sig.set(map);
    await this.reloadFn()();
  }
}
