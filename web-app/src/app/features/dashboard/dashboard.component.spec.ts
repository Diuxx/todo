import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { AppItem } from '../../shared/models/app-item.model';
import { ItemLockService } from '../../shared/services/item-lock.service';
import { ItemsService } from '../../shared/services/items.service';
import { SettingsService } from '../../shared/services/settings.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent visible items', () => {
  let component: DashboardComponent;

  function createItem(id: string, fromCalendar: boolean): AppItem {
    return {
      id,
      type: 'note',
      title: 'Example',
      color: 'default',
      visibility: 'private',
      isArchived: false,
      isFavorite: false,
      isLocked: false,
      isAffirmation: false,
      tags: [],
      fromCalendar,
      createdAt: '2026-11-13T10:00:00.000Z',
      updatedAt: '2026-11-13T10:00:00.000Z',
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: ItemsService, useValue: {} },
        { provide: SettingsService, useValue: {} },
        { provide: ItemLockService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(() => new DashboardComponent());
  });

  it('shows an empty state when items exist but are excluded by the origin filter', () => {
    component.items = [createItem('calendar-note', true)];

    expect(component.hasVisibleItems).toBeFalse();
    expect(component.emptyStateMessage).toBe('Aucun item pour le moment.');

    component.calendarOnlyMode = true;

    expect(component.hasVisibleItems).toBeTrue();
  });

  it('distinguishes an unsuccessful search from an empty dashboard', () => {
    component.items = [createItem('ordinary-note', false)];
    component.searchQuery = 'missing';

    expect(component.hasVisibleItems).toBeFalse();
    expect(component.emptyStateMessage).toBe('Aucun résultat pour cette recherche.');

    component.searchQuery = 'example';

    expect(component.hasVisibleItems).toBeTrue();
  });

  it('explains that the calendar-origin filter has no matching items', () => {
    component.items = [createItem('ordinary-note', false)];
    component.calendarOnlyMode = true;

    expect(component.hasVisibleItems).toBeFalse();
    expect(component.emptyStateMessage).toBe('Aucun élément créé depuis le calendrier.');
  });
});
