export interface DateExactFilter { mode: 'exact'; value: string; }
export interface DateRangeFilter { mode: 'range'; from: string; to: string; }
export type DateFilterValue = DateExactFilter | DateRangeFilter;
