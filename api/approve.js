import { setSyncStatus, syncTransaction } from './sheets.js';
import { notifyTransaction } from './notifications.js';
import { requireSession } from '../lib/auth.js';

function commissionAmounts(amount, split) {
  const poolCents = Math.round(Number(amount) * 10);
  const cents = split.map((percent) => Math.round(poolCents * percent / 100));
  const difference = poolCents - cents.reduce((total, value) => total + value, 0);
  const largestSplitIndex = split.reduce((best, value, index) => value > split[best] ? index : best, 0);
  cents[largestSplitIndex] += difference;
  return cents.map((value) => value / 100);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { reference, decision = '' } = req.body || {};
  const session = requireSession(req, res);
  if (!session) return;
  if (session.role !== 'Svetlana' || req.headers['x-manager-passcode'] !== process.env.MANAGER_PASSCODE) return res.status(403).json({ error: 'Manager authorization required.' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const transaction = (await fetch(`${url}/rest/v1/transactions?reference=eq.${encodeURIComponent(reference)}&select=*`, { headers }).then((response) => response.json()))[0];
  if (!transaction) return res.status(404).json({ error: 'Record not found.' });
  if (transaction.status === 'approved') return res.json({ ok: true, alreadyApproved: true });
  const manager = (await fetch(`${url}/rest/v1/employees?display_name=eq.Svetlana&select=id`, { headers }).then((response) => response.json()))[0];
  let update;
  if (transaction.kind === 'sale') {
    const split = decision ? decision.split('/').map(Number) : [transaction.proposed_richard_pct, transaction.proposed_anastasia_pct, transaction.proposed_jean_claude_pct];
    if (split.length !== 3 || split.some((number) => !Number.isFinite(number) || number < 0) || split[0] + split[1] + split[2] !== 100) return res.status(400).json({ error: 'Commission split must contain three percentages totaling 100.' });
    const [richardCommission, anastasiaCommission, jeanClaudeCommission] = commissionAmounts(transaction.amount, split);
    update = { status: 'approved', approved_richard_pct: split[0], approved_anastasia_pct: split[1], approved_jean_claude_pct: split[2], richard_commission: richardCommission, anastasia_commission: anastasiaCommission, jean_claude_commission: jeanClaudeCommission, approved_at: new Date().toISOString(), approved_by: manager?.id || null };
  } else {
    const allocation = decision || transaction.proposed_allocation;
    if (!['A', 'B', 'overhead'].includes(allocation)) return res.status(400).json({ error: 'Allocation must be A, B, or overhead.' });
    update = { status: 'approved', final_allocation: allocation, approved_at: new Date().toISOString(), approved_by: manager?.id || null };
  }
  const savedResponse = await fetch(`${url}/rest/v1/transactions?reference=eq.${encodeURIComponent(reference)}`, { method: 'PATCH', headers, body: JSON.stringify(update) });
  const saved = await savedResponse.json();
  if (!savedResponse.ok) return res.status(502).json({ error: saved.message || 'Could not save decision.' });
  const employee = (await fetch(`${url}/rest/v1/employees?id=eq.${encodeURIComponent(transaction.submitted_by)}&select=display_name`, { headers }).then((response) => response.json()))[0];
  try { await syncTransaction(saved[0], employee?.display_name); await setSyncStatus(saved[0].id, 'synced'); } catch (error) { await setSyncStatus(saved[0].id, 'failed', error.message); }
  const projectName = (value) => value === 'overhead' ? 'Company overhead' : `Project ${value}`;
  const updateText = saved[0].kind === 'sale' ? (() => {
    const changed = saved[0].proposed_richard_pct !== saved[0].approved_richard_pct || saved[0].proposed_anastasia_pct !== saved[0].approved_anastasia_pct || saved[0].proposed_jean_claude_pct !== saved[0].approved_jean_claude_pct;
    const totalCommission = (Number(saved[0].richard_commission) + Number(saved[0].anastasia_commission) + Number(saved[0].jean_claude_commission)).toFixed(2);
    return `Sale ${saved[0].reference} approved — commission split ${changed ? 'changed' : 'confirmed'}. Sale €${Number(saved[0].amount).toFixed(2)}; total commission €${totalCommission}. Richard: ${saved[0].proposed_richard_pct}% → ${saved[0].approved_richard_pct}% (€${Number(saved[0].richard_commission).toFixed(2)}). Anastasia: ${saved[0].proposed_anastasia_pct}% → ${saved[0].approved_anastasia_pct}% (€${Number(saved[0].anastasia_commission).toFixed(2)}). Jean-Claude: ${saved[0].proposed_jean_claude_pct}% → ${saved[0].approved_jean_claude_pct}% (€${Number(saved[0].jean_claude_commission).toFixed(2)}).`;
  })() : `Expense ${saved[0].reference} — allocation ${saved[0].proposed_allocation === saved[0].final_allocation ? 'confirmed' : 'changed'}. €${Number(saved[0].amount).toFixed(2)}: ${saved[0].description}. Proposed: ${projectName(saved[0].proposed_allocation)}. Approved: ${projectName(saved[0].final_allocation)}.`;
  await notifyTransaction(saved[0], saved[0].kind === 'sale' ? 'sale_approval' : 'expense_allocation', updateText);
  return res.status(200).json({ ok: true });
}
