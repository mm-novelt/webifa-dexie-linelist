import { Component, inject, input, output, signal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';
import { IdbObject } from '../../../../models/idb-object.model';

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
  table = input.required<string>();
  displayProperty = input.required<string>();
  placeholder = input<string>('Search...');
  select = output<string>();

  private dataRepository = inject(DataRepository);

  inputValue = signal('');
  suggestions = signal<IdbObject[]>([]);
  isOpen = signal(false);

  private debounceTimer?: ReturnType<typeof setTimeout>;

  onInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    this.inputValue.set(term);
    clearTimeout(this.debounceTimer);
    if (!term.trim()) {
      this.suggestions.set([]);
      this.isOpen.set(false);
      this.select.emit('');
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

  selectSuggestion(item: IdbObject): void {
    this.inputValue.set(this.displayValue(item));
    this.suggestions.set([]);
    this.isOpen.set(false);
    this.select.emit(item.id);
  }

  onFocusOut(event: FocusEvent): void {
    const related = event.relatedTarget as Node | null;
    const host = (event.currentTarget as HTMLElement);
    if (!host.contains(related)) {
      this.isOpen.set(false);
    }
  }

  displayValue(item: IdbObject): string {
    return String((item as Record<string, unknown>)[this.displayProperty()] ?? '');
  }
}
