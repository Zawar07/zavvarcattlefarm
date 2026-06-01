import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'src', 'app', 'api');

const routes = [
  ['bank/balance', 'bankBalance'],
  ['bank/log', 'bankLog'],
  ['expenses', 'expensesIndex'],
  ['expenses/categories', 'expenseCategories'],
  ['expenses/summary', 'expenseSummary'],
  ['expenses/[id]', 'expenseById'],
  ['cattle', 'cattleIndex'],
  ['cattle/summary', 'cattleSummary'],
  ['cattle/[id]', 'cattleById'],
  ['cattle/[id]/sell', 'cattleSell'],
  ['employees', 'employeesIndex'],
  ['employees/[id]', 'employeeById'],
  ['employees/[id]/expenses', 'employeeExpenses'],
  ['employees/[id]/payroll', 'employeePayroll'],
  ['employee-expenses/[id]', 'employeeExpenseById'],
  ['ledger', 'ledgerIndex'],
  ['ledger/monthly', 'ledgerMonthly'],
  ['partners/shares', 'partnerShares'],
  ['partners/[id]/settle', 'partnerSettle'],
  ['partners/[id]/settlements', 'partnerSettlements'],
  ['users', 'usersIndex'],
  ['users/[id]', 'userById'],
  ['users/[id]/reset-password', 'userResetPassword'],
  ['audit', 'auditIndex'],
  ['reports', 'reportsIndex'],
];

const methods = ['GET', 'POST', 'PATCH', 'DELETE'];

for (const [routePath, handlerName] of routes) {
  const dir = path.join(root, ...routePath.split('/'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'route.ts');
  const exports = methods
    .map(
      (m) =>
        `export const ${m} = withHandler(async (req, ctx) => {
  const h = handlers.${handlerName}.${m};
  return h ? h(req, ctx) : methodNotAllowedResponse();
});`,
    )
    .join('\n');
  const content = `import { withHandler } from '@/lib/http';
import * as handlers from '@/lib/handlers';
import { methodNotAllowedResponse } from '@/lib/handlers';

${exports}
`;
  fs.writeFileSync(file, content);
  console.log('wrote', file);
}
