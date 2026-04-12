import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { take } from 'rxjs/operators';

export type ConfirmDialogVariant = 'danger' | 'neutral';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmDialogVariant;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: ConfirmDialogVariant;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialogStateSubject = new BehaviorSubject<ConfirmDialogState | null>(null);
  private pendingResponse?: Subject<boolean>;

  public get dialogState$(): Observable<ConfirmDialogState | null> {
    return this.dialogStateSubject.asObservable();
  }

  public confirm(options: ConfirmDialogOptions): Observable<boolean> {
    if (this.pendingResponse) {
      this.pendingResponse.next(false);
      this.pendingResponse.complete();
    }

    this.pendingResponse = new Subject<boolean>();

    this.dialogStateSubject.next({
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirmer',
      cancelText: options.cancelText ?? 'Annuler',
      variant: options.variant ?? 'neutral',
    });

    return this.pendingResponse.asObservable().pipe(take(1));
  }

  public resolve(confirmed: boolean): void {
    if (!this.pendingResponse) {
      return;
    }

    this.pendingResponse.next(confirmed);
    this.pendingResponse.complete();
    this.pendingResponse = undefined;
    this.dialogStateSubject.next(null);
  }
}
