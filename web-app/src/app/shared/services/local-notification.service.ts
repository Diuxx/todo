import { Injectable } from "@angular/core";
import {
  LocalNotifications,
  LocalNotificationSchema,
  PendingLocalNotificationSchema,
  PendingResult,
  PermissionStatus,
  ActionPerformed,
  Weekday,
} from '@capacitor/local-notifications';
import { DailyTaskNotification } from "../models/daily-task-notification.model";
import { AppItem, TodoInformation } from "../models/app-item.model";
import { db } from "../../db.config";


@Injectable({
  providedIn: 'root',
})
export class LocalNotificationService {
  private readonly todoNotificationKind = 'todo-reminder';
  private isInitialized = false;
  private initPromise?: Promise<void>;
  private onNotificationTap?: (action: ActionPerformed) => void;

  /**
   * Initializes the service by requesting permission and wiring listeners.
   */
  async init(onNotificationTap?: (action: ActionPerformed) => void): Promise<void> {
    if (onNotificationTap) {
      this.onNotificationTap = onNotificationTap;
    }

    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = undefined;
    }
  }

  /**
   * Schedules a daily notification.
   */
  async scheduleDaily(notification: DailyTaskNotification): Promise<void> {
    await this.ensurePermission();

    await LocalNotifications.schedule({
      notifications: [
        {
          ...this.buildBaseNotification(notification),
          schedule: {
            on: {
              hour: notification.hour,
              minute: notification.minute,
              second: 0,
            },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });
  }

  /**
   * Schedules a weekly notification.
   */
  async scheduleWeekly(notification: DailyTaskNotification): Promise<void> {
    if (!notification.weekday) {
      throw new Error('A weekday is required for a weekly notification');
    }

    await this.ensurePermission();

    await LocalNotifications.schedule({
      notifications: [
        {
          ...this.buildBaseNotification(notification),
          schedule: {
            on: {
              weekday: notification.weekday,
              hour: notification.hour,
              minute: notification.minute,
              second: 0,
            },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });
  }

  /**
   * Schedules a monthly notification.
   */
  async scheduleMonthly(notification: DailyTaskNotification): Promise<void> {
    if (!notification.dayOfMonth) {
      throw new Error('A day of month is required for a monthly notification');
    }

    await this.ensurePermission();

    await LocalNotifications.schedule({
      notifications: [
        {
          ...this.buildBaseNotification(notification),
          schedule: {
            on: {
              day: notification.dayOfMonth,
              hour: notification.hour,
              minute: notification.minute,
              second: 0,
            },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });
  }

  /**
   * Creates a notification payload from a todo item.
   * Returns null when the todo has no valid alert time.
   */
  createNotificationFromTodo(
    todo: TodoInformation,
    options: {
      route?: string;
      body?: string;
      fallbackTitle?: string;
      taskId?: number;
    } = {}
  ): DailyTaskNotification | null {
    const alertAt = todo.config?.alertAt;

    if (!alertAt) {
      return null;
    }

    const time = this.parseAlertTime(alertAt);

    if (!time) {
      return null;
    }

    const title = todo.title?.trim() || options.fallbackTitle || 'Todo reminder';
    const notification: DailyTaskNotification = {
      taskId: options.taskId ?? this.toNotificationId(todo.id),
      title,
      body: options.body ?? title,
      hour: time.hour,
      minute: time.minute,
      route: options.route,
    };

    if (todo.config?.recurrenceType === 'weekly') {
      notification.weekday = this.parseWeeklyRule(todo.config?.recurrenceRule);
    }

    if (todo.config?.recurrenceType === 'monthly') {
      notification.dayOfMonth = this.parseMonthlyRule(todo.config?.recurrenceRule);
    }

    return notification;
  }

  /**
   * Schedules a notification directly from a todo item based on its recurrence.
   */
  async scheduleFromTodo(
    todo: TodoInformation,
    options: {
      route?: string;
      body?: string;
      fallbackTitle?: string;
      taskId?: number;
    } = {}
  ): Promise<void> {
    const notification = this.createNotificationFromTodo(todo, options);

    if (!notification) {
      throw new Error('The todo item does not contain a valid alert time');
    }

    switch (todo.config?.recurrenceType) {
      case 'weekly':
        await this.scheduleWeekly(notification);
        return;
      case 'monthly':
        await this.scheduleMonthly(notification);
        return;
      default:
        await this.scheduleDaily(notification);
    }
  }

  /**
   * Verifies and recreates the expected todo notifications when the app starts.
   */
  async syncScheduledTodoNotifications(): Promise<void> {
    if (!await this.hasNotificationPermission()) {
      return;
    }

    const items = await db.items.toArray();
    const todoItems = items.filter((item) => item.type === 'todo');
    const expectedNotifications = await this.buildNotificationsForItems(todoItems);
    const expectedIds = new Set(expectedNotifications.map((notification) => notification.taskId));
    const pending = await this.getPending();
    const pendingIds = new Set(
      pending.notifications
        .filter((notification) => this.isManagedTodoNotification(notification))
        .map((notification) => notification.id)
    );
    const staleIds = pending.notifications
      .filter((notification) => this.isManagedTodoNotification(notification) && !expectedIds.has(notification.id))
      .map((notification) => notification.id);

    await this.cancelNotificationsByIds(staleIds);

    for (const notification of expectedNotifications) {
      if (pendingIds.has(notification.taskId)) {
        continue;
      }

      await this.scheduleByPattern(notification);
    }
  }

  /**
   * Synchronizes notifications for one todo item after create or update.
   */
  async syncTodoNotificationsForItem(item: AppItem, previousItem?: AppItem): Promise<void> {
    if (!await this.hasNotificationPermission()) {
      return;
    }

    const idsToReset = new Set<number>([
      ...this.collectNotificationIds(previousItem),
      ...this.collectNotificationIds(item),
    ]);

    await this.cancelNotificationsByIds([...idsToReset]);

    for (const notification of await this.buildNotificationsForItem(item)) {
      await this.scheduleByPattern(notification);
    }
  }

  /**
   * Removes all notifications related to a todo item.
   */
  async removeTodoNotificationsForItem(item?: AppItem): Promise<void> {
    if (!item) {
      return;
    }

    await this.cancelNotificationsByIds(this.collectNotificationIds(item));
  }

  /**
   * Cancels a notification by its task id.
   */
  async cancel(taskId: number): Promise<void> {
    await this.removeDeliveredNotificationsByIds([taskId]);

    await LocalNotifications.cancel({
      notifications: [{ id: taskId }],
    });
  }

  /**
   * Reschedules a daily notification by cancelling the previous one first.
   */
  async rescheduleDaily(notification: DailyTaskNotification): Promise<void> {
    await this.cancel(notification.taskId);
    await this.scheduleDaily(notification);
  }

  /**
   * Reschedules a weekly notification by cancelling the previous one first.
   */
  async rescheduleWeekly(notification: DailyTaskNotification): Promise<void> {
    await this.cancel(notification.taskId);
    await this.scheduleWeekly(notification);
  }

  /**
   * Reschedules a monthly notification by cancelling the previous one first.
   */
  async rescheduleMonthly(notification: DailyTaskNotification): Promise<void> {
    await this.cancel(notification.taskId);
    await this.scheduleMonthly(notification);
  }

  /**
   * Cancels all scheduled notifications.
   */
  async cancelAll(): Promise<void> {
    const pending = await this.getPending();

    if (!pending.notifications.length) {
      return;
    }

    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });
  }

  /**
   * Removes all app-managed todo notifications, both pending and already delivered.
   */
  async clearAllTodoNotifications(): Promise<void> {
    const pending = await this.getPending();
    const pendingNotifications = pending.notifications.filter((notification) => this.isManagedTodoNotification(notification));

    if (pendingNotifications.length) {
      await LocalNotifications.cancel({
        notifications: pendingNotifications.map((notification) => ({ id: notification.id })),
      });
    }

    const delivered = await LocalNotifications.getDeliveredNotifications();
    const deliveredNotifications = delivered.notifications.filter(
      (notification) => notification.extra?.kind === this.todoNotificationKind
    );

    if (deliveredNotifications.length) {
      await LocalNotifications.removeDeliveredNotifications({ notifications: deliveredNotifications });
    }
  }

  /**
   * Returns the pending notifications.
   */
  async getPending(): Promise<PendingResult> {
    return await LocalNotifications.getPending();
  }

  /**
   * Checks whether a notification already exists for a task id.
   */
  async exists(taskId: number): Promise<boolean> {
    const pending = await this.getPending();
    return pending.notifications.some((notification) => notification.id === taskId);
  }

  /**
   * Checks notification permissions without initializing the service.
   */
  async checkPermissions(): Promise<PermissionStatus> {
    return await LocalNotifications.checkPermissions();
  }

  /**
   * Explicitly requests notification permissions.
   */
  async requestPermissions(): Promise<PermissionStatus> {
    return await LocalNotifications.requestPermissions();
  }

  private async initialize(): Promise<void> {
    const permission: PermissionStatus = await LocalNotifications.requestPermissions();

    if (permission.display !== 'granted') {
      throw new Error('Permission de notifications refusée');
    }

    await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('[LocalNotification] Notification tap:', action);
        this.onNotificationTap?.(action);
      }
    );

    await LocalNotifications.addListener(
      'localNotificationReceived',
      (notification: LocalNotificationSchema) => {
        console.log('[LocalNotification] Notification received:', notification);
      }
    );

    this.isInitialized = true;
  }

  private async ensurePermission(): Promise<void> {
    const permission = await LocalNotifications.checkPermissions();

    if (permission.display === 'granted') {
      return;
    }

    const requested = await LocalNotifications.requestPermissions();

    if (requested.display !== 'granted') {
      throw new Error('Permission de notifications refusée');
    }
  }

  private buildBaseNotification(notification: DailyTaskNotification) {
    return {
      id: notification.taskId,
      title: notification.title,
      body: notification.body,
      extra: {
        kind: this.todoNotificationKind,
        taskId: notification.taskId,
        route: notification.route,
      },
    };
  }

  private async buildNotificationsForItems(items: AppItem[]): Promise<DailyTaskNotification[]> {
    const notifications = await Promise.all(items.map((item) => this.buildNotificationsForItem(item)));
    return notifications.flat();
  }

  private async buildNotificationsForItem(item: AppItem): Promise<DailyTaskNotification[]> {
    if (item.type !== 'todo' || item.isArchived || !item.todoContent?.length) {
      return [];
    }

    const notifications = await Promise.all(item.todoContent.map(async (todo) => {
      if (!this.shouldScheduleTodo(todo)) {
        return null;
      }

      if (await this.isTodoCompletedForCurrentPeriod(todo)) {
        return null;
      }

      const notification = this.createNotificationFromTodo(todo, {
        route: `/item/${item.id}`,
        fallbackTitle: item.title?.trim() || 'Todo reminder',
        body: todo.title?.trim() || item.title?.trim() || 'Todo reminder',
      });

      if (!notification) {
        return null;
      }

      if (todo.config?.recurrenceType === 'weekly' && !notification.weekday) {
        return null;
      }

      if (todo.config?.recurrenceType === 'monthly' && !notification.dayOfMonth) {
        return null;
      }

      return notification;
    }));

    return notifications.filter((notification): notification is DailyTaskNotification => notification !== null);
  }

  private shouldScheduleTodo(todo: TodoInformation): boolean {
    if (todo.isDone) {
      return false;
    }

    if (!todo.config?.alertEnabled || !todo.config.alertAt) {
      return false;
    }

    return todo.config.recurrenceType === 'daily'
      || todo.config.recurrenceType === 'weekly'
      || todo.config.recurrenceType === 'monthly';
  }

  private collectNotificationIds(item?: AppItem): number[] {
    if (item?.type !== 'todo' || !item.todoContent?.length) {
      return [];
    }

    return item.todoContent.map((todo) => this.toNotificationId(todo.id));
  }

  private async scheduleByPattern(notification: DailyTaskNotification): Promise<void> {
    if (notification.weekday) {
      await this.scheduleWeekly(notification);
      return;
    }

    if (notification.dayOfMonth) {
      await this.scheduleMonthly(notification);
      return;
    }

    await this.scheduleDaily(notification);
  }

  private async cancelNotificationsByIds(ids: number[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    await this.removeDeliveredNotificationsByIds(ids);

    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
  }

  private async removeDeliveredNotificationsByIds(ids: number[]): Promise<void> {
    if (!ids.length) {
      return;
    }

    const delivered = await LocalNotifications.getDeliveredNotifications();
    const notifications = delivered.notifications.filter((notification) => ids.includes(notification.id));

    if (!notifications.length) {
      return;
    }

    await LocalNotifications.removeDeliveredNotifications({ notifications });
  }

  private isManagedTodoNotification(notification: PendingLocalNotificationSchema): boolean {
    return notification.extra?.kind === this.todoNotificationKind;
  }

  private async hasNotificationPermission(): Promise<boolean> {
    const permission = await this.checkPermissions();
    return permission.display === 'granted';
  }

  private async isTodoCompletedForCurrentPeriod(todo: TodoInformation): Promise<boolean> {
    if (todo.isDone) {
      return true;
    }

    const recurrenceType = todo.config?.recurrenceType;

    if (recurrenceType !== 'daily' && recurrenceType !== 'weekly' && recurrenceType !== 'monthly') {
      return false;
    }

    const { startISO, endISO } = this.getPeriodBounds(recurrenceType);
    const count = await db.todoHistory
      .where('todoItemId')
      .equals(todo.id)
      .and((entry) =>
        entry.status === 'done'
        && entry.completedAt !== undefined
        && entry.completedAt >= startISO
        && entry.completedAt < endISO
      )
      .count();

    return count > 0;
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

  private parseAlertTime(alertAt: string): { hour: number; minute: number } | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(alertAt.trim());

    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return null;
    }

    return { hour, minute };
  }

  private parseWeeklyRule(rule?: string): Weekday | undefined {
    const rawValue = rule?.split(':')[1]?.split(',')[0]?.trim().toLowerCase();

    if (!rawValue) {
      return undefined;
    }

    const weekdayMap: Record<string, Weekday> = {
      sunday: Weekday.Sunday,
      monday: Weekday.Monday,
      tuesday: Weekday.Tuesday,
      wednesday: Weekday.Wednesday,
      thursday: Weekday.Thursday,
      friday: Weekday.Friday,
      saturday: Weekday.Saturday,
    };

    return weekdayMap[rawValue];
  }

  private parseMonthlyRule(rule?: string): number | undefined {
    const rawValue = rule?.split(':')[1]?.trim();
    const day = rawValue ? Number(rawValue) : NaN;

    if (Number.isNaN(day) || day < 1 || day > 31) {
      return undefined;
    }

    return day;
  }

  private toNotificationId(sourceId: string): number {
    let hash = 0;

    for (let index = 0; index < sourceId.length; index++) {
      hash = ((hash << 5) - hash) + sourceId.charCodeAt(index);
      hash |= 0;
    }

    return hash === 0 ? 1 : Math.abs(hash);
  }
}