import { ItemColor } from "./base-entity.model";

export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: "fr" | "en";
  dailyAffirmationEnabled: boolean;
  defaultItemColor: ItemColor;
  showArchivedItems: boolean;
}