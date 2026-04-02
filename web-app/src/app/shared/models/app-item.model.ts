import { BaseEntity, ItemColor, ItemType, Visibility } from "./base-entity.model";

export interface AppItem extends BaseEntity {
  type: ItemType;
  title?: string;
  content?: string;
  color: ItemColor;
  visibility: Visibility;
  isArchived: boolean;
  isFavorite: boolean;
  tags: string[];

  // Pour les vues masonry / UI
  coverImageUrl?: string;
}