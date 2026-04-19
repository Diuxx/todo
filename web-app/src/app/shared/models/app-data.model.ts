import { AppItem } from './app-item.model';
import { AppSettings } from './app-settings.model';
import { Budget } from './budget/budget.model';
import { CitationMeta } from './citation-meta.model';
import { ImageMeta } from './image-meta.model';
import { TodoHistoryEntry } from './todo-history.model';

export interface AppData {
  id: string; // to backup/restore data from database.
  items: AppItem[];
  todoHistory: TodoHistoryEntry[];
  citationsMeta: CitationMeta[];
  imagesMeta: ImageMeta[];
  budget: Budget;
  settings: AppSettings;
}
