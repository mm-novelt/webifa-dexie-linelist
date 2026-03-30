import { Component, input, output } from '@angular/core';

export interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-filter-select',
  standalone: true,
  template: `
    <select
      class="py-2 ps-3 pe-8 bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base focus:ring-brand focus:border-brand shadow-xs placeholder:text-body appearance-none cursor-pointer"
      (change)="onChange($event)">
      <option value="">{{ placeholder() }}</option>
      @for (opt of options(); track opt.value) {
        <option [value]="opt.value">{{ opt.label }}</option>
      }
    </select>
  `,
})
export class FilterSelectComponent {
  placeholder = input<string>('All');
  options = input.required<SelectOption[]>();
  select = output<string>();

  onChange(event: Event): void {
    this.select.emit((event.target as HTMLSelectElement).value);
  }
}
