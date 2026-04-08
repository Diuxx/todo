import { Injectable } from "@angular/core";
import { BehaviorSubject, from, Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppSettings } from "../models/app-settings.model";
import { db } from "../../db.config";
import { PasswordService } from "./password.service";

const SETTINGS_ID = 'app-settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {

  private readonly settingsSubject = new BehaviorSubject<AppSettings | null>(null);
  private readonly passwordService = new PasswordService();

  /**
   * Emits the latest settings whenever they are loaded or updated.
   * Useful for cross-component reactivity (e.g. applying theme, language).
   */
  public readonly settings$ = this.settingsSubject.asObservable();

  /**
   * Loads the application settings from the database.
   * @returns Observable<AppSettings | undefined>
   */
  public get(): Observable<AppSettings | undefined> {
    return from(
      this.loadSettings()
    ).pipe(
      tap(settings => {
        if (settings) {
          this.settingsSubject.next(settings);
        }
      })
    );
  }

  /**
   * Persists updated settings to the database.
   * @param settings The full settings object to save.
   * @returns Observable<AppSettings>
   */
  public update(settings: AppSettings): Observable<AppSettings> {
    const payload: AppSettings = {
      ...settings,
      id: SETTINGS_ID,
      passwordHash: settings.passwordHash || this.passwordService.defaultPasswordHash,
    };

    return from(
      db.settings.put(payload).then(() => payload)
    ).pipe(
      tap(saved => this.settingsSubject.next(saved))
    );
  }

  private async loadSettings(): Promise<AppSettings | undefined> {
    const settings = await db.settings.get(SETTINGS_ID);

    if (!settings) {
      return undefined;
    }

    if (settings.passwordHash) {
      return settings;
    }

    const normalized: AppSettings = {
      ...settings,
      passwordHash: this.passwordService.defaultPasswordHash,
    };

    await db.settings.put(normalized);
    return normalized;
  }
}
