import { notifyTransaction } from './notifications.js';

const textFor = (item, eventType) => {
  if (eventType === 'sale_approval') return `Sale ${item.reference} approved. Sale €${Number(item.amount).toFixed(2)}; total commission €${(Number(item.richard_commission) + Number(item.anastasia_commission) + Number(item.jean_claude_commission)).toFixed(2)}. Richard: ${item.approved_richard_pct}% (€${Number(item.richard_commission).toFixed(2)}). Anastasia: ${item.approved_anastasia_pct}% (€${Number(item.anastasia_commission).toFixed(2)}). Jean-Claude: ${item.approved_jean_claude_pct}% (€${Number(item.jean_claude_commission).toFixed(2)}).`;
  if (eventType === 'expense_allocation') return `Expense ${item.reference} approved. €${Number(item.amount).toFixed(2)}: ${item.description}. Final allocation: ${item.final_allocation === 'overhead' ? 'Company overhead' : `Project ${item.final_allocation}`}.`;
  return `${item.reference} was submitted and is ${item.status}.`;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-manager-passcode'] !== process.env.MANAGER_PASSCODE) return res.status(403).json({ error: 'Manager authorization required.' });
  const { reference, eventType } = req.body || {};
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const transaction = (await fetch(`${url}/rest/v1/transactions?reference=eq.${encodeURIComponent(reference)}&select=*`, { headers }).then((response) => response.json()))[0];
  if (!transaction) return res.status(404).json({ error: 'Record not found.' });
  const result = await notifyTransaction(transaction, eventType, textFor(transaction, eventType));
  return res.status(200).json({ ok: true, status: result?.status || 'not_applicable' });
}
