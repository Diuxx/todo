import { BaseEntity, TodoStatus } from "./base-entity.model";

export interface TodoHistoryEntry extends BaseEntity {
  todoItemId: string;
  status: TodoStatus;
  completedAt?: string; // ISO date
  skippedAt?: string; // ISO date
  note?: string;
}