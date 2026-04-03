import { ItemColor } from "./base-entity.model";

export interface AppSettings {
  id: string;
  theme: "light" | "dark" | "system";
  language: "fr" | "en";
  dailyAffirmationEnabled: boolean;
  showArchivedItems: boolean;
  userId: string; // to backup/restore data from database.
}