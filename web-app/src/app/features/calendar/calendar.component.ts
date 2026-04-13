import { DatePipe, NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AppItem, TodoInformation } from '../../shared/models/app-item.model';
import { RecurrenceType, TodoCriticality } from '../../shared/models/base-entity.model';
import { ItemsService } from '../../shared/services/items.service';
import { TodoHistoryService } from '../../shared/services/todo-history.service';
import { TodoHistoryEntry } from '../../shared/models/todo-history.model';
import {
  getTodoCriticalityRank,
  normalizeTodoCriticality,
  normalizeTodoDueDate,
} from '../../shared/utils/todo-config.utils';

type CalendarViewMode = 'day' | 'week' | 'month';

type DayCell = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  itemsCount: number;
};

type ScheduledTodo = {
  itemId: string;
  itemTitle: string;
  subItemId: string;
  subItemTitle: string;
  criticality: TodoCriticality;
  reminderAt: Date | null;
  recurrenceType: RecurrenceType;
  recurrenceRule?: string;
  baseDate: Date;
};

type CalendarTodoOccurrence = ScheduledTodo & {
  isDoneForDate: boolean;
};

@Component({
  standalone: true,
  selector: 'todo-calendar',
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss'],
  imports: [NgClass, DatePipe],
})
export class CalendarComponent implements OnInit {
  private readonly itemsService = inject(ItemsService);
  private readonly todoHistoryService = inject(TodoHistoryService);
  private readonly router = inject(Router);
  public readonly today = new Date();

  public readonly viewModes: CalendarViewMode[] = ['day', 'week', 'month'];
  public viewMode: CalendarViewMode = 'day';
  public anchorDate = this.startOfDay(new Date());

  public isLoading = true;
  public items: AppItem[] = [];
  private scheduledTodos: ScheduledTodo[] = [];
  private doneHistoryBySubItem = new Map<string, number[]>();
  private historyWindowStart = Number.NaN;
  private historyWindowEnd = Number.NaN;
  private historyLoadToken = 0;

  public ngOnInit(): void {
    this.itemsService.getAll(null, true).subscribe({
      next: (items) => {
        this.items = items;
        this.scheduledTodos = this.extractScheduledTodos(items);
        this.reloadDoneHistoryForVisiblePeriod(true);
      },
      error: () => {
        this.items = [];
        this.doneHistoryBySubItem = new Map();
        this.scheduledTodos = [];
        this.isLoading = false;
      },
    });
  }

  public setViewMode(mode: CalendarViewMode): void {
    this.viewMode = mode;
    this.reloadDoneHistoryForVisiblePeriod();
  }

  public goToToday(): void {
    this.anchorDate = this.startOfDay(new Date());
    this.reloadDoneHistoryForVisiblePeriod();
  }

  public goToPrevious(): void {
    if (this.viewMode === 'day') {
      this.anchorDate = this.addDays(this.anchorDate, -1);
      this.reloadDoneHistoryForVisiblePeriod();
      return;
    }

    if (this.viewMode === 'week') {
      this.anchorDate = this.addDays(this.anchorDate, -7);
      this.reloadDoneHistoryForVisiblePeriod();
      return;
    }

    this.anchorDate = new Date(this.anchorDate.getFullYear(), this.anchorDate.getMonth() - 1, 1);
    this.reloadDoneHistoryForVisiblePeriod();
  }

  public goToNext(): void {
    if (this.viewMode === 'day') {
      this.anchorDate = this.addDays(this.anchorDate, 1);
      this.reloadDoneHistoryForVisiblePeriod();
      return;
    }

    if (this.viewMode === 'week') {
      this.anchorDate = this.addDays(this.anchorDate, 7);
      this.reloadDoneHistoryForVisiblePeriod();
      return;
    }

    this.anchorDate = new Date(this.anchorDate.getFullYear(), this.anchorDate.getMonth() + 1, 1);
    this.reloadDoneHistoryForVisiblePeriod();
  }

  public selectDate(date: Date): void {
    this.anchorDate = this.startOfDay(date);
    this.reloadDoneHistoryForVisiblePeriod();
  }

  public get periodLabel(): string {
    if (this.viewMode === 'day') {
      return this.anchorDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    if (this.viewMode === 'week') {
      const start = this.getWeekStart(this.anchorDate);
      const end = this.addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();

      const startLabel = start.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: sameMonth ? undefined : 'short',
      });
      const endLabel = end.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      return `${startLabel} - ${endLabel}`;
    }

