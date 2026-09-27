import { setSyncStatus, syncTransaction } from './sheets.js';
import { notifyTransaction } from './notifications.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { reference, role, decision = '' } = req.body || {};
  if (role !== 'Svetlana' || req.headers['x-manager-passcode'] !== process.env.MANAGER_PASSCODE) return res.status(403).json({ error: 'Manager authorization required.' });
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
    update = { status: 'approved', approved_richard_pct: split[0], approved_anastasia_pct: split[1], approved_jean_claude_pct: split[2], richard_commission: +(transaction.amount * 0.1 * split[0] / 100).toFixed(2), anastasia_commission: +(transaction.amount * 0.1 * split[1] / 100).toFixed(2), jean_claude_commission: +(transaction.amount * 0.1 * split[2] / 100).toFixed(2), approved_at: new Date().toISOString(), approved_by: manager?.id || null };
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
  const updateText = saved[0].kind === 'sale' ? `${saved[0].reference} was approved. Final commission split: Richard ${saved[0].approved_richard_pct}%, Anastasia ${saved[0].approved_anastasia_pct}%, Jean-Claude ${saved[0].approved_jean_claude_pct}%.` : `${saved[0].reference} was approved. Final allocation: ${saved[0].final_allocation === 'overhead' ? 'Company overhead' : `Project ${saved[0].final_allocation}`}.`;
  await notifyTransaction(saved[0], saved[0].kind === 'sale' ? 'sale_approval' : 'expense_allocation', updateText);
  return res.status(200).json({ ok: true });
}
