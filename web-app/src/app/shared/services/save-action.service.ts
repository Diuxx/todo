import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface TodoProgress {
  done: number;
  total: number;
  dailyDone: number;
  dailyTotal: number;
  weeklyDone: number;
  weeklyTotal: number;
  monthlyDone: number;
  monthlyTotal: number;
}

export type FormSaveState = 'pristine' | 'dirty' | 'saved';

@Injectable({ providedIn: 'root' })
export class SaveActionService {
  private readonly saveSubject = new Subject<void>();
  private readonly todoProgressSubject = new BehaviorSubject<TodoProgress | null>(null);
  private readonly formSaveStateSubject = new BehaviorSubject<FormSaveState>('pristine');

  public get save$(): Observable<void> {
    return this.saveSubject.asObservable();
  }

  public get todoProgress$(): Observable<TodoProgress | null> {
    return this.todoProgressSubject.asObservable();
  }

  public get formSaveState$(): Observable<FormSaveState> {
    return this.formSaveStateSubject.asObservable();
  }

  public triggerSave(): void {
    this.saveSubject.next();
  }

  public updateTodoProgress(progress: TodoProgress | null): void {
    this.todoProgressSubject.next(progress);
  }

  public updateFormSaveState(state: FormSaveState): void {
    this.formSaveStateSubject.next(state);
  }
}
