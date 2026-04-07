import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { AppItem } from "../models/app-item.model";
import { db } from "../../db.config";
import { generateUUID } from "../utils";
import { RecurrenceType, TodoStatus } from "../models/base-entity.model";
import { TodoHistoryEntry } from "../models/todo-history.model";

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
                .then(async (items) => {
                    const sortedItems = items.sort((a, b) => {
                        if (a.isFavorite !== b.isFavorite) {
                            return Number(b.isFavorite) - Number(a.isFavorite);
                        }
                        return b.createdAt.localeCompare(a.createdAt);
                    });

                    return this.hydrateTodoItemsStatus(sortedItems);
                })
            );
    }

    /**
     * Retrieves a single item by its ID.
     * @param id The ID of the item to retrieve.
     * @returns An observable that emits the AppItem object if found, or undefined if not found.
     */
    public getItemById(id: string): Observable<AppItem | undefined> {
            return from(
                db.items.get(id).then(async (item) => {
                    if (!item || item.type !== 'todo' || !item.todoContent?.length) {
                        return item;
                    }

                    const [hydratedItem] = await this.hydrateTodoItemsStatus([item]);
                    return hydratedItem;
                })
            );
    }

    private async hydrateTodoItemsStatus(items: AppItem[]): Promise<AppItem[]> {
        const todoItems = items.filter(item => item.type === 'todo' && item.todoContent?.length);

        if (!todoItems.length) {
            return items;
        }

        const subItemIds = todoItems.flatMap(item => item.todoContent?.map(subItem => subItem.id) ?? []);

        if (!subItemIds.length) {
            return items;
        }

        const historyEntries = await db.todoHistory
            .where('todoItemId')
            .anyOf(subItemIds)
            .toArray();

        const historyBySubItem = new Map<string, TodoHistoryEntry[]>();

        for (const entry of historyEntries) {
            const existing = historyBySubItem.get(entry.todoItemId);

            if (existing) {
                existing.push(entry);
            } else {
                historyBySubItem.set(entry.todoItemId, [entry]);
            }
        }

        return items.map(item => {
            if (item.type !== 'todo' || !item.todoContent?.length) {
                return item;
            }

            const hydratedTodoContent = item.todoContent.map(subItem => {
                const subItemHistory = historyBySubItem.get(subItem.id) ?? [];
                const recurrenceType = subItem.config?.recurrenceType ?? 'none';
                const status = this.resolveCurrentTodoStatus(subItemHistory, recurrenceType);

                return {
                    ...subItem,
                    isDone: status === 'done',
                    config: {
                        recurrenceType,
                        alertEnabled: subItem.config?.alertEnabled ?? false,
                        alertAt: subItem.config?.alertAt,
                        recurrenceRule: subItem.config?.recurrenceRule,
                        lastCompletedAt: subItem.config?.lastCompletedAt,
                        nextDueAt: subItem.config?.nextDueAt,
                    }
                };
            });

            return {
                ...item,
                todoContent: hydratedTodoContent,
            };
        });
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

    private resolveCurrentTodoStatus(historyEntries: TodoHistoryEntry[], recurrenceType: RecurrenceType): TodoStatus {
        if (!historyEntries.length) {
            return 'pending';
        }

        const sortedHistory = [...historyEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        if (recurrenceType === 'daily') {
            const { startISO, endISO } = this.getPeriodBounds('daily');
            const latestInPeriod = sortedHistory.find(entry =>
                entry.completedAt !== undefined &&
                entry.completedAt >= startISO &&
                entry.completedAt < endISO
            );
            return latestInPeriod?.status === 'done' ? 'done' : 'pending';
        }

        if (recurrenceType === 'weekly') {
            const { startISO, endISO } = this.getPeriodBounds('weekly');
            const latestInPeriod = sortedHistory.find(entry =>
                entry.completedAt !== undefined &&
                entry.completedAt >= startISO &&
                entry.completedAt < endISO
            );
            return latestInPeriod?.status === 'done' ? 'done' : 'pending';
        }

        if (recurrenceType === 'monthly') {
            const { startISO, endISO } = this.getPeriodBounds('monthly');
            const latestInPeriod = sortedHistory.find(entry =>
                entry.completedAt !== undefined &&
                entry.completedAt >= startISO &&
                entry.completedAt < endISO
            );
            return latestInPeriod?.status === 'done' ? 'done' : 'pending';
        }

        return sortedHistory[0].status;
    }

    private getPeriodBounds(period: 'daily' | 'weekly' | 'monthly'): { startISO: string; endISO: string } {
        const now = new Date();

        if (period === 'daily') {
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setDate(end.getDate() + 1);

            return { startISO: start.toISOString(), endISO: end.toISOString() };
        }

        if (period === 'weekly') {
            const dayOfWeek = now.getDay();
            const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

            const start = new Date(now);
            start.setDate(start.getDate() - daysSinceMonday);
            start.setHours(0, 0, 0, 0);

            const end = new Date(start);
            end.setDate(end.getDate() + 7);

            return { startISO: start.toISOString(), endISO: end.toISOString() };
        }

        const start = new Date(now);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        return { startISO: start.toISOString(), endISO: end.toISOString() };
    }
}