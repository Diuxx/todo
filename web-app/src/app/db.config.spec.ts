import Dexie from 'dexie';
import { AppDb } from './db.config';

describe('AppDb migrations', () => {
  let databaseName: string;

  beforeEach(() => {
    databaseName = 'todo-migration-test-' + crypto.randomUUID();
  });

  afterEach(async () => {
    await Dexie.delete(databaseName);
  });

  it('preserves version-1 items and creates budgets on upgrade to version 5', async () => {
    const legacy = new Dexie(databaseName);
    legacy.version(1).stores({
      items: 'id, type, createdAt, updatedAt',
      todoHistory:
        'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
      citationsMeta: 'id, itemId, author',
      imagesMeta: 'id, itemId',
      settings: 'id',
    });
    await legacy.open();
    await legacy.table('items').put({
      id: 'old-note',
      type: 'note',
      date: undefined,
      fromCalendar: false,
      title: 'Preserved',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    });
    legacy.close();

    const upgraded = new AppDb(databaseName, 5);
    try {
      await upgraded.open();
      expect((await upgraded.items.get('old-note'))?.title).toBe('Preserved');
      expect(await upgraded.budgets.get('main')).toBeDefined();
    } finally {
      upgraded.close();
    }
  });

  it('keeps a version-4 budget when upgrading to version 5', async () => {
    const old = new Dexie(databaseName);
    old.version(4).stores({
      items: 'id, type, createdAt, updatedAt, date, fromCalendar',
      todoHistory:
        'id, todoItemId, status, completedAt, createdAt, [todoItemId+completedAt], [todoItemId+createdAt]',
      citationsMeta: 'id, itemId, author',
      imagesMeta: 'id, itemId',
      budgets: 'id',
      settings: 'id',
    });
    await old.open();
    await old.table('budgets').put({
      id: 'main',
      periods: [{ date: '2026-04', incomes: [], expenses: [] }],
      accounts: [],
      expenseCategories: [],
      incomeTypes: [],
    });
    old.close();

    const upgraded = new AppDb(databaseName, 5);
    try {
      await upgraded.open();
      expect((await upgraded.budgets.get('main'))?.periods[0].date).toBe('2026-04');
    } finally {
      upgraded.close();
    }
  });
});
