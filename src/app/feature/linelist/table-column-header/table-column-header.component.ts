import { Component, input, output } from '@angular/core';
import { SortDirection } from '../../../repositories/data.repository';

export interface SortChangeEvent {
  column: string;
  direction: SortDirection;
}

@Component({
  selector: 'th[app-table-column-header]',
  standalone: true,
  templateUrl: './table-column-header.component.html',
  host: {
    class: 'px-3 py-3 font-medium',
    '[class.cursor-pointer]': 'sortable()',
    '[class.select-none]': 'sortable()',
    '(click)': 'onClick()',
  },
})
export class TableColumnHeaderComponent {
  label = input.required<string>();
  columnKey = input.required<string>();
  sortable = input<boolean>(true);
  isActive = input<boolean>(false);
  direction = input<SortDirection>('DESC');

  sortChange = output<SortChangeEvent>();

  onClick(): void {
    if (!this.sortable()) return;

    if (this.isActive()) {
      this.sortChange.emit({
        column: this.columnKey(),
        direction: this.direction() === 'DESC' ? 'ASC' : 'DESC',
      });
    } else {
      this.sortChange.emit({ column: this.columnKey(), direction: 'DESC' });
    }
  }
}
