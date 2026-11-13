import { CanDeactivateFn } from '@angular/router';

export interface PendingChangesComponent {
  canDeactivate(): Promise<boolean> | boolean;
}

// An editor must finish pending writes before Angular destroys its component.
export const protectPendingChanges: CanDeactivateFn<PendingChangesComponent> = (component) =>
  component.canDeactivate();
