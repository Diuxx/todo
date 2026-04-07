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
  tags: string[];

  // -- Relations hiérarchiques (ex: pour les tâches et sous-tâches)
  todoContent?: TodoInformation[];

  // Pour les vues masonry / UI
  coverImageUrl?: string;
}

export interface TodoInformation extends BaseEntity {
  title?: string;
  isDone?: boolean;
  config?: TodoConfig; // like a pointer to the actual AppItem config for todos;
}