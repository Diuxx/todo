export interface ImageMeta {
  itemId: string; // référence vers AppItem.id
  imageUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  alt?: string;
}