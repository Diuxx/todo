import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";

export interface TodoProgress {
    done: number;
    total: number;
}

@Injectable({ providedIn: 'root' })
export class SaveActionService {

    private readonly saveSubject = new Subject<void>();
    private readonly todoProgressSubject = new BehaviorSubject<TodoProgress | null>(null);

    public get save$(): Observable<void> {
        return this.saveSubject.asObservable();
    }

    public get todoProgress$(): Observable<TodoProgress | null> {
        return this.todoProgressSubject.asObservable();
    }

    public triggerSave(): void {
        this.saveSubject.next();
    }

    public updateTodoProgress(progress: TodoProgress | null): void {
        this.todoProgressSubject.next(progress);
    }
}
