import { ItemColor } from './base-entity.model';

export interface AppSettings {
  id: string;
  theme: 'light' | 'dark' | 'system';
  language: 'fr' | 'en';
  dailyAffirmationEnabled: boolean;
  showArchivedItems: boolean;
  passwordHash: string;
  userName: string; // displayed in app header.
  userId: string; // to backup/restore data from database.
  backupState: BackupState;
  version: number; // to manage data structure changes in the future.
}

export interface BackupState {
  lastBackupAt?: string;
  status: 'idle' | 'saving' | 'success' | 'error';
  lastError?: string;
}
