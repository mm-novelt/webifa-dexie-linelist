import { Component, inject, input, signal, WritableSignal } from '@angular/core';
import { DataRepository } from '../../../../repositories/data.repository';

export interface DateExactFilter { mode: 'exact'; value: string; }
export interface DateRangeFilter { mode: 'range'; from: string; to: string; }
export type DateFilterValue = DateExactFilter | DateRangeFilter;

const YEAR_RE = /^\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateInput(raw: string): DateFilterValue | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1 && parts[0]) {
    const val = parts[0];
    if (YEAR_RE.test(val) || DATE_RE.test(val)) return { mode: 'exact', value: val };
    return null;
  }
  if (parts.length === 2) {
    const [from, to] = parts;
    if ((YEAR_RE.test(from) && YEAR_RE.test(to)) || (DATE_RE.test(from) && DATE_RE.test(to))) {
      return { mode: 'range', from, to };
    }
    return null;
  }
  return null;
}

@Component({
  selector: 'app-filter-date-range',
  standalone: true,
  template: `
    <label [for]="inputId" class="sr-only">{{ placeholder() }}</label>
    <div class="relative">
      <div class="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
        <svg class="w-4 h-4 text-body" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
             fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 10h16M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01M6 4v2M18 4v2M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"/>
        </svg>
      </div>
      @if (parsedValue()) {
        <div class="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none">
          <svg class="w-3.5 h-3.5 text-green-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      }
      <input [id]="inputId" type="text"
             class="block w-full max-w-60 ps-9 pe-8 py-2 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body"
             [placeholder]="placeholder()"
             (input)="onInput($event)"/>
    </div>
  `,
})
export class FilterDateRangeComponent {
  readonly inputId = `filter-date-${Math.random().toString(36).slice(2)}`;

  filterKey = input.required<string>();
  table = input.required<string>();
  field = input.required<string>();
  numeric = input<boolean>(false);
  placeholder = input<string>('Year or range...');
  filterResultsSignal = input.required<WritableSignal<Map<string, string[]>>>();
  reloadFn = input.required<() => Promise<void>>();

  private dataRepository = inject(DataRepository);

  parsedValue = signal<DateFilterValue | null>(null);

  private debounceTimer?: ReturnType<typeof setTimeout>;

  onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      const sig = this.filterResultsSignal();
      const map = new Map(sig());

      if (!raw.trim()) {
        this.parsedValue.set(null);
        map.delete(this.filterKey());
        sig.set(map);
        await this.reloadFn()();
        return;
      }

      const parsed = parseDateInput(raw);
      this.parsedValue.set(parsed);
      if (!parsed) return;

      const cast = (v: string) => this.numeric() ? Number(v) : v;
      const ids = parsed.mode === 'exact'
        ? await this.dataRepository.searchByExactValue(this.table(), this.field(), cast(parsed.value))
        : await this.dataRepository.searchByRange(this.table(), this.field(), cast(parsed.from), cast(parsed.to));

      map.set(this.filterKey(), ids);
      sig.set(map);
      await this.reloadFn()();
    }, 300);
  }
}
