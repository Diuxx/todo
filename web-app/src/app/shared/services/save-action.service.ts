import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";

@Injectable({ providedIn: 'root' })
export class SaveActionService {

    private readonly saveSubject = new Subject<void>();

    public get save$(): Observable<void> {
        return this.saveSubject.asObservable();
    }

    public triggerSave(): void {
        this.saveSubject.next();
    }
}
