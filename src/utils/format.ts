// Pakistani number formatting: last 3 digits grouped, then groups of 2
export function formatPKR(value: number): string {
  const rounded = Math.round(value);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.abs(rounded));
  return `PKR ${rounded < 0 ? '-' : ''}${formatted}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
