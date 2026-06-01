export const CATTLE_BUY_FILTER = '__cattle_buy__';
export const CATTLE_SELL_FILTER = '__cattle_sell__';

export interface LedgerEntryLike {
  entry_type: string;
  category: string;
}

export function matchesLedgerCategoryFilter(
  entry: LedgerEntryLike,
  filter: string,
): boolean {
  if (!filter) return true;
  if (filter === CATTLE_BUY_FILTER) return entry.entry_type === 'cattle_purchase';
  if (filter === CATTLE_SELL_FILTER) return entry.entry_type === 'cattle_sale';
  if (filter.startsWith('expense:')) {
    const name = filter.slice('expense:'.length);
    return entry.entry_type === 'expense' && entry.category === name;
  }
  return true;
}

export function buildLedgerCategoryOptions(
  expenseCategoryNames: string[],
): { value: string; label: string }[] {
  return [
    { value: '', label: 'All Categories' },
    ...expenseCategoryNames.map((name) => ({
      value: `expense:${name}`,
      label: name,
    })),
    { value: CATTLE_BUY_FILTER, label: 'Cattle Buy (Inventory)' },
    { value: CATTLE_SELL_FILTER, label: 'Cattle Sell (Inventory)' },
  ];
}
