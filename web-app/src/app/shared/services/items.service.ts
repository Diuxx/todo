import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { AppItem } from "../models/app-item.model";
import { TodoConfig } from "../models/todo-config.model";
import { db } from "../../db.config";
import { generateUUID } from "../utils";

@Injectable({ providedIn: 'root' }) // No provider needed.
export class ItemsService {

    /**
     * Retrieves all items from the database, ordered by creation date in descending order.
     * @returns An observable that emits an array of AppItem objects.
     */
    public getAllActive(filter: string | null = null): Observable<AppItem[]> {
        return from(
            db.items
                .filter(item => !item.isArchived && (!filter || item.type === filter))
                .toArray()
                .then((items) => {
                    const sortedItems = items.sort((a, b) => {
                        if (a.isFavorite !== b.isFavorite) {
                            return Number(b.isFavorite) - Number(a.isFavorite);
                        }
                        return b.createdAt.localeCompare(a.createdAt);
                    });

                    return sortedItems;
                })
            );
    }

    /**
     * Updates an existing item in the database.
     * @param item The item to update.
     * @returns An observable that emits the updated item.
     */
    public updateItem(item: AppItem): Observable<AppItem> {
        const now = new Date().toISOString();
        const payload: AppItem = {
            ...item,
            updatedAt: now,
        };
        return from(db.items.put(payload).then(() => payload));
    }

    /**
     * Creates a new item in the database.
     */
    public createItem(item: AppItem): Observable<AppItem> {
        const payload: AppItem = {
            ...item,
            id: generateUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        return from(db.items.add(payload).then(() => payload));
    }
}