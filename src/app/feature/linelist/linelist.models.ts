import { BadgeVariant } from './cells/cell-enum/cell-enum.models';
import { SelectOption } from './filters/filter-select/filter-select.models';
import { RelatedFieldSearch } from './filters/filter-text/filter-text.models';

interface BaseColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface TitleColumn extends BaseColumn { type: 'title'; }
export interface StringColumn extends BaseColumn { type: 'string'; }
export interface DateColumn extends BaseColumn { type: 'date'; format: string; }
export interface RelationColumn extends BaseColumn { type: 'relation'; table: string; displayProperty: string; }
export interface OneToManyColumn extends BaseColumn { type: 'oneToMany'; table: string; foreignKey: string; displayProperty: string; }
export interface EnumColumn extends BaseColumn { type: 'enum'; variants?: Record<string, BadgeVariant>; containsVariants?: Record<string, BadgeVariant>; }

export type ColumnConfig = TitleColumn | StringColumn | DateColumn | RelationColumn | OneToManyColumn | EnumColumn;

export interface TextFilterConfig {
  type: 'text';
  key: string;
  fields: string[];
  relatedSearches?: RelatedFieldSearch[];
  placeholder?: string;
}

export interface SelectFilterConfig {
  type: 'select';
  key: string;
  field: string;
  placeholder?: string;
  options: SelectOption[];
}

export interface ForeignKeyFilterConfig {
  type: 'foreignKey';
  key: string;
  table: string;
  displayProperty: string;
  foreignKey: string;
  placeholder?: string;
}

export interface DateRangeFilterConfig {
  type: 'dateRange';
  key: string;
  field: string;
  numeric?: boolean;
  placeholder?: string;
}

export type FilterConfig = TextFilterConfig | SelectFilterConfig | ForeignKeyFilterConfig | DateRangeFilterConfig;
