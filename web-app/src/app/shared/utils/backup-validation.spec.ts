import { isValidBackup } from './backup-validation';

describe('Backup validation', () => {
  const validBackup = () => ({
    id: 'app-data',
    items: [{
      id: 'item-1',
      type: 'note',
      title: 'Note',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      createdAt: '2026-11-13T08:00:00.000Z',
      updatedAt: '2026-11-13T08:00:00.000Z',
    }],
    todoHistory: [],
    citationsMeta: [],
    imagesMeta: [],
    settings: {
      id: 'app-settings',
      theme: 'system',
      language: 'fr',
      dailyAffirmationEnabled: false,
      showArchivedItems: false,
      passwordHash: '',
      userId: 'user-1',
      userName: 'User',
      version: 5,
    },
  });

  it('accepts a compatible backup without a budget', () => {
    expect(isValidBackup(validBackup())).toBeTrue();
  });

  it('rejects invalid item records', () => {
    const backup = validBackup();
    backup.items[0].type = 'unknown';
    expect(isValidBackup(backup)).toBeFalse();
  });

  it('rejects duplicate entity identifiers', () => {
    const backup = validBackup();
    backup.items.push({ ...backup.items[0] });
    expect(isValidBackup(backup)).toBeFalse();
  });

  it('rejects backups with a newer database schema', () => {
    const backup = validBackup();
    backup.settings.version = 999;
    expect(isValidBackup(backup)).toBeFalse();
  });

  it('rejects a malformed backup', () => {
    expect(isValidBackup(null)).toBeFalse();
    expect(isValidBackup({ items: [] })).toBeFalse();
  });
});
