import { Period } from './budget.model';

/**
 * Exemple de données de périodes sur 1 an pour tests/démo.
 * Chaque mois contient des revenus et dépenses factices.
 */
export const mockPeriods: Period[] = [
  {
    date: '2025-01',
    incomes: [
      {
        id: 'inc-jan-sal',
        name: 'Salaire',
        type: { id: 'salary', name: 'Salaire', saving: false },
        plannedAmount: 2500,
        plannedDate: '2025-01-01',
        realAmount: 2500,
        realDate: '2025-01-01',
        accountId: 'main',
      }
    ],
    expenses: [
      {
        id: 'exp-jan-loyer',
        name: 'Loyer',
        type: 'fixed',
        note: '',
        plannedAmount: 900,
        plannedDate: '2025-01-02',
        realAmount: 900,
        realDate: '2025-01-02',
        categoryId: 'rent',
        accountId: 'main',
      },
      {
        id: 'exp-jan-food',
        name: 'Courses',
        type: 'variable',
        note: '',
        plannedAmount: 300,
        plannedDate: '2025-01-10',
        realAmount: 320,
        realDate: '2025-01-12',
        categoryId: 'groceries',
        accountId: 'main',
      }
    ]
  },
  // ... 11 autres mois
];

// Génération automatique pour 12 mois (2025-01 à 2025-12)
export function generateMockPeriods(): Period[] {
  const months = [
    '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
    '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  ];
  return months.map((date, idx) => ({
    date,
    incomes: [
      {
        id: `inc-${date}-sal`,
        name: 'Salaire',
        type: { id: 'salary', name: 'Salaire', saving: false },
        plannedAmount: 2500,
        plannedDate: `${date}-01`,
        realAmount: 2500,
        realDate: `${date}-01`,
        accountId: 'main',
      }
    ],
    expenses: [
      {
        id: `exp-${date}-loyer`,
        name: 'Loyer',
        type: 'fixed',
        note: '',
        plannedAmount: 900,
        plannedDate: `${date}-02`,
        realAmount: 900,
        realDate: `${date}-02`,
        categoryId: 'rent',
        accountId: 'main',
      },
      {
        id: `exp-${date}-food`,
        name: 'Courses',
        type: 'variable',
        note: '',
        plannedAmount: 300,
        plannedDate: `${date}-10`,
        realAmount: 320,
        realDate: `${date}-12`,
        categoryId: 'groceries',
        accountId: 'main',
      }
    ]
  }));
}
