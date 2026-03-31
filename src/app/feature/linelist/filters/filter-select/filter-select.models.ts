/** A single option displayed in the {@link FilterSelectComponent} dropdown. */
export interface SelectOption {
  /** Human-readable label shown in the `<option>` element. */
  label: string;
  /** Raw value sent to the IndexedDB exact-match query. */
  value: string;
}
