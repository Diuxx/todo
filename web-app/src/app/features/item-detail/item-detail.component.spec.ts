import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { AppItem } from '../../shared/models/app-item.model';
import { createItemForm } from '../../shared/models/app-item-form.model';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { ItemLockService } from '../../shared/services/item-lock.service';
import { ItemsService } from '../../shared/services/items.service';
import { LocalNotificationService } from '../../shared/services/local-notification.service';
import { SaveActionService } from '../../shared/services/save-action.service';
import { TodoHistoryService } from '../../shared/services/todo-history.service';
import { ItemDetailComponent } from './item-detail.component';

describe('ItemDetailComponent autosave', () => {
  let component: ItemDetailComponent;
  let itemService: jasmine.SpyObj<ItemsService>;
  let saveState: jasmine.SpyObj<SaveActionService>;
  let router: jasmine.SpyObj<Router>;
  let confirmations: jasmine.SpyObj<ConfirmDialogService>;
  let writes: Array<Subject<AppItem>>;

  const original: AppItem = {
    id: 'test-autosave',
    type: 'note',
    title: 'Original',
    content: '',
    color: 'default',
    visibility: 'private',
    isArchived: false,
    isFavorite: false,
    isLocked: false,
    isAffirmation: false,
    tags: [],
    createdAt: '2026-11-13T10:00:00.000Z',
    updatedAt: '2026-11-13T10:00:00.000Z',
  };

  beforeEach(() => {
    writes = [];
    itemService = jasmine.createSpyObj<ItemsService>('ItemsService', ['updateItem', 'deleteItem']);
    itemService.deleteItem.and.returnValue(of(undefined));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    confirmations = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['confirm']);
    confirmations.confirm.and.returnValue(of(true));
    itemService.updateItem.and.callFake(() => {
      const deferred = new Subject<AppItem>();
      writes.push(deferred);
      return deferred.asObservable();
    });
    saveState = jasmine.createSpyObj<SaveActionService>('SaveActionService', [
      'updateFormSaveState',
      'updateTodoProgress',
    ]);

    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: {} },
        { provide: Router, useValue: router },
        { provide: ItemsService, useValue: itemService },
        { provide: SaveActionService, useValue: saveState },
        { provide: ConfirmDialogService, useValue: confirmations },
        { provide: TodoHistoryService, useValue: {} },
        { provide: LocalNotificationService, useValue: {} },
        { provide: ItemLockService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new ItemDetailComponent());
    component.item = { ...original };
    component.itemForm = createItemForm(TestBed.inject(FormBuilder), original);
  });

  it('persists changes made while an earlier save is pending', async () => {
    component.itemForm.get('title')?.setValue('First edit');
    component.itemForm.markAsDirty();
    component.saveElement();

    expect(itemService.updateItem).toHaveBeenCalledTimes(1);
    component.itemForm.get('title')?.setValue('Second edit');
    component.itemForm.markAsDirty();
    component.saveElement();
    expect(itemService.updateItem).toHaveBeenCalledTimes(1);
    expect(component.itemForm.dirty).toBeTrue();

    writes[0].next({ ...original, title: 'First edit' });
    writes[0].complete();
    await Promise.resolve();

    expect(itemService.updateItem).toHaveBeenCalledTimes(2);
    expect(component.itemForm.dirty).toBeTrue();

    writes[1].next({ ...original, title: 'Second edit' });
    writes[1].complete();
    await Promise.resolve();

    expect(component.itemForm.pristine).toBeTrue();
    expect(component.item?.title).toBe('Second edit');
    expect(saveState.updateFormSaveState).toHaveBeenCalledWith('saved');
  });

  it('keeps the form dirty if the save fails', async () => {
    component.itemForm.get('title')?.setValue('Unsent');
    component.itemForm.markAsDirty();
    component.saveElement();
    spyOn(console, 'error');

    writes[0].error(new Error('storage failed'));
    await Promise.resolve();

    expect(component.itemForm.dirty).toBeTrue();
    expect(component.saveState).toBe('error');
    expect(component.saveErrorMessage).not.toBeNull();
    expect(saveState.updateFormSaveState).toHaveBeenCalledWith('error');
  });
  it('waits for the pending write before allowing route deactivation', async () => {
    component.itemForm.get('title')?.setValue('Last edit');
    component.itemForm.markAsDirty();

    const exit = component.canDeactivate();

    expect(itemService.updateItem).toHaveBeenCalledTimes(1);

    writes[0].next({ ...original, title: 'Last edit' });
    writes[0].complete();

    expect(await exit).toBeTrue();
    expect(component.itemForm.pristine).toBeTrue();
  });

  it('blocks navigation after a save failure and permits retry', async () => {
    component.itemForm.get('title')?.setValue('Retained edit');
    component.itemForm.markAsDirty();
    spyOn(console, 'error');

    const firstExit = component.canDeactivate();
    writes[0].error(new Error('storage unavailable'));

    expect(await firstExit).toBeFalse();
    expect(component.itemForm.dirty).toBeTrue();
    expect(component.saveState).toBe('error');
    expect(component.saveErrorMessage).not.toBeNull();

    const retry = component.canDeactivate();
    writes[1].next({ ...original, title: 'Retained edit' });
    writes[1].complete();

    expect(await retry).toBeTrue();
    expect(component.saveState).toBe('saved');
  });

  it('does not recreate an item after confirmed deletion', async () => {
    component.itemForm.get('title')?.setValue('Unsaved draft');
    component.itemForm.markAsDirty();

    component.deleteItem();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(itemService.deleteItem).toHaveBeenCalledWith(original.id);
    expect(await component.canDeactivate()).toBeTrue();
    component.saveElement();

    expect(itemService.updateItem).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('does not navigate away from an unfinished subtask modal', async () => {
    component.isTodoEditModalVisible = true;
    expect(await component.canDeactivate()).toBeFalse();
  });

});
