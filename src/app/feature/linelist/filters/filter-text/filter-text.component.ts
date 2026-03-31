import { Component, inject, input, WritableSignal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';

export interface RelatedFieldSearch {
  table: string;
  field: string;
  foreignKey: string;
}

@Component({
  selector: 'app-filter-text',
  standalone: true,
  template: `
    <label [for]="inputId" class="sr-only">{{ placeholder() }}</label>
    <div class="relative">
      <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
        <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
             fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-width="2"
                d="m21 21-3.5-3.5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"/>
        </svg>
      </div>
      <input [id]="inputId" type="text"
             class="block w-full max-w-96 ps-9 pe-3 py-2 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body"
             [placeholder]="placeholder()"
             (input)="onInput($event)">
    </div>
  `,
})
export class FilterTextComponent {
  readonly inputId = `filter-text-${Math.random().toString(36).slice(2)}`;

  filterKey = input.required<string>();
  table = input.required<string>();
  fields = input<string[]>([]);
  relatedSearches = input<RelatedFieldSearch[]>([]);
  placeholder = input<string>('Search');
  filterResultsSignal = input.required<WritableSignal<Map<string, string[]>>>();
  reloadFn = input.required<() => Promise<void>>();

  private dataRepository = inject(DataRepository);
  private debounceTimer?: ReturnType<typeof setTimeout>;

  onInput(event: Event): void {
    const term = (event.target as HTMLInputElement).value.trim();
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.performSearch(term), 300);
  }

  private async performSearch(term: string): Promise<void> {
    const sig = this.filterResultsSignal();
    const map = new Map(sig());

    if (!term) {
      map.delete(this.filterKey());
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
