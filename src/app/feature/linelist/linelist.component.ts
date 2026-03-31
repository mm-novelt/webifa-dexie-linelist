import { Component, computed, effect, inject, input, signal, WritableSignal } from '@angular/core';
import { DataRepository, SortDirection } from '../../repositories/data.repository';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../header/header.component';
import { IdbObject } from '../../models/idb-object.model';
import { TableColumnHeaderComponent, SortChangeEvent } from './table-column-header/table-column-header.component';
import { PaginationComponent } from './pagination/pagination.component';
import { CellTitleComponent } from './cells/cell-title/cell-title.component';
import { CellStringComponent } from './cells/cell-string/cell-string.component';
import { CellDateComponent } from './cells/cell-date/cell-date.component';
import { CellManyToOneComponent } from './cells/cell-many-to-one/cell-many-to-one.component';
import { CellOneToManyComponent } from './cells/cell-one-to-many/cell-one-to-many.component';
import { CellEnumComponent } from './cells/cell-enum/cell-enum.component';
import { RowExpandedOneToManyComponent } from './cells/row-expanded-one-to-many/row-expanded-one-to-many.component';
import { FilterTextComponent } from './filters/filter-text/filter-text.component';
import { FilterSelectComponent } from './filters/filter-select/filter-select.component';
import { FilterForeignKeyComponent } from './filters/filter-foreign-key/filter-foreign-key.component';
import { FilterDateRangeComponent } from './filters/filter-date-range/filter-date-range.component';
import { ColumnConfig, FilterConfig, InternalFilter, OneToManyColumn } from './linelist.models';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-linelist',
  standalone: true,
  templateUrl: './linelist.component.html',
  host: { class: 'bg-gray-50 block h-screen' },
  imports: [
    FormsModule,
    HeaderComponent,
    TableColumnHeaderComponent,
    PaginationComponent,
    CellTitleComponent,
    CellStringComponent,
    CellDateComponent,
    CellManyToOneComponent,
    CellOneToManyComponent,
    CellEnumComponent,
    RowExpandedOneToManyComponent,
    FilterTextComponent,
    FilterSelectComponent,
    FilterForeignKeyComponent,
    FilterDateRangeComponent,
  ],
})
export class LinelistComponent {

  table = input.required<string>();

  private dataRepository = inject(DataRepository);
  private configService = inject(ConfigService);

  readonly columns = computed<ColumnConfig[]>(() => this.configService.query.data()?.linelist[this.table()]?.columns ?? []);
  readonly filters = computed<FilterConfig[]>(() => this.configService.query.data()?.linelist[this.table()]?.filters ?? []);
  readonly internalFilters = computed(() => this.configService.query.data()?.linelist[this.table()]?.internalFilters ?? []);

  readonly pageSize = 10;

  orderColumn = signal<string>('createdAt');
  orderDirection = signal<SortDirection>('DESC');
  currentPage = signal<number>(1);

  rows = signal<IdbObject[]>([]);
  total = signal<number>(0);
  totalPages = signal<number>(0);
  expandedRows = signal<Map<string, string>>(new Map());
  isSearchLoading = signal<boolean>(false);

  readonly filterResults: WritableSignal<Map<string, string[]>> = signal(new Map());
  showFilters = signal(true);

  readonly filteredIds = computed<string[] | null>(() => {
    const map = this.filterResults();
    if (map.size === 0) return null;
    const sets = [...map.values()];
    return sets.reduce((acc, ids) => {
      const lookup = new Set(ids);
      return acc.filter(id => lookup.has(id));
    });
  });

  selectedInternalFilter = signal<InternalFilter | null>(null);
  private internalFilterInitialized = false;

  async resetFilters(): Promise<void> {
    this.filterResults.set(new Map());
    this.showFilters.set(false);
    setTimeout(() => this.showFilters.set(true));
    this.currentPage.set(1);
    this.isSearchLoading.set(true);
    try {
      await this.loadData();
    } finally {
      this.isSearchLoading.set(false);
    }
  }

  readonly reloadFn: () => Promise<void> = async () => {
    this.currentPage.set(1);
    this.isSearchLoading.set(true);
    try {
      await this.loadData();
    } finally {
      this.isSearchLoading.set(false);
    }
  };

  constructor() {
    effect(async () => {
      const config = this.configService.query.data();
      this.table(); // track table input
      if (!config) return;
      if (!this.internalFilterInitialized) {
        const def = this.internalFilters().find(f => f.default) ?? null;
        this.selectedInternalFilter.set(def);
        this.internalFilterInitialized = true;
      }
      await this.loadData();
    });
  }

  async onSortChange(event: SortChangeEvent): Promise<void> {
    this.orderColumn.set(event.column);
    this.orderDirection.set(event.direction);
    this.currentPage.set(1);
    this.isSearchLoading.set(true);
    try {
      await this.loadData();
    } finally {
      this.isSearchLoading.set(false);
    }
  }

  async onPageChange(page: number): Promise<void> {
    this.currentPage.set(page);
    await this.loadData();
  }

  onInternalFilterChange(name: string): void {
    const f = name ? this.internalFilters().find(f => f.name === name) ?? null : null;
    this.selectedInternalFilter.set(f);
    this.currentPage.set(1);
    this.isSearchLoading.set(true);
    this.loadData().finally(() => this.isSearchLoading.set(false));
  }

  cellValue(row: IdbObject, key: string): string {
    return row[key] as string;
  }

  isExpanded(rowId: string, colKey: string): boolean {
    return this.expandedRows().get(rowId) === colKey;
  }

  expandedRowColumn(rowId: string): string | undefined {
    return this.expandedRows().get(rowId);
  }

  getOneToManyColumn(colKey: string): OneToManyColumn | undefined {
    return this.columns().find(c => c.key === colKey && c.type === 'oneToMany') as OneToManyColumn | undefined;
  }

  onToggleExpand(rowId: string, colKey: string): void {
    const next = new Map(this.expandedRows());
    if (next.get(rowId) === colKey) {
      next.delete(rowId);
    } else {
      next.set(rowId, colKey);
    }
    this.expandedRows.set(next);
  }

  private async loadData(): Promise<void> {
    this.expandedRows.set(new Map());
    const result = await this.dataRepository.getPaginated(
      this.table(),
      this.currentPage(),
      this.pageSize,
      this.orderColumn(),
      this.orderDirection(),
      this.filteredIds() ?? undefined,
      this.selectedInternalFilter(),
    );
    this.rows.set(result.data);
    this.total.set(result.total);
    this.totalPages.set(result.totalPages);
  }
}
