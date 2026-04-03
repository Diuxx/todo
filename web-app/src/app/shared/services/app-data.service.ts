import { Injectable } from "@angular/core";
import { AppData } from "../models/app-data.model";
import { appDataExample } from "../models/mock-data";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { AppItem } from "../models/app-item.model";

@Injectable({ providedIn: 'root' }) // No provider needed.
export class AppDataService {

  /**
   * 
   * @returns 
   */
  public getAll(): Observable<AppData> {
    // as observable: return of(appDataExample);
    return of(appDataExample);
  }

  /**
   * Get all active items (not archived) sorted by favorite status and update date.
   * @returns Observable<AppItem[]>
   */
  public getAllActiveItems(): Observable<AppItem[]> {
    const activeItems = appDataExample.items.filter(item => !item.isArchived);
    const sortedItems = activeItems.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) {
        return -1; // a comes before b
      } else if (!a.isFavorite && b.isFavorite) {
        return 1; // b comes before a
      } else {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); // sort by updatedAt desc
      }
    });

    // add a todo-config pointer in 'todo' type of item.
    const todoConfigIncluded = activeItems.map(a => {
      if (a.type === 'todo' && a.todoContent) {
        a.todoContent = a.todoContent.map(sub => ({
          ...sub,
          config: appDataExample.todoConfigs.find(config => config.itemId === sub.id)
        }));
      }
      return a;
    }) 

    return of(todoConfigIncluded);
  }

  /**
   * Get one active item by id.
   * @param id item id
   * @returns Observable<AppItem | undefined>
   */
  public getActiveItemById(id: string): Observable<AppItem | undefined> {
    return this.getAllActiveItems().pipe(
      map(items => items.find(item => item.id === id))
    );
  }
}