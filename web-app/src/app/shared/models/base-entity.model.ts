
export type ItemType = "note" | "todo" | "citation" | "image";

export type ItemColor =
  | "default"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "pink"
  | "gray";

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "custom";

export type TodoStatus = "pending" | "done";

export type Visibility = "private" | "public";

export interface BaseEntity {
  id: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}