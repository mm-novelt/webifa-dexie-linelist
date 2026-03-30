import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  currentPage = input.required<number>();
  totalPages = input.required<number>();
  total = input.required<number>();
  pageSize = input.required<number>();

  pageChange = output<number>();

  rangeStart = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  rangeEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.total()));

  visiblePages = computed<(number | '...')[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [1];

    if (current > 3) pages.push('...');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push('...');
    pages.push(total);

    return pages;
  });

  goTo(page: number | '...'): void {
    if (typeof page !== 'number') return;
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChange.emit(page);
    }
  }

  prev(): void {
    if (this.currentPage() > 1) this.pageChange.emit(this.currentPage() - 1);
  }

  next(): void {
    if (this.currentPage() < this.totalPages()) this.pageChange.emit(this.currentPage() + 1);
  }
}
