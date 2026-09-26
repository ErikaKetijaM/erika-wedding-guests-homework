const money = (value) => Number(value || 0);

export default async function handler(_req, res) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Database is not configured.' });
  const response = await fetch(`${url}/rest/v1/transactions?select=*&order=submitted_at.desc`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const transactions = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: transactions.message || 'Could not load records.' });
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
    transactions,
    metrics: {
      income: incomeA + incomeB, incomeA, incomeB, commission: allCommission,
      commissionByPerson: {
        Richard: approvedSales.reduce((sum, item) => sum + money(item.richard_commission), 0),
        Anastasia: approvedSales.reduce((sum, item) => sum + money(item.anastasia_commission), 0),
        'Jean-Claude': approvedSales.reduce((sum, item) => sum + money(item.jean_claude_commission), 0)
      },
      companyResult: incomeA + incomeB - allCommission - total(expenses),
      projectAResult: incomeA - commissionA - total(projectExpenses('A')),
      projectBResult: incomeB - commissionB - total(projectExpenses('B')),
      pendingSales: transactions.filter((item) => item.kind === 'sale' && item.status === 'pending_approval').length,
      awaitingAllocation: transactions.filter((item) => item.kind === 'expense' && item.status === 'awaiting_allocation').length
    }
  });
}
