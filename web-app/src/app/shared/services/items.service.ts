import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { AppItem } from '../models/app-item.model';
import { db } from '../../db.config';
import { generateUUID } from '../utils';
import { RecurrenceType, TodoStatus } from '../models/base-entity.model';
import { TodoHistoryEntry } from '../models/todo-history.model';
import { LocalNotificationService } from './local-notification.service';

@Injectable({ providedIn: 'root' }) // No provider needed.
export class ItemsService {
  constructor(private readonly localNotificationService: LocalNotificationService) {}

  /**
   * Deletes an item from the database by its ID.
   * @param id The ID of the item to delete.
   * @returns An observable that completes when the deletion is done.
   */
  public deleteItem(id: string): Observable<void> {
    return from(this.deleteAndSyncItem(id));
  }

  /**
   * Retrieves all items from the database, ordered by creation date in descending order.
   * @returns An observable that emits an array of AppItem objects.
   */
  public getAll(
    filter: string | null = null,
    includeArchived: boolean = false
  ): Observable<AppItem[]> {
    return from(
      db.items
        .filter(
          (item) => (includeArchived || !item.isArchived) && (!filter || item.type === filter)
        )
        .toArray()
        .then(async (items) => {
          return this.hydrateTodoItemsStatus(
            this.sortItems(items.map((item) => this.normalizeItem(item)))
          );
        })
    );
  }

  public getAllActive(filter: string | null = null): Observable<AppItem[]> {
    return this.getAll(filter, false);
  }

