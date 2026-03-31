import { z } from 'zod';

const BadgeVariantSchema = z.enum(['info', 'secondary', 'default', 'danger', 'success', 'warning']);

const TitleColumnSchema = z.object({ type: z.literal('title'), key: z.string(), label: z.string(), sortable: z.boolean().optional() });
const StringColumnSchema = z.object({ type: z.literal('string'), key: z.string(), label: z.string(), sortable: z.boolean().optional() });
const DateColumnSchema = z.object({ type: z.literal('date'), key: z.string(), label: z.string(), sortable: z.boolean().optional(), format: z.string() });
const EnumColumnSchema = z.object({ type: z.literal('enum'), key: z.string(), label: z.string(), sortable: z.boolean().optional(), variants: z.record(z.string(), BadgeVariantSchema).optional(), containsVariants: z.record(z.string(), BadgeVariantSchema).optional() });
const SubColumnSchema = z.discriminatedUnion('type', [TitleColumnSchema, StringColumnSchema, DateColumnSchema, EnumColumnSchema]);
const RelationColumnSchema = z.object({ type: z.literal('relation'), key: z.string(), label: z.string(), sortable: z.boolean().optional(), table: z.string(), displayProperty: z.string() });
const OneToManyColumnSchema = z.object({ type: z.literal('oneToMany'), key: z.string(), label: z.string(), sortable: z.boolean().optional(), table: z.string(), foreignKey: z.string(), displayProperty: z.string(), subColumns: z.array(SubColumnSchema).optional() });
const ColumnConfigSchema = z.discriminatedUnion('type', [TitleColumnSchema, StringColumnSchema, DateColumnSchema, RelationColumnSchema, OneToManyColumnSchema, EnumColumnSchema]);

const RelatedFieldSearchSchema = z.object({ table: z.string(), field: z.string(), foreignKey: z.string() });
const SelectOptionSchema = z.object({ label: z.string(), value: z.string() });
const TextFilterSchema = z.object({ type: z.literal('text'), key: z.string(), fields: z.array(z.string()), relatedSearches: z.array(RelatedFieldSearchSchema).optional(), placeholder: z.string().optional() });
const SelectFilterSchema = z.object({ type: z.literal('select'), key: z.string(), field: z.string(), placeholder: z.string().optional(), options: z.array(SelectOptionSchema) });
const ForeignKeyFilterSchema = z.object({ type: z.literal('foreignKey'), key: z.string(), table: z.string(), displayProperty: z.string(), foreignKey: z.string(), placeholder: z.string().optional() });
const DateRangeFilterSchema = z.object({ type: z.literal('dateRange'), key: z.string(), field: z.string(), numeric: z.boolean().optional(), placeholder: z.string().optional() });
const FilterConfigSchema = z.discriminatedUnion('type', [TextFilterSchema, SelectFilterSchema, ForeignKeyFilterSchema, DateRangeFilterSchema]);

export const ConfigSchema = z.object({
  app: z.string(),
  version: z.string(),
  tables: z.record(z.string(), z.array(z.string())),
  fetch: z.record(z.string(), z.string()),
  searchEngine: z.record(z.string(), z.array(z.string())).default({}),
  multiEntry: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  columns: z.record(z.string(), z.array(ColumnConfigSchema)).default({}),
  filters: z.record(z.string(), z.array(FilterConfigSchema)).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ColumnConfig = z.infer<typeof ColumnConfigSchema>;
export type SubColumnConfig = z.infer<typeof SubColumnSchema>;
export type OneToManyColumn = z.infer<typeof OneToManyColumnSchema>;
export type FilterConfig = z.infer<typeof FilterConfigSchema>;
