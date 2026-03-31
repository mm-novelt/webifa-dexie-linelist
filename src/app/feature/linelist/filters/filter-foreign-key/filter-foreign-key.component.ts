import { Component, inject, input, signal, WritableSignal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';
import { IdbObject } from '../../../../models/idb-object.model';

/**
 * Autocomplete filter component for foreign-key relationships.
 *
 * The user types a search term; after a 300 ms debounce the component searches
 * the `displayProperty` field on the related `table` and shows up to 10
 * suggestions in a dropdown. Selecting a suggestion resolves the matching IDs
 * from the main table via the `foreignKey` field and writes them to the shared
 * filter-results signal.
 *
 * Clearing the input removes this filter key from the map.
 * The suggestion dropdown closes when focus leaves the component (`focusout`).
 *
 * ### Inputs
 * | Input | Description |
 * |---|---|
 * | `filterKey` | Unique key identifying this filter in the shared results map. |
 * | `mainTable` | Logical name of the main table to filter. |
 * | `foreignKey` | Field on the main table holding the foreign key. |
 * | `table` | Related table to search for autocomplete suggestions. |
 * | `displayProperty` | Field on the related table used as the suggestion label. |
 * | `placeholder` | Input placeholder text. |
 * | `filterResultsSignal` | Shared signal holding all active filter results. |
 * | `reloadFn` | Callback invoked after the filter map is updated to refresh the list. |
 */
@Component({
  selector: 'app-filter-foreign-key',
  standalone: true,
  template: `
    <div class="relative" (focusout)="onFocusOut($event)">
      <label class="sr-only">{{ placeholder() }}</label>
      <div class="relative">
        <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
          <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
               fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-width="2"
                  d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>
          </svg>
        </div>
        <input type="text"
               class="block w-full max-w-96 ps-9 pe-3 py-2 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body"
               [placeholder]="placeholder()"
               [value]="inputValue()"
               (input)="onInput($event)"
               autocomplete="off"/>
      </div>
      @if (isOpen() && suggestions().length > 0) {
        <ul class="absolute z-20 mt-1 w-full max-w-96 bg-neutral-primary-medium border border-default-medium rounded-base shadow-lg max-h-60 overflow-y-auto">
          @for (item of suggestions(); track item.id) {
            <li>
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm text-heading hover:bg-neutral-tertiary-medium focus:bg-neutral-tertiary-medium focus:outline-none"
                (mousedown)="selectSuggestion(item)">
                {{ displayValue(item) }}
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class FilterForeignKeyComponent {
  filterKey = input.required<string>();
  mainTable = input.required<string>();
  foreignKey = input.required<string>();
  table = input.required<string>();
  displayProperty = input.required<string>();
  placeholder = input<string>('Search...');
  filterResultsSignal = input.required<WritableSignal<Map<string, string[]>>>();
  reloadFn = input.required<() => Promise<void>>();

  private dataRepository = inject(DataRepository);

  /** Current value shown in the text input. */
  inputValue = signal('');
  /** List of autocomplete suggestions (capped at 10). */
  suggestions = signal<IdbObject[]>([]);
  /** Whether the suggestion dropdown is visible. */
  isOpen = signal(false);

  private debounceTimer?: ReturnType<typeof setTimeout>;

  /**
   * Handles raw input events.
   *
   * Clears suggestions immediately on each keystroke. If the input is empty,
   * removes this filter from the map and triggers a reload synchronously.
   * Otherwise, waits 300 ms before querying the related table for suggestions.
   */
  onInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.inputValue.set(term);
    this.suggestions.set([]);
    this.isOpen.set(false);
    clearTimeout(this.debounceTimer);

    if (!term.trim()) {
      const sig = this.filterResultsSignal();
      const map = new Map(sig());
      map.delete(this.filterKey());
      sig.set(map);
      void this.reloadFn()();
      return;
    }

    this.debounceTimer = setTimeout(async () => {
      const results = await this.dataRepository.searchByTextAsRecords(
        this.table(), [this.displayProperty()], term.trim(),
      );
      this.suggestions.set(results.slice(0, 10));
      this.isOpen.set(results.length > 0);
    }, 300);
  }

  /**
   * Confirms a suggestion selection.
   *
   * Fills the input with the item's display value, hides the dropdown, then
   * queries the main table for all records whose `foreignKey` matches the
   * selected item's ID and writes them to the shared filter-results signal.
   */
  async selectSuggestion(item: IdbObject): Promise<void> {
    this.inputValue.set(this.displayValue(item));
    this.suggestions.set([]);
    this.isOpen.set(false);

    const ids = await this.dataRepository.searchByExactValue(this.mainTable(), this.foreignKey(), item.id);
    const sig = this.filterResultsSignal();
    const map = new Map(sig());
    map.set(this.filterKey(), ids);
    sig.set(map);
    await this.reloadFn()();
  }

  /**
   * Closes the suggestion dropdown when focus leaves the host element.
   *
   * Uses `relatedTarget` to distinguish between focus moving to a suggestion
   * button (kept open via `mousedown` handler) and focus leaving the component.
   */
  onFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    const host = (event.currentTarget as HTMLElement);
    if (!host.contains(related)) {
      this.isOpen.set(false);
    }
  }

  /** Returns the string value of the `displayProperty` field for a given record. */
  displayValue(item: IdbObject): string {
    return String(item[this.displayProperty()] ?? '');
  }
}