  /**
   * Retrieves a single item by its ID.
   * @param id The ID of the item to retrieve.
   * @returns An observable that emits the AppItem object if found, or undefined if not found.
   */
  public getItemById(id: string): Observable<AppItem | undefined> {
    return from(
      db.items.get(id).then(async (item) => {
        const normalizedItem = item ? this.normalizeItem(item) : undefined;

        if (
          !normalizedItem ||
          normalizedItem.type !== 'todo' ||
          !normalizedItem.todoContent?.length
        ) {
          return normalizedItem;
        }

        const [hydratedItem] = await this.hydrateTodoItemsStatus([normalizedItem]);
        return hydratedItem;
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
      isLocked: !!item.isLocked,
      isAffirmation: item.type === 'citation' ? !!item.isAffirmation : false,
      updatedAt: now,
    };
    return from(this.updateAndSyncItem(payload));
  }

  /**
   * Creates a new item in the database.
   */
  public createItem(item: AppItem): Observable<AppItem> {
    const payload: AppItem = {
      ...item,
      id: generateUUID(),
      isLocked: !!item.isLocked,
      isAffirmation: item.type === 'citation' ? !!item.isAffirmation : false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return from(this.createAndSyncItem(payload));
  }

  private async deleteAndSyncItem(id: string): Promise<void> {
    const existingItem = await db.items.get(id);

    await db.items.delete(id);
    await this.syncNotificationsSafely(undefined, existingItem);
  }

  private async updateAndSyncItem(item: AppItem): Promise<AppItem> {
    const previousItem = await db.items.get(item.id);
    const persistedItem = await this.persistItem(item);

    await this.syncNotificationsSafely(persistedItem, previousItem);

    return persistedItem;
  }

  private async createAndSyncItem(item: AppItem): Promise<AppItem> {
    const persistedItem = await this.persistItem(item, true);

    await this.syncNotificationsSafely(persistedItem);

    return persistedItem;
  }

  /**
   * Sorts items by favorite status and creation date.
   * @param items The array of items to sort.
   * @returns The sorted array of items.
   */
  private sortItems(items: AppItem[]): AppItem[] {
    return items.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return Number(b.isFavorite) - Number(a.isFavorite);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  /**
   * Persists an item in the database, updating existing items or creating new ones.
   * @param item The item to persist.
   * @param isNew Whether the item is new and should be added to the database.
   * @returns The persisted item.
   */
  private async persistItem(item: AppItem, isNew: boolean = false): Promise<AppItem> {
    if (item.type === 'citation' && item.isAffirmation) {
      await db.transaction('rw', db.items, async () => {
        const citations = await db.items
          .filter(
            (existing) =>
              existing.type === 'citation' && existing.id !== item.id && !!existing.isAffirmation
          )
          .toArray();

        if (citations.length) {
          await Promise.all(
            citations.map((citation) =>
              db.items.put({
                ...citation,
                isAffirmation: false,
                updatedAt: new Date().toISOString(),
              })
            )
          );
        }

        if (isNew) {
          await db.items.add(item);
        } else {
          await db.items.put(item);
        }
      });

      return item;
    }

    if (isNew) {
      await db.items.add(item);
    } else {
      await db.items.put(item);
    }

    return item;
  }

  private normalizeItem(item: AppItem): AppItem {
    return {
      ...item,
      isLocked: !!item.isLocked,
    };
  }

  private async syncNotificationsSafely(item?: AppItem, previousItem?: AppItem): Promise<void> {
    try {
      if (item) {
        await this.localNotificationService.syncTodoNotificationsForItem(item, previousItem);
        return;
      }

      await this.localNotificationService.removeTodoNotificationsForItem(previousItem);
    } catch (error) {
      console.error('Notification synchronization failed:', error);
    }
  }

  /**
   * Hydrate les items de type todo avec leur statut actuel calculé à partir de l'historique.
   */
  private async hydrateTodoItemsStatus(items: AppItem[]): Promise<AppItem[]> {
    // Filtre uniquement les items de type todo qui ont des sous-tâches,
    // les autres peuvent être retournés directement sans aller en base.
    const todoItems = items.filter((item) => item.type === 'todo' && item.todoContent?.length);

    if (!todoItems.length) {
      return items;
    }

    // Charge en une seule requête l'intégralité de l'historique pour
    // toutes les sous-tâches impliquées, puis le regroupe par sous-tâche.
    const historyBySubItem = await this.fetchHistoryGroupedBySubItem(todoItems);

    // Pour chaque item, remplace les sous-tâches par leur version hydratée
    // (isDone calculé + config sans le champ status persisté).
    return items.map((item) => {
      if (item.type !== 'todo' || !item.todoContent?.length) {
        return item;
      }

      return {
        ...item,
        todoContent: item.todoContent.map((subItem) =>
          this.hydrateSubItem(subItem, historyBySubItem)
        ),
      };
    });
  }

  /**
   * Collecte tous les IDs de sous-tâches, charge leur historique en batch
   * depuis IndexedDB, et retourne une Map subItemId → entrées d'historique.
   * Un batch unique évite N requêtes séparées (une par sous-tâche).
   */
  private async fetchHistoryGroupedBySubItem(
    todoItems: AppItem[]
  ): Promise<Map<string, TodoHistoryEntry[]>> {
    const subItemIds = todoItems.flatMap(
      (item) => item.todoContent?.map((subItem) => subItem.id) ?? []
    );

    if (!subItemIds.length) {
      return new Map();
    }

    const historyEntries = await db.todoHistory.where('todoItemId').anyOf(subItemIds).toArray();

    // Groupe les entrées par sous-tâche pour un accès en O(1) lors du mapping.
    const historyBySubItem = new Map<string, TodoHistoryEntry[]>();

    for (const entry of historyEntries) {
      const existing = historyBySubItem.get(entry.todoItemId);

      if (existing) {
        existing.push(entry);
      } else {
        historyBySubItem.set(entry.todoItemId, [entry]);
      }
    }

    return historyBySubItem;
  }

  /**
   * Hydrate une sous-tâche individuelle :
   * - calcule isDone à partir de son historique et de sa récurrence
   * - reconstruit sa config sans le champ status (qui n'est plus persisté)
   */
  private hydrateSubItem(
    subItem: AppItem['todoContent'] extends (infer T)[] | undefined ? NonNullable<T> : never,
    historyBySubItem: Map<string, TodoHistoryEntry[]>
  ): typeof subItem {
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
      },
    };
  }

  /**
   * Affect le vrai status d'un todo.
   */
  private resolveCurrentTodoStatus(
    historyEntries: TodoHistoryEntry[],
    recurrenceType: RecurrenceType
  ): TodoStatus {
    if (!historyEntries.length) {
      return 'pending';
    }

    const sortedHistory = [...historyEntries].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );

    if (recurrenceType === 'daily') {
      const { startISO, endISO } = this.getPeriodBounds('daily');
      const latestInPeriod = sortedHistory.find(
        (entry) =>
          entry.completedAt !== undefined &&
          entry.completedAt >= startISO &&
          entry.completedAt < endISO
      );
      return latestInPeriod?.status === 'done' ? 'done' : 'pending';
    }

    if (recurrenceType === 'weekly') {
      const { startISO, endISO } = this.getPeriodBounds('weekly');
      const latestInPeriod = sortedHistory.find(
        (entry) =>
          entry.completedAt !== undefined &&
          entry.completedAt >= startISO &&
          entry.completedAt < endISO
      );
      return latestInPeriod?.status === 'done' ? 'done' : 'pending';
    }

    if (recurrenceType === 'monthly') {
      const { startISO, endISO } = this.getPeriodBounds('monthly');
      const latestInPeriod = sortedHistory.find(
        (entry) =>
          entry.completedAt !== undefined &&
          entry.completedAt >= startISO &&
          entry.completedAt < endISO
      );
      return latestInPeriod?.status === 'done' ? 'done' : 'pending';
    }

    return sortedHistory[0].status;
  }

  /**
   *
   */
  private getPeriodBounds(period: 'daily' | 'weekly' | 'monthly'): {
    startISO: string;
    endISO: string;
  } {
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
