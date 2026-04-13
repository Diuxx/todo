import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RecurrenceType, TodoCriticality } from '../../../shared/models/base-entity.model';
import {
  TODO_CRITICALITY_VALUES,
  getTodoCriticalityLabel,
  normalizeTodoCriticality,
} from '../../../shared/utils/todo-config.utils';

@Component({
  standalone: true,
  selector: 'todo-edit-modal',
  templateUrl: './todo-edit-modal.component.html',
  styleUrls: ['./todo-edit-modal.component.scss'],
  imports: [ReactiveFormsModule, NgClass],
})
export class TodoEditModalComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() subItemForm?: FormGroup;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();

  public isDueDateVisible: boolean = false;

  public readonly recurrenceOptions: RecurrenceType[] = [
    'none',
    'daily',
    'weekly',
    'monthly',
    // 'custom', waiting for UI improvements to handle it properly
  ];

  public readonly criticalityOptions: TodoCriticality[] = [...TODO_CRITICALITY_VALUES];

  public readonly customWeekdayOptions: Array<{ label: string; value: number }> = [
    { label: 'L', value: 1 },
    { label: 'M', value: 2 },
    { label: 'M', value: 3 },
    { label: 'J', value: 4 },
    { label: 'V', value: 5 },
    { label: 'S', value: 6 },
    { label: 'D', value: 0 },
  ];

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['subItemForm']) {
      return;
    }

    this.isDueDateVisible = !!`${this.subItemForm?.get('dueDate')?.value ?? ''}`.trim();
  }

  public selectCriticality(criticality: TodoCriticality): void {
    this.subItemForm?.get('criticality')?.setValue(criticality);
    this.subItemForm?.markAllAsDirty();
  }

  public isCriticalitySelected(criticality: TodoCriticality): boolean {
    return normalizeTodoCriticality(this.subItemForm?.get('criticality')?.value) === criticality;
  }

  public getSelectedCriticalityLabel(): string {
    return getTodoCriticalityLabel(this.subItemForm?.get('criticality')?.value);
  }

  public revealDueDate(): void {
    this.isDueDateVisible = true;
    this.subItemForm?.markAllAsDirty();
  }

  public clearDueDate(): void {
    this.subItemForm?.get('dueDate')?.setValue('');
    this.subItemForm?.markAllAsDirty();
    this.isDueDateVisible = false;
  }

  public selectRecurrence(type: RecurrenceType): void {
    this.subItemForm?.get('recurrenceType')?.setValue(type);

    if (type === 'custom') {
      this.ensureCustomRule();
    }

    this.subItemForm?.markAllAsDirty();
  }

  public isCustomWeekdaySelected(day: number): boolean {
    return this.parseCustomWeekdays().includes(day);
  }

  public toggleCustomWeekday(day: number): void {
    const selected = this.parseCustomWeekdays();
    const alreadySelected = selected.includes(day);
    const next = alreadySelected ? selected.filter((item) => item !== day) : [...selected, day];
    const rule = this.buildCustomRule(next);

    this.subItemForm?.get('recurrenceRule')?.setValue(rule);
    this.subItemForm?.markAllAsDirty();
  }

  public toggleAlert(): void {
    this.subItemForm?.markAllAsDirty();
    const alertEnabledControl = this.subItemForm?.get('alertEnabled');
    if (!alertEnabledControl) {
      return;
    }

    const nextValue = !alertEnabledControl.value;
    alertEnabledControl.setValue(nextValue);

    if (!nextValue) {
      this.subItemForm?.get('alertAt')?.setValue('');
    }
  }

  public closeModal(): void {
    this.close.emit();
  }

  public saveModal(): void {
    this.save.emit();
  }

  private ensureCustomRule(): void {
    const ruleControl = this.subItemForm?.get('recurrenceRule');
    const currentRule = `${ruleControl?.value ?? ''}`.trim();

    if (currentRule.startsWith('custom:') && currentRule.split(/\s+/).length >= 5) {
      return;
    }

    if (currentRule.split(/\s+/).length >= 5) {
      return;
    }

    ruleControl?.setValue(this.buildCustomRule([1, 2, 3, 4, 5]));
  }

  private parseCustomWeekdays(): number[] {
    const rawRule = `${this.subItemForm?.get('recurrenceRule')?.value ?? ''}`.trim();
    const expression = rawRule.startsWith('custom:') ? rawRule.slice(7).trim() : rawRule;
    const fields = expression.split(/\s+/);

    if (fields.length !== 5) {
      return [];
    }

    const dayField = fields[4].trim();

    if (dayField === '*') {
      return [1, 2, 3, 4, 5, 6, 0];
    }

    const values: number[] = [];

    for (const rawPart of dayField.split(',')) {
      const part = rawPart.trim();

      if (!part) {
        continue;
      }

      if (part.includes('/')) {
        const [base, stepText] = part.split('/');
        const step = Number.parseInt(stepText, 10);

        if (!Number.isFinite(step) || step <= 0) {
          continue;
        }

        if (base === '*') {
          for (let value = 0; value <= 6; value += step) {
            values.push(value);
          }
          continue;
        }

        if (!base.includes('-')) {
          continue;
        }

        const [startText, endText] = base.split('-');
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          continue;
        }

        const normalizedStart = start === 7 ? 0 : start;
        const normalizedEnd = end === 7 ? 0 : end;

        for (let value = normalizedStart; value <= normalizedEnd; value += step) {
          if (value >= 0 && value <= 6) {
            values.push(value);
          }
        }

        continue;
      }

      if (part.includes('-')) {
        const [startText, endText] = part.split('-');
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          continue;
        }

        const normalizedStart = start === 7 ? 0 : start;
        const normalizedEnd = end === 7 ? 0 : end;

        for (let value = normalizedStart; value <= normalizedEnd; value++) {
          if (value >= 0 && value <= 6) {
            values.push(value);
          }
        }

        continue;
      }

      const parsedValue = Number.parseInt(part, 10);

      if (!Number.isFinite(parsedValue)) {
        continue;
      }

      const normalizedValue = parsedValue === 7 ? 0 : parsedValue;

      if (normalizedValue >= 0 && normalizedValue <= 6) {
        values.push(normalizedValue);
      }
    }

    return [...new Set(values)];
  }

  private buildCustomRule(days: number[]): string {
    const selected = [...new Set(days)].filter((day) => day >= 0 && day <= 6);
    const dayOrder = [1, 2, 3, 4, 5, 6, 0];
    const orderedDays = dayOrder.filter((day) => selected.includes(day));

    // Keep an explicit "no day" marker so UI does not bounce back to all selected.
    const dayField = orderedDays.length > 0 ? orderedDays.join(',') : '-';
    const { minute, hour } = this.resolveCustomTime();

    return `${minute} ${hour} * * ${dayField}`;
  }

  private resolveCustomTime(): { minute: number; hour: number } {
    const alertAt = `${this.subItemForm?.get('alertAt')?.value ?? ''}`.trim();
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(alertAt);

    if (timeMatch) {
      const hour = Number.parseInt(timeMatch[1], 10);
      const minute = Number.parseInt(timeMatch[2], 10);

      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { minute, hour };
      }
    }

    const rawRule = `${this.subItemForm?.get('recurrenceRule')?.value ?? ''}`.trim();
    const expression = rawRule.startsWith('custom:') ? rawRule.slice(7).trim() : rawRule;
    const fields = expression.split(/\s+/);

    if (fields.length === 5) {
      const minute = Number.parseInt(fields[0], 10);
      const hour = Number.parseInt(fields[1], 10);

      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return { minute, hour };
      }
    }

    return { minute: 0, hour: 9 };
  }
}
