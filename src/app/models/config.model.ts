import { z } from 'zod';

// ---------------------------------------------------------------------------
// Column types
// ---------------------------------------------------------------------------

/** Badge colour variants used by enum columns. */
const BadgeVariantSchema = z.enum(['info', 'secondary', 'default', 'danger', 'success', 'warning']);

/** Column that renders the row identifier (rendered as <th>). */
const TitleColumnSchema = z.object({ type: z.literal('title'), key: z.string(), label: z.string(), sortable: z.boolean().optional() });

/** Column that renders a plain text value. */
const StringColumnSchema = z.object({ type: z.literal('string'), key: z.string(), label: z.string(), sortable: z.boolean().optional() });

/** Column that renders a formatted date string. `format` is an Angular DatePipe format string. */
const DateColumnSchema = z.object({ type: z.literal('date'), key: z.string(), label: z.string(), sortable: z.boolean().optional(), format: z.string() });

/**
 * Column that renders an enum value as a coloured badge.
 * - `variants`: exact-value → badge variant mapping.
 * - `containsVariants`: substring → badge variant mapping (checked after exact match).
 */
const EnumColumnSchema = z.object({
  type: z.literal('enum'),
  key: z.string(),
  label: z.string(),
  sortable: z.boolean().optional(),
  /** When true the stored value is an array; each item renders as its own badge. */
  multiple: z.boolean().optional(),
  /** String placed between badges when `multiple` is true. Defaults to `', '`. */
  separator: z.string().optional(),
  variants: z.record(z.string(), BadgeVariantSchema).optional(),
  containsVariants: z.record(z.string(), BadgeVariantSchema).optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

/** Allowed column types inside an expandable one-to-many sub-table. */
const SubColumnSchema = z.discriminatedUnion('type', [TitleColumnSchema, StringColumnSchema, DateColumnSchema, EnumColumnSchema]);

/** Column that resolves a many-to-one (foreign-key) relationship and shows a single linked record. */
const RelationColumnSchema = z.object({
  type: z.literal('relation'),
  key: z.string(),
  label: z.string(),
  sortable: z.boolean().optional(),
  /** Name of the related table. */
  table: z.string(),
  /** Property on the related record to display. */
  displayProperty: z.string(),
});

/**
 * Column that resolves a one-to-many relationship and shows all related records.
 * When `subColumns` is provided an expand button lets users see a nested table.
 */
const OneToManyColumnSchema = z.object({
  type: z.literal('oneToMany'),
  key: z.string(),
  label: z.string(),
  sortable: z.boolean().optional(),
  /** Name of the related table. */
  table: z.string(),
  /** Field on the related table that holds the foreign key pointing back to this table. */
  foreignKey: z.string(),
  /** Property on related records used as the badge label. */
  displayProperty: z.string(),
  /** Optional column definitions for the expanded sub-table view. */
  subColumns: z.array(SubColumnSchema).optional(),
});

/** Union of all column configuration types. */
const ColumnConfigSchema = z.discriminatedUnion('type', [
  TitleColumnSchema,
  StringColumnSchema,
  DateColumnSchema,
  RelationColumnSchema,
  OneToManyColumnSchema,
  EnumColumnSchema,
]);

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

/**
 * Configuration for a cross-table text search.
 * When the text filter searches `term` it also queries `field` on `table`
 * and resolves matching records back to the main table via `foreignKey`.
 */
const RelatedFieldSearchSchema = z.object({
  /** Related table to search in. */
  table: z.string(),
  /** Field on the related table to run the text search against. */
  field: z.string(),
  /** Field on the *main* table that holds the foreign key to the related table. */
  foreignKey: z.string(),
});

/** A single option in a select filter dropdown. */
const SelectOptionSchema = z.object({ label: z.string(), value: z.string() });

/**
 * A selectable field entry in the text filter's scope dropdown.
 * When selected, the search is restricted to that single field on the main table.
 */
const FieldOptionSchema = z.object({ value: z.string(), label: z.string() });

/** Full-text filter that searches across one or more indexed fields. */
const TextFilterSchema = z.object({
  type: z.literal('text'),
  key: z.string(),
  fields: z.array(z.string()),
  /** Additional cross-table searches to perform alongside the main search. */
  relatedSearches: z.array(RelatedFieldSearchSchema).optional(),
  /**
   * Optional list of field choices shown in the scope dropdown.
   * When provided, a dropdown is rendered that lets the user restrict the search
   * to a single field. Selecting "Tous les champs" (default) searches all
   * `fields` and `relatedSearches` as usual.
   */
  fieldOptions: z.array(FieldOptionSchema).optional(),
  placeholder: z.string().optional(),
});

/** Dropdown filter that matches an exact value against a single field. When `multiple` is true, renders a multi-select and unions results across all selected values. */
const SelectFilterSchema = z.object({
  type: z.literal('select'),
  key: z.string(),
  field: z.string(),
  /** When true, allows selecting multiple values (OR logic within this filter). */
  multiple: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(SelectOptionSchema),
});

/** Autocomplete filter that resolves a foreign-key value from a related table. */
const ForeignKeyFilterSchema = z.object({
  type: z.literal('foreignKey'),
  key: z.string(),
  /** Table to search when typing in the autocomplete input. */
  table: z.string(),
  /** Property on the related table used as the display label. */
  displayProperty: z.string(),
  /** Field on the *main* table that holds the foreign key. */
  foreignKey: z.string(),
  placeholder: z.string().optional(),
});

/**
 * Date filter that supports exact year/date matching and open-ended ranges.
 * Input formats: `"2024"`, `"2024-03-31"`, `"2024 2025"` (year range),
 * or `"2024-01-01 2024-12-31"` (date range).
 * When `numeric` is true values are cast to numbers before querying.
 */
const DateRangeFilterSchema = z.object({
  type: z.literal('dateRange'),
  key: z.string(),
  field: z.string(),
  /** When true, date strings are converted to numbers before the IndexedDB query. */
  numeric: z.boolean().optional(),
  placeholder: z.string().optional(),
});

/** Union of all filter configuration types. */
const FilterConfigSchema = z.discriminatedUnion('type', [
  TextFilterSchema,
  SelectFilterSchema,
  ForeignKeyFilterSchema,
  DateRangeFilterSchema,
]);

// ---------------------------------------------------------------------------
// Internal filters & foreign-field enrichment
// ---------------------------------------------------------------------------

/**
 * A pre-computed compound filter that is applied on the IndexedDB indexed table.
 * Internal filters use multi-field Dexie compound indexes and are shown as a
 * radio-button group in the linelist UI.
 *
 * - `index`: the compound index key, e.g. `"[status+year]"`.
 * - `indexWithFilter`: compound index that also includes the user-selected filter
 *   IDs, e.g. `"[id+status+year]"`.
 * - `value`: the fixed field → value pairs that define this filter option.
 */
const InternalFilterSchema = z.object({
  name: z.string(),
  index: z.string(),
  indexWithFilter: z.string(),
  default: z.boolean().optional(),
  value: z.record(z.string(), z.union([z.string(), z.number()])),
});

/**
 * Describes how a foreign field is joined into the indexed table during the
 * enrichment phase (`DataFetchRepository.enrichIndexed`).
 *
 * The field value is resolved as:
 * `foreignTable[foreignKey = record[foreignKey]][property]`
 */
const ForeignFieldConfigSchema = z.object({
  /** Table whose records supply the enriched value. */
  foreignTable: z.string(),
  /** Field on the *current* record that holds the foreign key. */
  foreignKey: z.string(),
  /** Property on the foreign record whose value is copied into the indexed table. */
  property: z.string(),
});

/**
 * Post-processing entry for an indexed table.
 * Currently only foreign-field enrichment is supported.
 */
const IndexToProcessEntrySchema = z.object({
  foreignFields: z.record(z.string(), ForeignFieldConfigSchema).default({}),
});

// ---------------------------------------------------------------------------
// Top-level config
// ---------------------------------------------------------------------------

/** Column and filter definitions for a single linelist table view. */
const LinelistTableConfigSchema = z.object({
  columns: z.array(ColumnConfigSchema).default([]),
  filters: z.array(FilterConfigSchema).default([]),
  internalFilters: z.array(InternalFilterSchema).default([]),
});

/**
 * Root application configuration fetched from `/api/config`.
 *
 * - `tables`: map of table name → Dexie index definition strings.
 * - `fetch`: map of table name → API URL for initial data loading.
 * - `multiEntry`: per-table field splitting config. Each entry maps a field
 *   name to its separator string; the field value is stored as an array so
 *   Dexie can index each token individually.
 * - `indexToProcess`: post-fetch enrichment config per table.
 * - `linelist`: UI configuration (columns + filters) per table.
 */
export const ConfigSchema = z.object({
  app: z.string(),
  version: z.string(),
  tables: z.record(z.string(), z.array(z.string())),
  fetch: z.record(z.string(), z.string()),
  multiEntry: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  indexToProcess: z.record(z.string(), IndexToProcessEntrySchema).default({}),
  linelist: z.record(z.string(), LinelistTableConfigSchema).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ColumnConfig = z.infer<typeof ColumnConfigSchema>;
export type SubColumnConfig = z.infer<typeof SubColumnSchema>;
export type OneToManyColumn = z.infer<typeof OneToManyColumnSchema>;
export type FilterConfig = z.infer<typeof FilterConfigSchema>;
export type InternalFilter = z.infer<typeof InternalFilterSchema>;
export type ForeignFieldConfig = z.infer<typeof ForeignFieldConfigSchema>;
export type IndexToProcessEntry = z.infer<typeof IndexToProcessEntrySchema>;
