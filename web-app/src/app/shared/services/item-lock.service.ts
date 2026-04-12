import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from './settings.service';
import { PasswordService } from './password.service';

@Injectable({ providedIn: 'root' })
export class ItemLockService {
  private readonly settingsService = inject(SettingsService);
  private readonly passwordService = inject(PasswordService);
  private readonly unlockedItemIds = new Set<string>();

  /**
   * Returns whether an item is currently unlocked in this app session.
   */
  public isUnlocked(itemId: string): boolean {
    return this.unlockedItemIds.has(itemId);
  }

  /**
   * Marks an item as unlocked for the current app session.
   */
  public unlock(itemId: string): void {
    this.unlockedItemIds.add(itemId);
  }

  /**
   * Removes the in-memory unlocked state for an item.
   */
  public lock(itemId: string): void {
    this.unlockedItemIds.delete(itemId);
  }

  /**
   * Verifies a clear password against the configured application password hash.
   */
  public async verifyPassword(candidate: string): Promise<boolean> {
    const settings = await firstValueFrom(this.settingsService.get());

    if (!settings) {
      return false;
    }

    return this.passwordService.verify(candidate, settings.passwordHash);
  }
}
