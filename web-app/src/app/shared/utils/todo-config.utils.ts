import { TodoCriticality } from '../models/base-entity.model';

export const TODO_CRITICALITY_VALUES: readonly TodoCriticality[] = ['h', 'm', 'l'];

export function normalizeTodoCriticality(value: unknown): TodoCriticality {
  if (value === 'h' || value === 'm' || value === 'l') {
    return value;
  }

  return 'l';
}

export function normalizeTodoGoalCount(value: unknown): number {
  const parsedValue = Number.parseInt(`${value ?? ''}`, 10);

  if (Number.isFinite(parsedValue) && parsedValue >= 1) {
    return parsedValue;
  }

  return 1;
}

export function normalizeTodoDueDate(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmedValue) ? trimmedValue : undefined;
}

export function getTodoCriticalityLabel(value: unknown): string {
  const criticality = normalizeTodoCriticality(value);

  if (criticality === 'h') {
    return 'High';
  }

  if (criticality === 'm') {
    return 'Medium';
  }

  return 'Light';
}

export function getTodoCriticalityRank(value: unknown): number {
  const criticality = normalizeTodoCriticality(value);

  if (criticality === 'h') {
    return 0;
  }

  if (criticality === 'm') {
    return 1;
  }

  return 2;
}

export function formatTodoDueDate(value: unknown, locale: string = 'fr-FR'): string {
  const dueDate = normalizeTodoDueDate(value);

  if (!dueDate) {
    return '';
  }

  const parsedDate = new Date(`${dueDate}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dueDate;
  }

  return parsedDate.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}