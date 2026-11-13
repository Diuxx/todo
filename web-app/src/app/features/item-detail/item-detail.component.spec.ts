import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
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
    itemService = jasmine.createSpyObj<ItemsService>('ItemsService', ['updateItem']);
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
      imports: [ItemDetailComponent],
      providers: [
        FormBuilder,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        { provide: Router, useValue: {} },
        { provide: ItemsService, useValue: itemService },
        { provide: SaveActionService, useValue: saveState },
        { provide: ConfirmDialogService, useValue: {} },
        { provide: TodoHistoryService, useValue: {} },
        { provide: LocalNotificationService, useValue: {} },
        { provide: ItemLockService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new ItemDetailComponent());
    component.item = { ...original };
    component.itemForm = createItemForm(TestBed.inject(FormBuilder), original);
  });

  it('persists changes made while an earlier save is pending', () => {
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

    expect(itemService.updateItem).toHaveBeenCalledTimes(2);
    expect(component.itemForm.dirty).toBeTrue();

    writes[1].next({ ...original, title: 'Second edit' });
    writes[1].complete();

    expect(component.itemForm.pristine).toBeTrue();
    expect(component.item?.title).toBe('Second edit');
    expect(saveState.updateFormSaveState).toHaveBeenCalledWith('saved');
  });

  it('keeps the form dirty if the save fails', () => {
    component.itemForm.get('title')?.setValue('Unsent');
    component.itemForm.markAsDirty();
    component.saveElement();
    spyOn(console, 'error');

    writes[0].error(new Error('storage failed'));

    expect(component.itemForm.dirty).toBeTrue();
    expect(saveState.updateFormSaveState).toHaveBeenCalledWith('dirty');
  });
  it('positions note actions and title above the flexible editor', () => {
    const fixture = TestBed.createComponent(ItemDetailComponent);
    const note = { ...original, title: 'Mail Montpellier', content: 'Note content' };

    // Reproduce the full-height note view at a desktop-sized viewport.
    fixture.nativeElement.style.cssText =
      'display:block; width:900px; height:700px; margin:0; padding:0; overflow:visible;';
    fixture.componentInstance.item = note;
    fixture.componentInstance.itemForm = createItemForm(TestBed.inject(FormBuilder), note);
    fixture.componentInstance.isLoading = false;
    fixture.componentInstance.hasCurrentAccess = true;
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.detail-card') as HTMLElement;
    const actions = fixture.nativeElement.querySelector('.detail-card-actions') as HTMLElement;
    const title = fixture.nativeElement.querySelector('.title-editable') as HTMLInputElement;
    const editor = fixture.nativeElement.querySelector('.detail-card-content') as HTMLTextAreaElement;

    expect(card).toBeTruthy();
    expect(actions.getBoundingClientRect().top - card.getBoundingClientRect().top)
      .toBeLessThan(70);
    expect(title.getBoundingClientRect().top - actions.getBoundingClientRect().bottom)
      .toBeLessThan(45);
    expect(editor.getBoundingClientRect().top - title.getBoundingClientRect().bottom)
      .toBeLessThan(45);
    expect(editor.getBoundingClientRect().height).toBeGreaterThan(250);

    fixture.destroy();
  });

});
