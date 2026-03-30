import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'td[app-cell-date]',
  standalone: true,
  imports: [DatePipe],
  template: '{{ $any(value()) | date: format() }}',
  host: { class: 'px-4 py-2' },
})
export class CellDateComponent {
  value = input.required<unknown>();
  format = input.required<string>();
}
