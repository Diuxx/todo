import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { createDefaultBudget } from '../../shared/models/budget/budget.model';
import { BudgetService } from '../../shared/services/budget.service';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { BudgetSettingsComponent } from './budget-settings/budget-settings.component';
import { BudgetStatsComponent } from './budget-stats/budget-stats.component';
import { BudgetComponent } from './budget.component';

describe('Budget navigation consistency', () => {
  let router: jasmine.SpyObj<Router>;
  let budgetService: jasmine.SpyObj<BudgetService>;
  let route: ActivatedRoute;
  let confirmation: jasmine.SpyObj<ConfirmDialogService>;

  function configure(month: string): void {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    budgetService = jasmine.createSpyObj<BudgetService>('BudgetService', ['get', 'getPeriod', 'upsertIncome', 'upsertAccount']);
    confirmation = jasmine.createSpyObj<ConfirmDialogService>('ConfirmDialogService', ['confirm']);
    confirmation.confirm.and.returnValue(of(false));
    budgetService.get.and.returnValue(of(createDefaultBudget()));
    budgetService.getPeriod.and.returnValue(of(undefined));
    route = {
      snapshot: { queryParamMap: convertToParamMap({ month }) },
    } as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: route },
        { provide: BudgetService, useValue: budgetService },
        { provide: ConfirmDialogService, useValue: confirmation },
      ],
    });
  }

  it('updates the URL when moving to a different budget month', () => {
    configure('2025-01');
    const component = TestBed.runInInjectionContext(() => new BudgetComponent());
    component.activeMonth = new Date(2025, 0, 1);

    component.goToPreviousMonth();

    expect(component.activeMonthKey).toBe('2024-12');
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: route,
      queryParams: { month: '2024-12' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    expect(budgetService.getPeriod).toHaveBeenCalledWith('2024-12');
  });

  it('passes the selected month to administration and statistics', () => {
    configure('2024-09');
    const component = TestBed.runInInjectionContext(() => new BudgetComponent());
    component.activeMonth = new Date(2024, 8, 1);

    component.goToBudgetSettings();
    component.goToBudgetStats();

    expect(router.navigate).toHaveBeenCalledWith(['/budget-settings'], {
      queryParams: { month: '2024-09' },
    });
    expect(router.navigate).toHaveBeenCalledWith(['/budget-stats'], {
      queryParams: { month: '2024-09' },
    });
  });

  it('restores the originating month when returning from budget administration', () => {
    configure('2023-04');
    const component = TestBed.runInInjectionContext(() => new BudgetSettingsComponent());

    component.ngOnInit();
    component.goToBudget();

    expect(component.calendarYear).toBe(2023);
    expect(router.navigate).toHaveBeenCalledWith(['/budget'], {
      queryParams: { month: '2023-04' },
    });
  });

  it('opens statistics for the originating budget year', () => {
    configure('2022-11');
    const component = TestBed.runInInjectionContext(() => new BudgetStatsComponent());

    component.ngOnInit();

    expect(component.selectedYear).toBe(2022);
    component.ngOnDestroy();
  });
  it('asks before discarding an open budget transaction form', async () => {
    configure('2026-11');
    const component = TestBed.runInInjectionContext(() => new BudgetComponent());
    component.isIncomeModalVisible = true;

    expect(await component.canDeactivate()).toBeFalse();
    expect(confirmation.confirm).toHaveBeenCalled();
  });

  it('protects unsaved budget administration fields', async () => {
    configure('2026-11');
    const component = TestBed.runInInjectionContext(() => new BudgetSettingsComponent());
    component.budget = createDefaultBudget();
    component.accountFormName = 'Not yet saved';

    expect(component.hasUnsavedBudgetEdits).toBeTrue();
    expect(await component.canDeactivate()).toBeFalse();
    expect(confirmation.confirm).toHaveBeenCalled();
  });

  it('surfaces a failed budget write without leaving a stuck loading state', () => {
    configure('2026-11');
    budgetService.upsertIncome.and.returnValue(throwError(() => new Error('Storage error')));
    const component = TestBed.runInInjectionContext(() => new BudgetComponent());
    component.budget = createDefaultBudget();
    component.currentPeriod = null;
    spyOn(console, 'error');

    component.createFirstEntry();

    expect(component.isSaving).toBeFalse();
    expect(component.saveState).toBe('error');
    expect(component.saveErrorMessage).not.toBeNull();
  });

  it('surfaces errors when editing budget administration lists', () => {
    configure('2026-11');
    budgetService.upsertAccount.and.returnValue(throwError(() => new Error('Storage error')));
    const component = TestBed.runInInjectionContext(() => new BudgetSettingsComponent());
    component.budget = createDefaultBudget();
    component.accountFormName = 'Another account';
    spyOn(console, 'error');

    component.addAccount();

    expect(component.isSaving).toBeFalse();
    expect(component.saveState).toBe('error');
    expect(component.saveErrorMessage).not.toBeNull();
  });

});
