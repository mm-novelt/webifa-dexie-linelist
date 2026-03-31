import { SortDirection } from '../../../repositories/data.repository';

export interface SortChangeEvent {
  column: string;
  direction: SortDirection;
}
