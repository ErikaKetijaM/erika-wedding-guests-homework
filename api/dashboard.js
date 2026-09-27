const money = (value) => Number(value || 0);
import { requireSession } from '../lib/auth.js';

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Database is not configured.' });
  const session = requireSession(req, res);
  if (!session) return;
  const viewerName = session.role;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const employeesResponse = await fetch(`${url}/rest/v1/employees?select=id,display_name,role`, { headers });
  const employees = await employeesResponse.json();
  const viewer = employees.find((employee) => employee.display_name === viewerName);
  if (!viewer) return res.status(403).json({ error: 'Unknown demonstration role.' });
  const canViewFinancials = viewer.role === 'manager';
  const filter = canViewFinancials ? '' : `&submitted_by=eq.${encodeURIComponent(viewer.id)}`;
  const response = await fetch(`${url}/rest/v1/transactions?select=*&order=submitted_at.desc${filter}`, { headers });
  const transactions = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: transactions.message || 'Could not load records.' });
  const deliveries = await fetch(`${url}/rest/v1/notification_deliveries?select=transaction_id,status,event_type,created_at&order=created_at.desc`, { headers }).then((item) => item.json());
  const latestDelivery = new Map();
  for (const delivery of deliveries) if (!latestDelivery.has(delivery.transaction_id)) latestDelivery.set(delivery.transaction_id, delivery);
  const names = new Map(employees.map((employee) => [employee.id, employee.display_name]));
  const approved = transactions.filter((item) => item.status === 'approved');
  const approvedSales = approved.filter((item) => item.kind === 'sale');
  const expenses = transactions.filter((item) => item.kind === 'expense');
  const total = (items) => items.reduce((sum, item) => sum + money(item.amount), 0);
  const commission = (item) => money(item.richard_commission) + money(item.anastasia_commission) + money(item.jean_claude_commission);
  const projectSales = (project) => approvedSales.filter((item) => item.project === project);
  const projectExpenses = (project) => approved.filter((item) => item.kind === 'expense' && item.final_allocation === project);
  const salesA = projectSales('A'), salesB = projectSales('B');
  const incomeA = total(salesA), incomeB = total(salesB);
  const commissionA = salesA.reduce((sum, item) => sum + commission(item), 0);
  const commissionB = salesB.reduce((sum, item) => sum + commission(item), 0);
  const allCommission = approvedSales.reduce((sum, item) => sum + commission(item), 0);
  res.status(200).json({
    integrations: { googleSheets: Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) },
    viewer: { name: viewer.display_name, role: viewer.role, canViewFinancials },
    metrics: canViewFinancials ? {
      income: incomeA + incomeB, incomeA, incomeB, commission: allCommission,
      commissionByPerson: { Richard: approvedSales.reduce((sum, item) => sum + money(item.richard_commission), 0), Anastasia: approvedSales.reduce((sum, item) => sum + money(item.anastasia_commission), 0), 'Jean-Claude': approvedSales.reduce((sum, item) => sum + money(item.jean_claude_commission), 0) },
      companyResult: incomeA + incomeB - allCommission - total(expenses), projectAResult: incomeA - commissionA - total(projectExpenses('A')), projectBResult: incomeB - commissionB - total(projectExpenses('B')), expenseA: total(projectExpenses('A')), expenseB: total(projectExpenses('B')), overhead: total(approved.filter((item) => item.kind === 'expense' && item.final_allocation === 'overhead')), awaitingExpenseAmount: total(expenses.filter((item) => item.status === 'awaiting_allocation')), pendingSales: transactions.filter((item) => item.kind === 'sale' && item.status === 'pending_approval').length, awaitingAllocation: transactions.filter((item) => item.kind === 'expense' && item.status === 'awaiting_allocation').length
    } : null,
    transactions: transactions.map((item) => ({ ...item, submitted_by_name: names.get(item.submitted_by) || 'Unknown', notification_status: latestDelivery.get(item.id)?.status || 'not_applicable' }))
  });
}
