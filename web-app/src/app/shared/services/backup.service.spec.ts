import { db } from '../../db.config';
import { MAX_BACKUP_BYTES } from '../utils/backup-validation';
import { BackupService } from './backup.service';

describe('BackupService safety', () => {
  let service: BackupService;
  let testItemId: string;

  beforeEach(async () => {
    await db.open();
    service = new BackupService();
    testItemId = 'p2-backup-' + crypto.randomUUID();

    await db.items.add({
      id: testItemId,
      type: 'note',
      title: 'Keep this item',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      createdAt: '2026-11-13T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
    });
  });

  afterEach(async () => {
    await db.items.delete(testItemId);
  });

  it('rejects an invalid JSON file without deleting existing records', async () => {
    const invalidFile = new File(['not valid JSON'], 'broken.json', {
      type: 'application/json',
    });

    await expectAsync(service.restoreFromFile(invalidFile)).toBeRejected();
    expect((await db.items.get(testItemId))?.title).toBe('Keep this item');
  });

  it('rejects a structurally invalid backup before any database write', async () => {
    const invalidFile = new File([JSON.stringify({ id: 'app-data', items: [] })], 'bad.json', {
      type: 'application/json',
    });

    await expectAsync(service.restoreFromFile(invalidFile)).toBeRejectedWithError(
      'Le fichier JSON ne correspond pas au format attendu.'
    );
    expect(await db.items.get(testItemId)).toBeDefined();
  });

  it('refuses an oversized file without touching local data', async () => {
    const tooLarge = new File([new Uint8Array(MAX_BACKUP_BYTES + 1)], 'large.json', {
      type: 'application/json',
    });

    await expectAsync(service.restoreFromFile(tooLarge)).toBeRejectedWithError(
      'Le fichier dépasse la taille maximale autorisée (10 Mo).'
    );
    expect(await db.items.get(testItemId)).toBeDefined();
  });
});
