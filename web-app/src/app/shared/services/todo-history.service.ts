import { Injectable } from "@angular/core";
import { from, Observable } from "rxjs";
import { db } from "../../db.config";
import { TodoHistoryEntry } from "../models/todo-history.model";
import { TodoStatus } from "../models/base-entity.model";
import { generateUUID } from "../utils";

@Injectable({ providedIn: 'root' })
export class TodoHistoryService {

    /**
     * Retrieves all todo history entries sorted by completion date (desc).
     * @returns Observable<TodoHistoryEntry[]>
     */
    public getAll(): Observable<TodoHistoryEntry[]> {
        return from(
        db.todoHistory
            .orderBy('completedAt')
            .reverse()
            .toArray()
        );
    }

    /**
     * Retrieves all history entries for a specific todo item.
     * @param todoItemId The id of the todo item.
     * @returns Observable<TodoHistoryEntry[]>
     */
    public getByTodoItemId(todoItemId: string): Observable<TodoHistoryEntry[]> {
        return from(
        db.todoHistory
            .where('todoItemId')
            .equals(todoItemId)
            .toArray()
            .then(entries => entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
        );
    }

    /**
     * Creates a new todo history entry.
     * @param todoItemId The linked todo item id.
     * @param status The status recorded in history.
     * @param note Optional note.
     * @returns Observable<TodoHistoryEntry>
     */
    public create(todoItemId: string, status: TodoStatus, note?: string): Observable<TodoHistoryEntry> {
        const now = new Date().toISOString();
        const payload: TodoHistoryEntry = {
            id: generateUUID(),
            todoItemId,
            status,
            completedAt: status === 'done' ? now : undefined,
            skippedAt: status === 'pending' ? now : undefined,
            note,
            createdAt: now,
            updatedAt: now,
        };

        return from(db.todoHistory.add(payload).then(() => payload));
    }

    /**
     * Deletes one history entry by id.
     * @param id The history entry id.
     * @returns Observable<void>
     */
    public deleteById(id: string): Observable<void> {
        return from(db.todoHistory.delete(id));
    }

    /**
     * Deletes all history entries linked to a todo item.
     * @param todoItemId The linked todo item id.
     * @returns Observable<void>
     */
    public deleteByTodoItemId(todoItemId: string): Observable<void> {
        return from(
        db.todoHistory
            .where('todoItemId')
            .equals(todoItemId)
            .delete()
            .then(() => undefined)
        );
    }

    public isTodoItemDailyDone(todoItemId: string): Observable<boolean> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartISO = todayStart.toISOString();
        return from(
        db.todoHistory
            .where('todoItemId')
            .equals(todoItemId)
            .and(entry => entry.status === 'done' && 
                 entry.completedAt !== undefined &&
                 entry.completedAt >= todayStartISO)
            .count()
            .then(count => count > 0)
        );
    }

    public isTodoItemWeeklyDone(todoItemId: string): Observable<boolean> {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysSinceMonday);
        weekStart.setHours(0, 0, 0, 0);

        const weekStartISO = weekStart.toISOString();

        return from(
        db.todoHistory
            .where('todoItemId')
            .equals(todoItemId)
            .and(entry => entry.status === 'done' &&
                 entry.completedAt !== undefined &&
                 entry.completedAt >= weekStartISO)
            .count()
            .then(count => count > 0)
        );
    }

    public isTodoItemMonthlyDone(todoItemId: string): Observable<boolean> {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthStartISO = monthStart.toISOString();

        return from(
        db.todoHistory
            .where('todoItemId')
            .equals(todoItemId)
            .and(entry => entry.status === 'done' &&
                 entry.completedAt !== undefined &&
                 entry.completedAt >= monthStartISO)
            .count()
            .then(count => count > 0)
        );
    }

    public isTodoItemDone(todoItemId: string): Observable<boolean> {
        return from(
        db.todoHistory
            .where('todoItemId')
            .equals(todoItemId)
            .and(entry => entry.status === 'done')
            .count()
            .then(count => count > 0)
        );
    }

    /**
     * Revoke the "done" status of a todo item by removing it from history.
     */
    public unDoneTodoItem(todoItemId: string): Observable<boolean> {
      return from(
        db.todoHistory
          .where('todoItemId')
          .equals(todoItemId)
          .delete()
          .then(deletedCount => deletedCount > 0)
      );
    }

    /**
     * Removes only today's "done" occurrence for a todo item.
     */
    public unDoneDaily(todoItemId: string): Observable<boolean> {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);

        const nextDayStart = new Date(dayStart);
        nextDayStart.setDate(nextDayStart.getDate() + 1);

        return this.deleteDoneEntriesInRange(todoItemId, dayStart.toISOString(), nextDayStart.toISOString());
    }

    /**
     * Removes only this week's "done" occurrence(s) for a todo item.
     */
    public unDoneWeekly(todoItemId: string): Observable<boolean> {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
        const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysSinceMonday);
        weekStart.setHours(0, 0, 0, 0);

        const nextWeekStart = new Date(weekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);

        return this.deleteDoneEntriesInRange(todoItemId, weekStart.toISOString(), nextWeekStart.toISOString());
    }

    /**
     * Removes only this month's "done" occurrence(s) for a todo item.
     */
    public unDoneMonthly(todoItemId: string): Observable<boolean> {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const nextMonthStart = new Date(monthStart);
        nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);

        return this.deleteDoneEntriesInRange(todoItemId, monthStart.toISOString(), nextMonthStart.toISOString());
    }

    /**
     * Marks a todo item as done by creating a history entry with "done" status.
     * @param todoItemId The id of the todo item to mark as done.
     * @returns Observable<TodoHistoryEntry> The created history entry.
     */
    public markTodoItemAsDone(todoItemId: string): Observable<TodoHistoryEntry> {
      return this.create(todoItemId, 'done');
    }

    /**
     * Marks a todo item as pending by creating a history entry with "pending" status.
     */
    private deleteDoneEntriesInRange(todoItemId: string, startISO: string, endISO: string): Observable<boolean> {
        return from(
            db.todoHistory
                .where('todoItemId')
                .equals(todoItemId)
                .and(entry =>
                    entry.status === 'done' &&
                    entry.completedAt !== undefined &&
                    entry.completedAt >= startISO &&
                    entry.completedAt < endISO
                )
                .delete()
                .then(deletedCount => deletedCount > 0)
        );
    }
}
