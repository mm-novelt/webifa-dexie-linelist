import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
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
import { BadgeVariant, CellEnumComponent } from './cells/cell-enum/cell-enum.component';
import { FilterTextComponent } from './filters/filter-text/filter-text.component';
import { FilterSelectComponent, SelectOption } from './filters/filter-select/filter-select.component';
import { FilterForeignKeyComponent } from './filters/filter-foreign-key/filter-foreign-key.component';
import { DateFilterValue, FilterDateRangeComponent } from './filters/filter-date-range/filter-date-range.component';

interface BaseColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface TitleColumn extends BaseColumn { type: 'title'; }
export interface StringColumn extends BaseColumn { type: 'string'; }
export interface DateColumn extends BaseColumn { type: 'date'; format: string; }
export interface RelationColumn extends BaseColumn { type: 'relation'; table: string; displayProperty: string; }
export interface OneToManyColumn extends BaseColumn { type: 'oneToMany'; table: string; foreignKey: string; displayProperty: string; }
export interface EnumColumn extends BaseColumn { type: 'enum'; variants?: Record<string, BadgeVariant>; containsVariants?: Record<string, BadgeVariant>; }

export type ColumnConfig = TitleColumn | StringColumn | DateColumn | RelationColumn | OneToManyColumn | EnumColumn;

export interface TextFilterConfig {
  type: 'text';
  key: string;
  fields: string[];
  placeholder?: string;
}

export interface SelectFilterConfig {
  type: 'select';
  key: string;
  field: string;
  placeholder?: string;
  options: SelectOption[];
}

export interface ForeignKeyFilterConfig {
  type: 'foreignKey';
  key: string;
  table: string;
  displayProperty: string;
  foreignKey: string;
  placeholder?: string;
}

export interface DateRangeFilterConfig {
  type: 'dateRange';
  key: string;
  field: string;
  numeric?: boolean;
  placeholder?: string;
}

export type FilterConfig = TextFilterConfig | SelectFilterConfig | ForeignKeyFilterConfig | DateRangeFilterConfig;

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
    FilterTextComponent,
    FilterSelectComponent,
    FilterForeignKeyComponent,
    FilterDateRangeComponent,
  ],
})
export class LinelistComponent implements OnInit {

  table = input.required<string>();

  private dataRepository = inject(DataRepository);

  readonly columns: ColumnConfig[] = [
    { key: 'bid', label: 'Case BID', sortable: true, type: 'title' },
    { key: 'patientName', label: 'Patient name', sortable: true, type: 'string' },
    { key: 'areaId', label: 'Area', sortable: true, type: 'relation', table: 'areas', displayProperty: 'name' },
    { key: 'adeq', label: 'Adeq', sortable: false, type: 'enum', variants: { ADEQ: 'success', INADEQ: 'danger' } },
    { key: 'finalResult', label: 'Final result', sortable: false, type: 'enum', containsVariants: { WPV1: 'danger', WPV2: 'danger', WPV3: 'danger' } },
    { key: 'specimens', label: 'Specimens', sortable: false, type: 'oneToMany', table: 'specimens', foreignKey: 'caseId', displayProperty: 'bid' },
    { key: 'year', label: 'Year', sortable: true, type: 'string' },
    { key: 'createdAt', label: 'Created At', sortable: true, type: 'date', format: 'dd/MM/yyyy' },
  ];

  readonly filters: FilterConfig[] = [
    { type: 'text', key: 'search', fields: ['bid', 'patientName', 'finalResult'], placeholder: 'Search...' },
    { type: 'select', key: 'adeq', field: 'adeq', placeholder: 'Adeq — All', options: [{ label: 'ADEQ', value: 'ADEQ' }, { label: 'INADEQ', value: 'INADEQ' }] },
    { type: 'foreignKey', key: 'areaFilter', table: 'areas', displayProperty: 'name', foreignKey: 'areaId', placeholder: 'Area...' },
    { type: 'dateRange', key: 'yearFilter', field: 'year', numeric: true, placeholder: 'Year or range...' },
  ];

  readonly pageSize = 10;

  orderColumn = signal<string>('createdAt');
  orderDirection = signal<SortDirection>('DESC');
  currentPage = signal<number>(1);

  rows = signal<IdbObject[]>([]);
  total = signal<number>(0);
  totalPages = signal<number>(0);

  /** Per-filter matched IDs: filterKey → string[] */
  private filterResults = signal<Map<string, string[]>>(new Map());

  /** Intersection of all active filters. Null = no active filter (show all). */
  readonly filteredIds = computed<string[] | null>(() => {
    const map = this.filterResults();
    if (map.size === 0) return null;
    const sets = [...map.values()];
    return sets.reduce((acc, ids) => {
      const lookup = new Set(ids);
      return acc.filter(id => lookup.has(id));
    });
  });

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async onSortChange(event: SortChangeEvent): Promise<void> {
    this.orderColumn.set(event.column);
    this.orderDirection.set(event.direction);
    this.currentPage.set(1);
    await this.loadData();
  }

  async onPageChange(page: number): Promise<void> {
    this.currentPage.set(page);
    await this.loadData();
  }

  async onTextSearch(filter: TextFilterConfig, term: string): Promise<void> {
    const map = new Map(this.filterResults());
    if (!term) {
      map.delete(filter.key);
    } else {
      const ids = await this.dataRepository.searchByText(this.table(), filter.fields, term);
      map.set(filter.key, ids);
    }
    this.filterResults.set(map);
    this.currentPage.set(1);
    await this.loadData();
  }

  async onForeignKeyFilter(filter: ForeignKeyFilterConfig, id: string): Promise<void> {
    const map = new Map(this.filterResults());
    if (!id) {
      map.delete(filter.key);
    } else {
      const ids = await this.dataRepository.searchByExactValue(this.table(), filter.foreignKey, id);
      map.set(filter.key, ids);
    }
    this.filterResults.set(map);
    this.currentPage.set(1);
    await this.loadData();
  }

  async onSelectFilter(filter: SelectFilterConfig, value: string): Promise<void> {
    const map = new Map(this.filterResults());
    if (!value) {
      map.delete(filter.key);
    } else {
      const ids = await this.dataRepository.searchByExactValue(this.table(), filter.field, value);
      map.set(filter.key, ids);
    }
    this.filterResults.set(map);
    this.currentPage.set(1);
    await this.loadData();
  }

  async onDateRangeFilter(filter: DateRangeFilterConfig, value: DateFilterValue | null): Promise<void> {
    const map = new Map(this.filterResults());
    const cast = (v: string) => filter.numeric ? Number(v) : v;
    if (!value) {
      map.delete(filter.key);
    } else if (value.mode === 'exact') {
      const ids = await this.dataRepository.searchByExactValue(this.table(), filter.field, cast(value.value));
      map.set(filter.key, ids);
    } else {
      const ids = await this.dataRepository.searchByRange(this.table(), filter.field, cast(value.from), cast(value.to));
      map.set(filter.key, ids);
    }
    this.filterResults.set(map);
    this.currentPage.set(1);
    await this.loadData();
  }

  cellValue(row: IdbObject, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  private async loadData(): Promise<void> {
    const filteredIds = this.filteredIds();
    const result = await this.dataRepository.getPaginated(
      this.table(),
      this.currentPage(),
      this.pageSize,
      this.orderColumn(),
      this.orderDirection(),
      filteredIds ?? undefined,
    );
    this.rows.set(result.data);
    this.total.set(result.total);
    this.totalPages.set(result.totalPages);
  }
}
