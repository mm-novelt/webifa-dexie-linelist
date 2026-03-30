import { Component, inject, input, OnInit, signal } from '@angular/core';
import { DataRepository, SortDirection } from '../../repositories/data.repository';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { IdbObject } from '../../models/idb-object.model';
import { TableColumnHeaderComponent, SortChangeEvent } from './table-column-header/table-column-header.component';
import { PaginationComponent } from './pagination/pagination.component';

export interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
  isDate?: boolean;
  isRowHeader?: boolean;
}

@Component({
  selector: 'app-linelist',
  standalone: true,
  templateUrl: './linelist.component.html',
  imports: [
    FormsModule,
    DatePipe,
    HeaderComponent,
    TableColumnHeaderComponent,
    PaginationComponent,
  ],
})
export class LinelistComponent implements OnInit {
  table = input.required<string>();

  private dataRepository = inject(DataRepository);

  readonly columns: ColumnConfig[] = [
    { key: 'bid', label: 'Case BID', sortable: true, isRowHeader: true },
    { key: 'patientName', label: 'Patient name', sortable: true },
    { key: 'areaId', label: 'Area', sortable: true },
    { key: 'adeq', label: 'Adeq', sortable: false },
    { key: 'finalResult', label: 'Final result', sortable: false },
    { key: 'specimens', label: 'Specimens', sortable: false },
    { key: 'createdAt', label: 'Created At', sortable: true, isDate: true },
  ];

  readonly pageSize = 10;

  orderColumn = signal<string>('createdAt');
  orderDirection = signal<SortDirection>('DESC');
  currentPage = signal<number>(1);

  rows = signal<IdbObject[]>([]);
  total = signal<number>(0);
  totalPages = signal<number>(0);

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

  cellValue(row: IdbObject, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  private async loadData(): Promise<void> {
    const result = await this.dataRepository.getPaginated(
      this.table(),
      this.currentPage(),
      this.pageSize,
      this.orderColumn(),
      this.orderDirection(),
    );
    this.rows.set(result.data);
    this.total.set(result.total);
    this.totalPages.set(result.totalPages);
  }
}
