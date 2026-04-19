
/**
 * Model representing the structure of a budget, including periods, accounts, and expense categories.
 */
export interface Budget {
    id?: string; // Dexie keypath storage compatibility
    periods: Period[]; // e.g., '2024-06' for June 2024
    accounts: Account[]; // list of accounts (banks) associated with the budget
    expenseCategories: ExpenseCategory[]; // list of expense categories for categorizing expenses
    incomeTypes: TypeOfIncome[]; // list of available income types (salary, PEA, PEL, etc.)
}

/**
 * Model representing a budget period, including bank income and expenses.
 * -> if nothing in the period delete it.
 */
export interface Period {
    date: string; // e.g., '2024-06' for June 2024
    incomes: IncomeItem[]; // total income for the period, grouped by bank.
    expenses: ExpenseItem[];
}

/**
 * Model representing bank information for a budget period.
 */
export interface IncomeItem {
    id: string;
    name: string; // Salaire, dividende, etc.
    // store the reference to the income type by id
    typeId: string; // refers to a `TypeOfIncome.id`
    // optional resolved object for convenience at runtime
    type?: TypeOfIncome;
    plannedAmount: number;
    plannedDate?: string; // optional planned date (ISO/local format)
    realAmount: number; // default to 0, updated as transactions are added.
    realDate?: string; // optional real date (ISO/local format)
    accountId: string; // reference to the associated account (bank)
    deductedFromIncomeId?: string; // optional link to another income from which this one is deducted
}

export type ExpenseType = 'savings' | 'variable' | 'fixed'; // for example, to differentiate between types of expenses.

/**
 * Model representing expense information for a budget period.
 */
export interface ExpenseItem {
    id: string;
    name: string;
    type: ExpenseType; // e.g., 'savings', 'variable', 'fixed', etc.
    note: string;
    plannedAmount: number;
    plannedDate?: string; // optional planned date (ISO/local format)
    realAmount: number; // default to 0, updated as expenses are added.
    realDate?: string; // optional real date (ISO/local format)
    categoryId: string; // e.g., 'Food', 'Transport', 'Entertainment', etc.
    accountId: string; // reference to the associated account (bank)
}

export interface TypeOfIncome {
    id: string;
    name: string;
    saving: boolean; // indicates if this type of income is considered as savings (for example, to differentiate between regular income and one-time windfalls)
}

export const defaultIncomeTypes: TypeOfIncome[] = [
    { id: 'salary', name: 'Salaire', saving: false },
    { id: 'bonus', name: 'Prime', saving: false },
    { id: 'dividend', name: 'Dividendes', saving: false },
    { id: 'interest', name: 'Interets', saving: false },
    { id: 'pea', name: 'PEA', saving: true },
    { id: 'pel', name: 'PEL', saving: true },
    { id: 'savings-transfer', name: 'Virement epargne', saving: true },
    { id: 'rent-income', name: 'Revenus locatifs', saving: false },
    { id: 'refund', name: 'Remboursement', saving: false },
    { id: 'other-income', name: 'Autre revenu', saving: false },
];

export interface Account {
    id: string;
    name: string; // N26, Revolut, etc.
    icon?: string; // URL or path to the bank's icon   
}

export interface ExpenseCategory {
    id: string;
    name: string;
    icon?: string; // URL or path to the category's icon
}

/**
 * Default expense categories that can be used for categorizing expenses in the budget.
 * Users can add custom categories as needed.
 */
export const defaultExpenseCategories: ExpenseCategory[] = [
  { id: 'uncategorized', name: 'Non catégorisé', icon: '❓' },
  { id: 'rent', name: 'Loyer', icon: '🏠' },
  { id: 'utilities', name: 'Charges', icon: '💡' },
  { id: 'internet', name: 'Internet', icon: '🌐' },
  { id: 'phone', name: 'Téléphone', icon: '📱' },
  { id: 'insurance', name: 'Assurances', icon: '🛡️' },
  { id: 'groceries', name: 'Alimentation', icon: '🛒' },
  { id: 'transport', name: 'Transport', icon: '🚗' },
  { id: 'fuel', name: 'Essence', icon: '⛽' },
  { id: 'health', name: 'Santé', icon: '💊' },
  { id: 'entertainment', name: 'Loisirs', icon: '🎮' },
  { id: 'restaurants', name: 'Restaurants', icon: '🍽️' },
  { id: 'subscriptions', name: 'Abonnements', icon: '📺' },
  { id: 'taxes', name: 'Impôts', icon: '💸' },
  { id: 'fees', name: 'Frais bancaires', icon: '🏦' },
  { id: 'debt', name: 'Crédits', icon: '📉' },
  { id: 'savings', name: 'Épargne', icon: '💰' },
  { id: 'investment', name: 'Investissement', icon: '📈' },
  { id: 'emergency', name: 'Fonds d\'urgence', icon: '🚨' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'clothing', name: 'Vêtements', icon: '👕' },
  { id: 'beauty', name: 'Beauté', icon: '💄' },
  { id: 'sports', name: 'Sport', icon: '🏋️' },
  { id: 'travel', name: 'Voyage', icon: '✈️' },
  { id: 'gifts', name: 'Cadeaux', icon: '🎁' },
  { id: 'education', name: 'Éducation', icon: '📚' },
];

export const defaultAccounts: Account[] = [
  { "id": "main", "name": "Compte principal", "icon": "🏛️" },
  { "id": "second", "name": "Compte secondaire", "icon": "🔹" },
  { "id": "savings", "name": "Épargne", "icon": "🐖" },
  { "id": "revolut", "name": "Revolut", "icon": "🌍" },
  { "id": "business", "name": "Compte pro", "icon": "📈" },
  { "id": "ticket-restaurant", "name": "Ticket Restaurant", "icon": "🥗" },
  { "id": "travel", "name": "Voyage", "icon": "🧳" },
  { "id": "emergency", "name": "Urgence", "icon": "🆘" },
  { "id": "cash", "name": "Espèces", "icon": "💶" },
  { "id": "crypto", "name": "Crypto", "icon": "₿" },
  { "id": "autre", "name": "Autre", "icon": "🧩" }
];

export function createDefaultBudget(): Budget {
    return {
        periods: [],
        accounts: defaultAccounts.map((account) => ({ ...account })),
        expenseCategories: defaultExpenseCategories.map((category) => ({ ...category })),
        incomeTypes: defaultIncomeTypes.map((incomeType) => ({ ...incomeType })),
    };
}
