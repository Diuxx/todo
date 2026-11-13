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
