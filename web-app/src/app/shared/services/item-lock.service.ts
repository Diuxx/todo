import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { SettingsService } from "./settings.service";
import { PasswordService } from "./password.service";

@Injectable({ providedIn: "root" })
export class ItemLockService {
  private readonly settingsService = inject(SettingsService);
  private readonly passwordService = inject(PasswordService);
  private readonly unlockedItemIds = new Set<string>();

  public isUnlocked(itemId: string): boolean {
    return this.unlockedItemIds.has(itemId);
  }

  public unlock(itemId: string): void {
    this.unlockedItemIds.add(itemId);
  }

  public lock(itemId: string): void {
    this.unlockedItemIds.delete(itemId);
  }

  public async verifyPassword(candidate: string): Promise<boolean> {
    const settings = await firstValueFrom(this.settingsService.get());

    if (!settings) {
      return false;
    }

    return this.passwordService.verify(candidate, settings.passwordHash);
  }
}