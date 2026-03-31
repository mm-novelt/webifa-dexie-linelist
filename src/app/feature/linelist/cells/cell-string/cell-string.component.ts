import { Component, input } from '@angular/core';

@Component({
  selector: 'td[app-cell-string]',
  standalone: true,
  template: '{{ value() }}',
  host: { class: 'px-4 py-2' },
})
export class CellStringComponent {
  value = input.required<string>();
}
