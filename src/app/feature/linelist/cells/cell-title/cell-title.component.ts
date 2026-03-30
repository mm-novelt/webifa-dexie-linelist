import { Component, input } from '@angular/core';

@Component({
  selector: 'th[app-cell-title]',
  standalone: true,
  template: '{{ value() }}',
  host: {
    scope: 'row',
    class: 'p-4 font-medium text-heading whitespace-nowrap',
  },
})
export class CellTitleComponent {
  value = input.required<unknown>();
}
