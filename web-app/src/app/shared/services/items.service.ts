import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { AppItem } from "../models/app-item.model";
import { db } from "../../db.config";
import { generateUUID } from "../utils";

@Injectable({ providedIn: 'root' }) // No provider needed.
export class ItemsService {

    /**
     * Deletes an item from the database by its ID.
     * @param id The ID of the item to delete.
     * @returns An observable that completes when the deletion is done.
     */
    public deleteItem(id: string): Observable<void> {
        return from(db.items.delete(id));
    }

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
     * Retrieves a single item by its ID.
     * @param id The ID of the item to retrieve.
     * @returns An observable that emits the AppItem object if found, or undefined if not found.
     */
    public getItemById(id: string): Observable<AppItem | undefined> {
        return from(db.items.get(id));
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