/**
 * Configuration for a cross-table text search performed alongside the main
 * table search in {@link FilterTextComponent}.
 *
 * When the user types a search term the filter will:
 * 1. Search `field` on `table` for records whose value starts with the term.
 * 2. Collect the matching record IDs from `table`.
 * 3. Look up the main-table records whose `foreignKey` value is in that set.
 * 4. Union the resulting IDs with the direct matches from the main table.
 */
export interface RelatedFieldSearch {
  /** Related table to search in. */
  table: string;
  /** Indexed field on the related table to run the prefix search against. */
  field: string;
  /** Field on the *main* table that holds the foreign key pointing to `table`. */
  foreignKey: string;
}

/**
 * A selectable field option shown in the field-scope dropdown of
 * {@link FilterTextComponent}.
 */
export interface FieldOption {
  /** The indexed field name to search when this option is selected. */
  value: string;
  /** Human-readable label displayed in the dropdown. */
  label: string;
}
