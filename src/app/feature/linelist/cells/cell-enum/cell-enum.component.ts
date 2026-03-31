import { Component, computed, input } from '@angular/core';
import { BadgeVariant } from './cell-enum.models';

export type { BadgeVariant };

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  info: 'bg-brand-softer text-fg-brand-strong',
  secondary: 'bg-neutral-primary-soft text-heading',
  default: 'bg-neutral-secondary-medium text-heading',
  danger: 'bg-danger-soft text-fg-danger-strong',
  success: 'bg-success-soft text-fg-success-strong',
  warning: 'bg-warning-soft text-fg-warning',
};

@Component({
  selector: 'td[app-cell-enum]',
  standalone: true,
  template: `
    @if (multiple()) {
      @for (item of asArray(); track $index; let last = $last) {
        <span [class]="itemBadgeClass(item) + ' text-xs font-medium px-1.5 py-0.5 rounded'">{{ labelFor(item) }}</span>
        @if (!last) {<span class="text-body opacity-40 text-xs mx-0.5">{{ separator() }}</span>}
      }
    } @else {
      <span [class]="singleBadgeClass() + ' text-xs font-medium px-1.5 py-0.5 rounded'">
        {{ singleLabel() }}
      </span>
    }
  `,
  host: { class: 'px-4 py-2' },
})
export class CellEnumComponent {
  value = input.required<string | string[]>();
  variants = input<Record<string, BadgeVariant>>({});
  containsVariants = input<Record<string, BadgeVariant>>({});
  labels = input<Record<string, string>>({});
  multiple = input<boolean>(false);
  separator = input<string>(', ');

  asArray = computed(() => {
    const v = this.value();
    return Array.isArray(v) ? v : [v];
  });

  singleValue = computed(() => {
    const v = this.value();
    return Array.isArray(v) ? v.join(this.separator()) : (v ?? '');
  });

  itemBadgeClass(item: string): string {
    if (item in this.variants()) return VARIANT_CLASSES[this.variants()[item]];
    for (const [sub, variant] of Object.entries(this.containsVariants())) {
      if (item.includes(sub)) return VARIANT_CLASSES[variant];
    }
    return VARIANT_CLASSES['default'];
  }

  labelFor(item: string): string {
    return this.labels()[item] ?? item;
  }

  singleLabel = computed(() => {
    const val = this.singleValue();
    return this.labels()[val] ?? val;
  });

  singleBadgeClass = computed(() => {
    const val = this.singleValue();
    if (val in this.variants()) return VARIANT_CLASSES[this.variants()[val]];
    for (const [sub, variant] of Object.entries(this.containsVariants())) {
      if (val.includes(sub)) return VARIANT_CLASSES[variant];
    }
    return VARIANT_CLASSES['default'];
  });
}
