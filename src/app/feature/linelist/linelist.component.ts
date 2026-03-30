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

export type FilterConfig = TextFilterConfig;

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
    { key: 'createdAt', label: 'Created At', sortable: true, type: 'date', format: 'dd/MM/yyyy' },
  ];

  readonly filters: FilterConfig[] = [
    { type: 'text', key: 'search', fields: ['bid', 'patientName', 'finalResult'], placeholder: 'Search...' },
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
