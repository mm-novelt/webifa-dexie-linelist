import { DateFilterValue } from './filter-date-range.models';

const YEAR_RE = /^\d{4}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a raw text input into a {@link DateFilterValue}.
 *
 * Supported formats:
 * - `"YYYY"` → exact year filter.
 * - `"YYYY-MM-DD"` → exact date filter.
 * - `"YYYY YYYY"` → year range filter (space-separated).
 * - `"YYYY-MM-DD YYYY-MM-DD"` → date range filter (space-separated).
 *
 * @returns The parsed filter value, or `null` when the input is invalid.
 */
export function parseDateInput(raw: string): DateFilterValue | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1 && parts[0]) {
    const val = parts[0];
    if (YEAR_RE.test(val) || DATE_RE.test(val)) return { mode: 'exact', value: val };
    return null;
  }
  if (parts.length === 2) {
    const [from, to] = parts;
    if ((YEAR_RE.test(from) && YEAR_RE.test(to)) || (DATE_RE.test(from) && DATE_RE.test(to))) {
      return { mode: 'range', from, to };
    }
    return null;
  }
  return null;
}