    return this.anchorDate.toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }

  public get weekDays(): Date[] {
    const weekStart = this.getWeekStart(this.anchorDate);
    return Array.from({ length: 7 }, (_, index) => this.addDays(weekStart, index));
  }

  public get monthGrid(): DayCell[] {
    const monthStart = new Date(this.anchorDate.getFullYear(), this.anchorDate.getMonth(), 1);
    const firstWeekStart = this.getWeekStart(monthStart);

    return Array.from({ length: 42 }, (_, index) => {
      const date = this.addDays(firstWeekStart, index);
      return {
        date,
        inCurrentMonth: date.getMonth() === this.anchorDate.getMonth(),
        isToday: this.isSameDay(date, new Date()),
        isSelected: this.isSameDay(date, this.anchorDate),
        itemsCount: this.getTodosForDate(date).length,
      };
    });
  }

  public get dayTodos(): CalendarTodoOccurrence[] {
    return this.getTodosForDate(this.anchorDate);
  }

  public getTodosForDate(date: Date): CalendarTodoOccurrence[] {
    return this.scheduledTodos
      .filter((todo) => this.occursOnDate(todo, date))
      .map((todo) => ({
        ...todo,
        isDoneForDate: this.isDoneForDate(todo, date),
      }))
      .sort((a, b) => {
        const criticalityDelta = getTodoCriticalityRank(a.criticality) - getTodoCriticalityRank(b.criticality);

        if (criticalityDelta !== 0) {
          return criticalityDelta;
        }

        if (!a.reminderAt && !b.reminderAt) {
          return a.subItemTitle.localeCompare(b.subItemTitle, 'fr');
        }

        if (!a.reminderAt) {
          return 1;
        }

        if (!b.reminderAt) {
          return -1;
        }

        return a.reminderAt.getTime() - b.reminderAt.getTime();
      });
  }

  public getWeekDayTodos(date: Date): CalendarTodoOccurrence[] {
    return this.getTodosForDate(date);
  }

  public getDayStats(date: Date): { total: number; done: number } {
    const todos = this.getTodosForDate(date);
    const done = todos.filter((todo) => todo.isDoneForDate).length;
    return {
      total: todos.length,
      done,
    };
  }

  public isToday(date: Date): boolean {
    return this.isSameDay(date, this.today);
  }

  public getTodoDisplayTitle(todo: ScheduledTodo): string {
    return `${todo.itemTitle} - ${todo.subItemTitle}`;
  }

  public getReminderTime(todo: ScheduledTodo): string {
    if (!todo.reminderAt) {
      return '';
    }

    return todo.reminderAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  public openTodo(todo: ScheduledTodo): void {
    this.router.navigate(['/item', todo.itemId]);
  }

  private getWeekStart(date: Date): Date {
    const normalized = this.startOfDay(date);
    const currentDay = normalized.getDay();
    const offset = currentDay === 0 ? -6 : 1 - currentDay;
    return this.addDays(normalized, offset);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private extractScheduledTodos(items: AppItem[]): ScheduledTodo[] {
    const todos: ScheduledTodo[] = [];

    for (const item of items) {
      if (item.type !== 'todo' || !item.todoContent?.length) {
        continue;
      }

      const itemTitle = item.title?.trim() || 'Todo';

      for (const subItem of item.todoContent) {
        const recurrenceType = this.getRecurrenceType(subItem);
        const hasRecurrence = recurrenceType !== 'none';
        const dueDate = this.getDueDate(subItem);
        const reminderAt = this.resolveReminderDate(item, subItem);
        const baseDate = this.resolveBaseDate(item, subItem) ?? this.startOfDay(new Date());

        if (!hasRecurrence && !reminderAt && !dueDate) {
          continue;
        }

        todos.push({
          itemId: item.id,
          itemTitle,
          subItemId: subItem.id,
          subItemTitle: subItem.title?.trim() || 'Sous-tâche',
          criticality: normalizeTodoCriticality(subItem.config?.criticality),
          reminderAt,
          recurrenceType,
          recurrenceRule: this.getRecurrenceRule(subItem),
          baseDate,
        });
      }
    }

    return todos;
  }

  private resolveBaseDate(item: AppItem, subItem: TodoInformation): Date | null {
    const dueDate = this.getDueDate(subItem);
    const baseDateSource = dueDate || this.getNextDueAt(subItem) || item.updatedAt || item.createdAt;
    const parsedSource = dueDate ? `${dueDate}T00:00:00` : baseDateSource;
    const baseDate = new Date(parsedSource);

    if (Number.isNaN(baseDate.getTime())) {
      return null;
    }

    return this.startOfDay(baseDate);
  }

  private resolveReminderDate(item: AppItem, subItem: TodoInformation): Date | null {
    const alertEnabled = this.getAlertEnabled(subItem);
    const alertAt = this.getAlertAt(subItem);

    if (!alertEnabled || !alertAt) {
      return null;
    }

    const baseDate = this.resolveBaseDate(item, subItem);

    if (!baseDate) {
      return null;
    }

    const [hourText, minuteText] = alertAt.split(':');
    const hours = Number.parseInt(hourText, 10);
    const minutes = Number.parseInt(minuteText, 10);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      hours,
      minutes,
      0,
      0
    );
  }

  private occursOnDate(todo: ScheduledTodo, date: Date): boolean {
    if (todo.recurrenceType === 'none' && date.getTime() < todo.baseDate.getTime()) {
      return false;
    }

    if (todo.recurrenceType === 'daily') {
      return true;
    }

    if (todo.recurrenceType === 'weekly') {
      const weekdays = this.parseWeeklyRule(todo.recurrenceRule);
      const currentDay = date.getDay();

      if (weekdays.length === 0) {
        return currentDay === todo.baseDate.getDay();
      }

      return weekdays.includes(currentDay);
    }

    if (todo.recurrenceType === 'monthly') {
      const dayOfMonth = this.parseMonthlyRule(todo.recurrenceRule) ?? todo.baseDate.getDate();
      return date.getDate() === dayOfMonth;
    }

    if (todo.recurrenceType === 'none') {
      return this.isSameDay(todo.baseDate, date);
    }

    if (todo.recurrenceType === 'custom') {
      return this.matchesCustomRule(date, todo.recurrenceRule, todo.baseDate);
    }

    return this.isSameDay(todo.baseDate, date);
  }

  private isDoneForDate(todo: ScheduledTodo, date: Date): boolean {
    const doneTimestamps = this.doneHistoryBySubItem.get(todo.subItemId);

    if (!doneTimestamps?.length) {
      return false;
    }

    if (todo.recurrenceType === 'daily') {
      const [start, end] = this.getDailyBounds(date);
      return doneTimestamps.some((timestamp) => timestamp >= start && timestamp < end);
    }

    if (todo.recurrenceType === 'weekly') {
      const [start, end] = this.getWeeklyBounds(date);
      return doneTimestamps.some((timestamp) => timestamp >= start && timestamp < end);
    }

    if (todo.recurrenceType === 'monthly') {
      const [start, end] = this.getMonthlyBounds(date);
      return doneTimestamps.some((timestamp) => timestamp >= start && timestamp < end);
    }

    return doneTimestamps.length > 0;
  }

  private groupDoneHistoryBySubItem(history: TodoHistoryEntry[]): Map<string, number[]> {
    const bySubItem = new Map<string, number[]>();

    for (const entry of history) {
      if (entry.status !== 'done' || !entry.completedAt) {
        continue;
      }

      const timestamp = new Date(entry.completedAt).getTime();

      if (!Number.isFinite(timestamp)) {
        continue;
      }

      const existing = bySubItem.get(entry.todoItemId);

      if (existing) {
        existing.push(timestamp);
        continue;
      }

      bySubItem.set(entry.todoItemId, [timestamp]);
    }

    return bySubItem;
  }

  private parseWeeklyRule(rule?: string): number[] {
    const rawValue = rule?.split(':')[1]?.trim().toLowerCase();

    if (!rawValue) {
      return [];
    }

    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      dimanche: 0,
      lundi: 1,
      mardi: 2,
      mercredi: 3,
      jeudi: 4,
      vendredi: 5,
      samedi: 6,
    };

    return rawValue
      .split(',')
      .map((day) => day.trim())
      .map((day) => dayMap[day])
      .filter((day): day is number => day !== undefined);
  }

  private parseMonthlyRule(rule?: string): number | undefined {
    const rawValue = rule?.split(':')[1]?.trim();

    if (!rawValue) {
      return undefined;
    }

    const day = Number.parseInt(rawValue, 10);

    if (!Number.isFinite(day) || day < 1 || day > 31) {
      return undefined;
    }

    return day;
  }

  private getDailyBounds(date: Date): [number, number] {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = this.addDays(start, 1);
    return [start.getTime(), end.getTime()];
  }

  private getWeeklyBounds(date: Date): [number, number] {
    const start = this.getWeekStart(date);
    const end = this.addDays(start, 7);
    return [start.getTime(), end.getTime()];
  }

  private getMonthlyBounds(date: Date): [number, number] {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return [start.getTime(), end.getTime()];
  }

  private getRecurrenceType(subItem: TodoInformation): RecurrenceType {
    const configType = subItem.config?.recurrenceType;

    if (this.isRecurrenceType(configType)) {
      return configType;
    }

    const legacyType = (subItem as { recurrenceType?: unknown }).recurrenceType;

    if (this.isRecurrenceType(legacyType)) {
      return legacyType;
    }

    const rule = this.getRecurrenceRule(subItem);

    if (rule === 'daily') {
      return 'daily';
    }

    if (rule?.startsWith('weekly:')) {
      return 'weekly';
    }

    if (rule?.startsWith('monthly:')) {
      return 'monthly';
    }

    if (rule?.startsWith('custom:')) {
      return 'custom';
    }

    return 'none';
  }

  private getRecurrenceRule(subItem: TodoInformation): string | undefined {
    return (
      subItem.config?.recurrenceRule ||
      (subItem as { recurrenceRule?: string }).recurrenceRule ||
      undefined
    );
  }

  private getAlertEnabled(subItem: TodoInformation): boolean {
    const legacyValue = (subItem as { alertEnabled?: unknown }).alertEnabled;

    if (typeof subItem.config?.alertEnabled === 'boolean') {
      return subItem.config.alertEnabled;
    }

    return legacyValue === true;
  }

  private getAlertAt(subItem: TodoInformation): string | undefined {
    return subItem.config?.alertAt || (subItem as { alertAt?: string }).alertAt || undefined;
  }

  private getNextDueAt(subItem: TodoInformation): string | undefined {
    return subItem.config?.nextDueAt || (subItem as { nextDueAt?: string }).nextDueAt || undefined;
  }

  private getDueDate(subItem: TodoInformation): string | undefined {
    return normalizeTodoDueDate(
      subItem.config?.dueDate || (subItem as { dueDate?: string }).dueDate || undefined
    );
  }

  private isRecurrenceType(value: unknown): value is RecurrenceType {
    return (
      value === 'none' ||
      value === 'daily' ||
      value === 'weekly' ||
      value === 'monthly' ||
      value === 'custom'
    );
  }

  private matchesCustomRule(date: Date, rawRule: string | undefined, baseDate: Date): boolean {
    if (date.getTime() < baseDate.getTime()) {
      return false;
    }

    const ruleText = rawRule?.trim();

    if (!ruleText) {
      return false;
    }

    const expression = ruleText.startsWith('custom:') ? ruleText.slice(7).trim() : ruleText;
    const fields = expression.split(/\s+/);

    if (fields.length !== 5) {
      return false;
    }

    const [, , dayOfMonthField, monthField, dayOfWeekField] = fields;

    const month = date.getMonth() + 1;
    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();

    const monthMatches = this.matchesCronField(monthField, month, 1, 12);
    if (!monthMatches) {
      return false;
    }

    const dayOfMonthMatches = this.matchesCronField(dayOfMonthField, dayOfMonth, 1, 31);
    const dayOfWeekMatches = this.matchesCronDayOfWeekField(dayOfWeekField, dayOfWeek);

    const dayOfMonthIsWildcard = dayOfMonthField.trim() === '*';
    const dayOfWeekIsWildcard = dayOfWeekField.trim() === '*';

    if (dayOfMonthIsWildcard && dayOfWeekIsWildcard) {
      return true;
    }

    if (dayOfMonthIsWildcard) {
      return dayOfWeekMatches;
    }

    if (dayOfWeekIsWildcard) {
      return dayOfMonthMatches;
    }

    return dayOfMonthMatches || dayOfWeekMatches;
  }

  private matchesCronDayOfWeekField(field: string, value: number): boolean {
    const normalizedField = field
      .toLowerCase()
      .replace(/\bsun\b/g, '0')
      .replace(/\bmon\b/g, '1')
      .replace(/\btue\b/g, '2')
      .replace(/\bwed\b/g, '3')
      .replace(/\bthu\b/g, '4')
      .replace(/\bfri\b/g, '5')
      .replace(/\bsat\b/g, '6');

    if (normalizedField.trim() === '*') {
      return true;
    }

    return normalizedField.split(',').some((part) => {
      const entry = part.trim();

      if (!entry) {
        return false;
      }

      if (entry.includes('/')) {
        const [base, stepText] = entry.split('/');
        const step = Number.parseInt(stepText, 10);

        if (!Number.isFinite(step) || step <= 0) {
          return false;
        }

        if (base === '*') {
          return value % step === 0;
        }

        const [startText, endText] = base.split('-');
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText ?? startText, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          return false;
        }

        const normalizedStart = start === 7 ? 0 : start;
        const normalizedEnd = end === 7 ? 0 : end;

        if (normalizedStart > normalizedEnd) {
          return false;
        }

        if (value < normalizedStart || value > normalizedEnd) {
          return false;
        }

        return (value - normalizedStart) % step === 0;
      }

      if (entry.includes('-')) {
        const [startText, endText] = entry.split('-');
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          return false;
        }

        const normalizedStart = start === 7 ? 0 : start;
        const normalizedEnd = end === 7 ? 0 : end;

        if (normalizedStart > normalizedEnd) {
          return false;
        }

        return value >= normalizedStart && value <= normalizedEnd;
      }

      const numericValue = Number.parseInt(entry, 10);

      if (!Number.isFinite(numericValue)) {
        return false;
      }

      return value === (numericValue === 7 ? 0 : numericValue);
    });
  }

  private matchesCronField(field: string, value: number, min: number, max: number): boolean {
    const normalized = field.trim();

    if (normalized === '*') {
      return true;
    }

    return normalized.split(',').some((part) => {
      const entry = part.trim();

      if (!entry) {
        return false;
      }

      if (entry.includes('/')) {
        const [base, stepText] = entry.split('/');
        const step = Number.parseInt(stepText, 10);

        if (!Number.isFinite(step) || step <= 0) {
          return false;
        }

        if (base === '*') {
          return value >= min && value <= max && (value - min) % step === 0;
        }

        if (!base.includes('-')) {
          return false;
        }

        const [startText, endText] = base.split('-');
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          return false;
        }

        if (value < start || value > end) {
          return false;
        }

        return (value - start) % step === 0;
      }

      if (entry.includes('-')) {
        const [startText, endText] = entry.split('-');
        const start = Number.parseInt(startText, 10);
        const end = Number.parseInt(endText, 10);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
          return false;
        }

        return value >= start && value <= end;
      }

      const numericValue = Number.parseInt(entry, 10);
      return Number.isFinite(numericValue) && value === numericValue;
    });
  }

  private reloadDoneHistoryForVisiblePeriod(showBlockingLoader: boolean = false): void {
    const [start, end] = this.getVisibleBounds();

    if (start === this.historyWindowStart && end === this.historyWindowEnd) {
      if (showBlockingLoader) {
        this.isLoading = false;
      }
      return;
    }

    const token = ++this.historyLoadToken;

    if (showBlockingLoader) {
      this.isLoading = true;
    }

    this.todoHistoryService.getDoneInRange(new Date(start).toISOString(), new Date(end).toISOString()).subscribe({
      next: (history) => {
        if (token !== this.historyLoadToken) {
          return;
        }

        this.doneHistoryBySubItem = this.groupDoneHistoryBySubItem(history);
        this.historyWindowStart = start;
        this.historyWindowEnd = end;
        this.isLoading = false;
      },
      error: () => {
        if (token !== this.historyLoadToken) {
          return;
        }

        this.doneHistoryBySubItem = new Map();
        this.historyWindowStart = start;
        this.historyWindowEnd = end;
        this.isLoading = false;
      },
    });
  }

  private getVisibleBounds(): [number, number] {
    if (this.viewMode === 'day') {
      return this.getDailyBounds(this.anchorDate);
    }

    if (this.viewMode === 'week') {
      return this.getWeeklyBounds(this.anchorDate);
    }

    return this.getMonthlyBounds(this.anchorDate);
  }
}
