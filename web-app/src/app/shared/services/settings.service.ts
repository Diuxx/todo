import { Injectable } from "@angular/core";
import { BehaviorSubject, from, Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AppSettings } from "../models/app-settings.model";
import { db } from "../../db.config";

const SETTINGS_ID = 'app-settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {

  private readonly settingsSubject = new BehaviorSubject<AppSettings | null>(null);

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
      db.settings.get(SETTINGS_ID)
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
    };

    return from(
      db.settings.put(payload).then(() => payload)
    ).pipe(
      tap(saved => this.settingsSubject.next(saved))
    );
  }
}
