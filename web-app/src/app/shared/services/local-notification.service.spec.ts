import { db } from '../../db.config';
import { TodoInformation } from '../models/app-item.model';
import { LocalNotificationService } from './local-notification.service';

describe('LocalNotificationService completion logic', () => {
  let service: LocalNotificationService;
  let todoId: string;
  const earlier = '2026-11-12T10:00:00.000Z';
  const later = '2026-11-13T10:00:00.000Z';

  function createTodo(): TodoInformation {
    return {
      id: todoId,
      title: 'Reminder',
      isDone: false,
      createdAt: earlier,
      updatedAt: later,
      config: {
        criticality: 'l',
        recurrenceType: 'none',
        alertEnabled: true,
        alertAt: '10:30',
      },
    };
  }

  beforeEach(async () => {
    await db.open();
    service = new LocalNotificationService();
    todoId = 'audit-notification-' + crypto.randomUUID();
  });

  afterEach(async () => {
    await db.todoHistory.where('todoItemId').equals(todoId).delete();
  });

  it('keeps a weekly reminder scheduled after the current occurrence is done', async () => {
    const todo = createTodo();
    todo.isDone = true;
    todo.config = {
      ...todo.config!,
      recurrenceType: 'weekly',
      recurrenceRule: 'weekly:monday',
    };

    const notifications = await service['buildNotificationsForItem']({
      id: todoId + '-parent',
      type: 'todo',
      title: 'Routine',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      todoContent: [todo],
      createdAt: earlier,
      updatedAt: later,
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].weekday).toBeDefined();
  });

  it('schedules custom weekday reminders only for selected weekdays', async () => {
    const todo = createTodo();
    todo.isDone = true;
    todo.config = {
      ...todo.config!,
      recurrenceType: 'custom',
      recurrenceRule: '30 10 * * 1,5',
    };

    const notifications = await service['buildNotificationsForItem']({
      id: todoId + '-parent',
      type: 'todo',
      title: 'Routine',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      todoContent: [todo],
      createdAt: earlier,
      updatedAt: later,
    });

    expect(notifications.length).toBe(2);
    expect(new Set(notifications.map((notification) => notification.taskId)).size).toBe(2);
    expect(notifications.every((notification) => notification.weekday !== undefined)).toBeTrue();
  });

  it('does not silently turn unsupported custom cron rules into daily reminders', async () => {
    const todo = createTodo();
    todo.config = {
      ...todo.config!,
      recurrenceType: 'custom',
      recurrenceRule: '0 10 1 * *',
    };

    const notifications = await service['buildNotificationsForItem']({
      id: todoId + '-parent',
      type: 'todo',
      title: 'Routine',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      todoContent: [todo],
      createdAt: earlier,
      updatedAt: later,
    });

    expect(notifications).toEqual([]);
  });

  it('treats a non-recurring todo as completed after restarting with a stale stored flag', async () => {
    await db.todoHistory.add({
      id: todoId + '-done',
      todoItemId: todoId,
      status: 'done',
      completedAt: later,
      createdAt: later,
      updatedAt: later,
    });

    expect(await service['isTodoCompletedForCurrentPeriod'](createTodo())).toBeTrue();
  });

  it('uses the latest history status for non-recurring reminders', async () => {
    await db.todoHistory.bulkAdd([
      {
        id: todoId + '-done',
        todoItemId: todoId,
        status: 'done',
        completedAt: earlier,
        createdAt: earlier,
        updatedAt: earlier,
      },
      {
        id: todoId + '-pending',
        todoItemId: todoId,
        status: 'pending',
        createdAt: later,
        updatedAt: later,
      },
    ]);

    expect(await service['isTodoCompletedForCurrentPeriod'](createTodo())).toBeFalse();
  });
});
