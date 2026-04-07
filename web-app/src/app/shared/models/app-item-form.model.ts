import { FormArray, FormBuilder, FormGroup } from "@angular/forms";
import { AppItem, TodoInformation } from "./app-item.model";

export function createItemForm(formBuilder: FormBuilder, item?: AppItem): FormGroup {
  if (!item) {
    return formBuilder.group({
      title: [''],
      isFavorite: [false],
      content: [''],
      todoContent: formBuilder.array([]),
    });
  }

  const todoContentArray = formBuilder.array(
    (item.todoContent ?? []).map((subItem) => createTodoSubItemGroup(formBuilder, subItem))
  );

  return formBuilder.group({
    title: [item.title ?? ''],
    isFavorite: [item.isFavorite ?? false],
    content: [item.content ?? ''],
    todoContent: todoContentArray,
  });
}

export function getTodoContentFormArray(itemForm: FormGroup): FormArray {
  return itemForm.get('todoContent') as FormArray;
}

export function getTodoSubItemFormGroups(itemForm: FormGroup): FormGroup[] {
  return getTodoContentFormArray(itemForm).controls as FormGroup[];
}

export function mapItemFormToAppItem(itemForm: FormGroup, sourceItem: AppItem): AppItem {
  const formValue = itemForm.getRawValue();

  const todoContent: TodoInformation[] = (formValue.todoContent ?? []).map((subItem: any) => ({
    id: subItem.id,
    createdAt: sourceItem.todoContent?.find((existing) => existing.id === subItem.id)?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: subItem.title,
    config: {
      recurrenceType: subItem.recurrenceType,
      alertEnabled: !!subItem.alertEnabled,
      alertAt: subItem.alertEnabled ? subItem.alertAt || undefined : undefined,
      recurrenceRule: subItem.recurrenceRule || undefined,
      lastCompletedAt: subItem.lastCompletedAt || undefined,
      nextDueAt: subItem.nextDueAt || undefined,
    },
  }));

  return {
    ...sourceItem,
    title: formValue.title,
    isFavorite: !!formValue.isFavorite,
    content: sourceItem.type === 'todo' ? sourceItem.content : formValue.content,
    todoContent: sourceItem.type === 'todo' ? todoContent : sourceItem.todoContent,
  };
}

function createTodoSubItemGroup(formBuilder: FormBuilder, subItem: TodoInformation): FormGroup {
  return formBuilder.group({
    id: [subItem.id],
    title: [subItem.title ?? ''],
    isDone: [subItem.isDone ?? false],
    recurrenceType: [subItem.config?.recurrenceType ?? 'none'],
    alertEnabled: [subItem.config?.alertEnabled ?? false],
    alertAt: [subItem.config?.alertAt ?? ''],
    recurrenceRule: [subItem.config?.recurrenceRule ?? ''],
    lastCompletedAt: [subItem.config?.lastCompletedAt ?? ''],
    nextDueAt: [subItem.config?.nextDueAt ?? ''],
  });
}
