import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { AppItem } from "../models/app-item.model";
import { TodoConfig } from "../models/todo-config.model";
import { db } from "../../db.config";

@Injectable({ providedIn: 'root' }) // No provider needed.
export class ItemsService {

    /**
     * Retrieves all items from the database, ordered by creation date in descending order.
     * @returns An observable that emits an array of AppItem objects.
     */
    public getAllActive(): Observable<AppItem[]> {
        return from(
            db.items
                .filter(item => !item.isArchived)
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
}