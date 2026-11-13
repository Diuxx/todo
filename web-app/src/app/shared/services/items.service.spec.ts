import { firstValueFrom } from 'rxjs';
import { db } from '../../db.config';
import { AppItem, TodoInformation } from '../models/app-item.model';
import { LocalNotificationService } from './local-notification.service';
import { ItemsService } from './items.service';

describe('ItemsService data cleanup', () => {
  let service: ItemsService;
  let notifications: jasmine.SpyObj<LocalNotificationService>;
  let testId: string;

  const timestamp = '2026-11-13T10:00:00.000Z';

  function createSubItem(id: string): TodoInformation {
    return { id, title: id, createdAt: timestamp, updatedAt: timestamp };
  }

  function createTodo(id: string, subItems: TodoInformation[]): AppItem {
    return {
      id,
      type: 'todo',
      title: 'Test todo',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      todoContent: subItems,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  async function createHistory(id: string, subItemId: string): Promise<void> {
    await db.todoHistory.add({
      id,
      todoItemId: subItemId,
      status: 'done',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  beforeEach(async () => {
    await db.open();
    testId = 'p2-cleanup-' + crypto.randomUUID();
    notifications = jasmine.createSpyObj<LocalNotificationService>('LocalNotificationService', [
      'syncTodoNotificationsForItem',
      'removeTodoNotificationsForItem',
    ]);
    notifications.syncTodoNotificationsForItem.and.resolveTo();
    notifications.removeTodoNotificationsForItem.and.resolveTo();
    service = new ItemsService(notifications);
  });

  afterEach(async () => {
    const ids = [testId, testId + '-other'];
    const subIds = [testId, testId + '-one', testId + '-two', testId + '-other-child'];

    await db.items.bulkDelete(ids);
    await db.todoHistory.where('todoItemId').anyOf(subIds).delete();
    await db.citationsMeta.where('itemId').anyOf(ids).delete();
    await db.imagesMeta.where('itemId').anyOf(ids).delete();
  });

  it('deletes an item and its history and metadata without touching other items', async () => {
    const subItemId = testId + '-one';
    const otherId = testId + '-other';
    const otherChildId = testId + '-other-child';

    await db.items.bulkAdd([
      createTodo(testId, [createSubItem(subItemId)]),
      createTodo(otherId, [createSubItem(otherChildId)]),
    ]);
    await createHistory(testId + '-history', subItemId);
    await createHistory(testId + '-parent-history', testId);
    await createHistory(testId + '-other-history', otherChildId);

    await db.citationsMeta.add({ id: testId + '-citation', itemId: testId });
    await db.imagesMeta.add({ id: testId + '-image', itemId: testId, imageUrl: 'local-image' });

    await firstValueFrom(service.deleteItem(testId));

    expect(await db.items.get(testId)).toBeUndefined();
    expect(await db.todoHistory.where('todoItemId').equals(subItemId).count()).toBe(0);
    expect(await db.todoHistory.where('todoItemId').equals(testId).count()).toBe(0);
    expect(await db.citationsMeta.where('itemId').equals(testId).count()).toBe(0);
    expect(await db.imagesMeta.where('itemId').equals(testId).count()).toBe(0);
    expect(await db.items.get(otherId)).toBeDefined();
    expect(await db.todoHistory.where('todoItemId').equals(otherChildId).count()).toBe(1);
    expect(notifications.removeTodoNotificationsForItem).toHaveBeenCalled();
  });

  it('removes history for deleted subtasks but preserves retained subtask history', async () => {
    const removed = createSubItem(testId + '-one');
    const retained = createSubItem(testId + '-two');
    const parent = createTodo(testId, [removed, retained]);

    await db.items.add(parent);
    await createHistory(testId + '-first-history', removed.id);
    await createHistory(testId + '-second-history', retained.id);

    await firstValueFrom(service.updateItem({ ...parent, todoContent: [retained] }));

    expect(await db.todoHistory.where('todoItemId').equals(removed.id).count()).toBe(0);
    expect(await db.todoHistory.where('todoItemId').equals(retained.id).count()).toBe(1);
    expect((await db.items.get(testId))?.todoContent?.length).toBe(1);
    expect(notifications.syncTodoNotificationsForItem).toHaveBeenCalled();
  });

  it('does not alter other data when deleting an unknown item', async () => {
    await db.items.add(createTodo(testId + '-other', []));

    await firstValueFrom(service.deleteItem(testId));

    expect(await db.items.get(testId + '-other')).toBeDefined();
    expect(notifications.removeTodoNotificationsForItem).not.toHaveBeenCalled();
  });
});
