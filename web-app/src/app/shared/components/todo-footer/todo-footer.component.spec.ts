import { Router } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { createDefaultBudget } from '../../models/budget/budget.model';
import { BudgetService } from '../../services/budget.service';
import { ItemsService } from '../../services/items.service';
import { SaveActionService } from '../../services/save-action.service';
import { TodoFooterComponent } from './todo-footer.component';

describe('TodoFooterComponent navigation', () => {
  let router: jasmine.SpyObj<Router>;

  function createFooter(initialUrl: string): TodoFooterComponent {
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: initialUrl, events: NEVER });
    router.navigate.and.resolveTo(true);

    const saveState = {
      save$: NEVER,
      formSaveState$: of('pristine'),
      todoProgress$: of(null),
    } as unknown as SaveActionService;

    const itemsService = {
      getAllActive: () => of([]),
    } as unknown as ItemsService;

    const budgetService = {
      get: () => of(createDefaultBudget()),
      budget$: of(createDefaultBudget()),
    } as unknown as BudgetService;

    return new TodoFooterComponent(router, saveState, itemsService, budgetService);
  }

  it('opens budget statistics from the budget chart', () => {
    const footer = createFooter('/budget?month=2024-09');

    footer.onBoardClick();

    expect(router.navigate).toHaveBeenCalledWith(['/budget-stats'], {
      queryParams: { month: '2024-09' },
    });
    footer.ngOnDestroy();
  });

  it('opens the task recap from the non-budget chart', () => {
    const footer = createFooter('/');

    footer.onBoardClick();

    expect(router.navigate).toHaveBeenCalledWith(['/recap']);
    footer.ngOnDestroy();
  });

  it('returns to the selected budget month from another budget screen', () => {
    const footer = createFooter('/budget-settings?month=2024-09');

    footer.goToBudget();

    expect(router.navigate).toHaveBeenCalledWith(['/budget'], {
      queryParams: { month: '2024-09' },
    });
    footer.ngOnDestroy();
  });

  it('does not navigate from the center indicator during item editing', () => {
    const footer = createFooter('/item/123');
    footer.showSaveIcon = true;

    footer.onBoardClick();

    expect(router.navigate).not.toHaveBeenCalled();
    footer.ngOnDestroy();
  });
});
