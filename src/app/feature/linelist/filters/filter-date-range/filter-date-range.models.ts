/** Filter that matches records whose date field equals a specific value. */
export interface DateExactFilter {
  mode: 'exact';
  /** The exact year (`"YYYY"`) or date (`"YYYY-MM-DD"`) to match. */
  value: string;
}

/** Filter that matches records whose date field falls within an inclusive range. */
export interface DateRangeFilter {
  mode: 'range';
  /** Inclusive lower bound — year (`"YYYY"`) or date (`"YYYY-MM-DD"`). */
  from: string;
  /** Inclusive upper bound — year (`"YYYY"`) or date (`"YYYY-MM-DD"`). */
  to: string;
}

/** Discriminated union representing the result of parsing a date filter input. */
export type DateFilterValue = DateExactFilter | DateRangeFilter;
