import { Component, computed, inject, input, OnInit, signal, WritableSignal } from '@angular/core';
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
import { ColumnConfig, FilterConfig, InternalFilterConfig, OneToManyColumn } from './linelist.models';

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
export class LinelistComponent implements OnInit {

  table = input.required<string>();

  private dataRepository = inject(DataRepository);

  readonly columns: ColumnConfig[] = [
    { key: 'bid', label: 'Case BID', sortable: true, type: 'title' },
    { key: 'patientName', label: 'Patient name', sortable: true, type: 'string' },
    { key: 'areaId', label: 'Area', type: 'relation', table: 'areas', displayProperty: 'name' },
    { key: 'adeq', label: 'Adeq', sortable: false, type: 'enum', variants: { ADEQ: 'success', INADEQ: 'danger' } },
    { key: 'finalResult', label: 'Final result', sortable: false, type: 'enum', containsVariants: { WPV1: 'danger', WPV2: 'danger', WPV3: 'danger' } },
    {
      key: 'specimens', label: 'Specimens', sortable: false, type: 'oneToMany', table: 'specimens', foreignKey: 'caseId', displayProperty: 'bid',
      subColumns: [
        { key: 'bid', label: 'Specimen BID', type: 'title' },
        { key: 'finalResult', label: 'Final result', type: 'enum', containsVariants: { WPV1: 'danger', WPV2: 'danger', WPV3: 'danger' } },
        { key: 'createdAt', label: 'Created At', type: 'date', format: 'dd/MM/yyyy' },
      ],
    },
    { key: 'year', label: 'Year', sortable: true, type: 'string' },
    { key: 'createdAt', label: 'Created At', sortable: true, type: 'date', format: 'dd/MM/yyyy' },
  ];

  readonly internalFilters: InternalFilterConfig[] = [
    { type: 'foreignKey', sourceTable: 'areas', sourceField: 'published', sourceValue: 1, targetForeignKey: 'areaId' },
  ];

  readonly filters: FilterConfig[] = [
    {
      type: 'text',
      key: 'search',
      fields: ['bid', 'patientName', 'finalResult'],
      relatedSearches: [
        { table: 'areas', field: 'name', foreignKey: 'areaId' }
      ],
      placeholder: 'Search...',
    },
    { type: 'select', key: 'adeq', field: 'adeq', placeholder: 'All Adeq result', options: [{ label: 'ADEQ', value: 'ADEQ' }, { label: 'INADEQ', value: 'INADEQ' }] },
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
  expandedRows = signal<Map<string, string>>(new Map());

  readonly internalFilteredIds = signal<string[] | null>(null);

  readonly filterResults: WritableSignal<Map<string, string[]>> = signal(new Map());

  readonly filteredIds = computed<string[] | null>(() => {
    const map = this.filterResults();
    if (map.size === 0) return null;
    const sets = [...map.values()];
    return sets.reduce((acc, ids) => {
      const lookup = new Set(ids);
      return acc.filter(id => lookup.has(id));
    });
  });

  readonly reloadFn: () => Promise<void> = () => {
    this.currentPage.set(1);
    return this.loadData();
  };

  async ngOnInit(): Promise<void> {
    this.internalFilteredIds.set(await this.resolveInternalFilters());
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
    return this.columns.find(c => c.key === colKey && c.type === 'oneToMany') as OneToManyColumn | undefined;
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

  private async resolveInternalFilters(): Promise<string[] | null> {
    if (this.internalFilters.length === 0) return null;
    const results = await Promise.all(
      this.internalFilters.map(async (f) => {
        const sourceIds = await this.dataRepository.searchByExactValue(f.sourceTable, f.sourceField, f.sourceValue);
        if (sourceIds.length === 0) return [];
        return this.dataRepository.searchByAnyOf(this.table(), f.targetForeignKey, sourceIds);
      }),
    );
    return results.reduce((acc, ids) => {
      const lookup = new Set(ids);
      return acc.filter(id => lookup.has(id));
    });
  }

  private async loadData(): Promise<void> {
    this.expandedRows.set(new Map());
    const filteredIds = this.filteredIds();
    const internalIds = this.internalFilteredIds();

    let finalIds: string[] | undefined;
    if (filteredIds !== null && internalIds !== null) {
      const lookup = new Set(internalIds);
      finalIds = filteredIds.filter(id => lookup.has(id));
    } else if (filteredIds !== null) {
      finalIds = filteredIds;
    } else if (internalIds !== null) {
      finalIds = internalIds;
    }

    const result = await this.dataRepository.getPaginated(
      this.table(),
      this.currentPage(),
      this.pageSize,
      this.orderColumn(),
      this.orderDirection(),
      finalIds,
    );
    this.rows.set(result.data);
    this.total.set(result.total);
    this.totalPages.set(result.totalPages);
  }
}
