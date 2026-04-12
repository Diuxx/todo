import { RecurrenceType, TodoStatus } from './base-entity.model';

export interface TodoConfig {
  status?: TodoStatus;
  recurrenceType: RecurrenceType;

  /**
   * Exemples :
   * - daily
   * - every_2_days
   * - weekly:monday,friday
   * - monthly:1
   * - custom:0 9 * * 1-5
   */
  recurrenceRule?: string;

  alertEnabled: boolean;
  alertAt?: string; // "08:30"

  lastCompletedAt?: string; // ISO date
  nextDueAt?: string; // ISO date
}
