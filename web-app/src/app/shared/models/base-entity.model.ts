export type ItemType = 'note' | 'todo' | 'citation' | 'image';
export type ItemDefaultColor = '#FEF9C2' | '#FCCEE8' | '#FEF9C2' | '#F5F5F4';

export type ItemColor =
  | 'default'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'pink'
  | 'gray';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type TodoCriticality = 'h' | 'm' | 'l';

export type TodoStatus = 'pending' | 'done';

export type Visibility = 'private' | 'public';

export interface SimpleBaseEntity {
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface BaseEntity {
  id: string;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}
