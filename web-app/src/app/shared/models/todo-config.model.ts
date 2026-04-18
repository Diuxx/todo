import { RecurrenceType, TodoCriticality, TodoStatus } from './base-entity.model';

export interface TodoConfig {
  status?: TodoStatus;
  criticality: TodoCriticality;
  recurrenceType: RecurrenceType;

  /**
  * - 0 9 * * 1-5
   * - daily
   * - every_2_days
   * - weekly:monday,friday
   * - monthly:1
   * - 0 0 * * 1,2,3
   * 
   * 0 (minute) → à la minute 0
   * 0 (heure) → à 00h (minuit)
   * * (jour du mois) → tous les jours du mois
   * * (mois) → tous les mois
   * 1,2,3 (jour de la semaine) → lundi, mardi, mercredi
   * 
   * exemples:
   * 0 0 1 * * -> les premiers du mois à 0h
   */
  recurrenceRule?: string;
  goalCount?: number; // for habits, optional target count to reach before marking as done

  alertEnabled: boolean;
  alertAt?: string; // "08:30"

  lastCompletedAt?: string; // ISO date
  nextDueAt?: string; // ISO date
  dueDate?: string; // YYYY-MM-DD
}
