import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { AppItem } from "../models/app-item.model";
import { liveQuery } from "dexie";
import { db } from "../../db.config";



@Injectable({ providedIn: 'root' }) // No provider needed.
export class AppDataService {

    public getAll$(): Observable<AppItem[]> {
        return new Observable<AppItem[]>((subscriber) => {
            const sub = liveQuery(() =>
                db.items.orderBy('createdAt').reverse().toArray()
            ).subscribe({
                next: (items) => subscriber.next(items),
                error: (error) => subscriber.error(error),
            });

            return () => sub.unsubscribe();
        });
    }
}