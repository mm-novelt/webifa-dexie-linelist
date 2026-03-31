import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';

let tooltipIdCounter = 0;

@Component({
  selector: 'td[app-cell-date]',
  standalone: true,
  imports: [DatePipe],
  template: `
    <span [attr.data-tooltip-target]="tooltipId" class="text-xs cursor-default">
      {{ value() | date: format() }}
    </span>
    <div [id]="tooltipId" role="tooltip"
      class="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-xs opacity-0 tooltip dark:bg-gray-700">
      {{ value() | date: 'dd/MM/yyyy HH:mm:ss' }}
      <div class="tooltip-arrow" data-popper-arrow></div>
    </div>
  `,
  host: { class: 'px-4 py-2 relative' },
})
export class CellDateComponent {
  value = input.required<string>();
  format = input.required<string>();
  tooltipId = `cell-date-tooltip-${tooltipIdCounter++}`;
}
