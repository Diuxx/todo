import { Injectable } from "@angular/core";
import { AppData } from "../models/app-data.model";
import { appDataExample } from "../models/mock-data";
import { Observable, of } from "rxjs";

@Injectable({ providedIn: 'root' }) // No provider needed.
export class AppDataService {

  constructor() {
  }

  /**
   * 
   * @returns 
   */
  public getAll(): Observable<AppData> {
    // as observable: return of(appDataExample);
    return of(appDataExample);
  }
}