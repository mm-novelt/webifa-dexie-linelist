import { Component, computed, input } from '@angular/core';

export type BadgeVariant = 'info' | 'secondary' | 'default' | 'danger' | 'success' | 'warning';

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
    <span [class]="badgeClass() + ' text-xs font-medium px-1.5 py-0.5 rounded'">
      {{ displayValue() }}
    </span>
  `,
  host: { class: 'px-4 py-2' },
})
export class CellEnumComponent {
  value = input.required<unknown>();
  variants = input<Record<string, BadgeVariant>>({});
  containsVariants = input<Record<string, BadgeVariant>>({});

  displayValue = computed(() => String(this.value() ?? ''));

  badgeClass = computed(() => {
    const val = this.displayValue();
    if (val in this.variants()) {
      return VARIANT_CLASSES[this.variants()[val]];
    }
    for (const [substring, variant] of Object.entries(this.containsVariants())) {
      if (val.includes(substring)) {
        return VARIANT_CLASSES[variant];
      }
    }
    return VARIANT_CLASSES['default'];
  });
}
