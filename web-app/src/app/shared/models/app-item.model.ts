import { BaseEntity, ItemColor, ItemType, SimpleBaseEntity, Visibility } from "./base-entity.model";
import { TodoConfig } from "./todo-config.model";

export interface AppItem extends BaseEntity {
  type: ItemType;
  title?: string;
  content?: string;
  color: ItemColor;
  visibility: Visibility;
  isArchived: boolean;
  isFavorite: boolean;
  isLocked: boolean;
  isAffirmation: boolean;
  tags: string[];
  todoContent?: TodoInformation[]; // only for type 'todo'.
  coverImageUrl?: string; // todo: feature à venir.
}

export interface TodoInformation extends BaseEntity {
  title?: string;
  isDone?: boolean;
  config?: TodoConfig;
}