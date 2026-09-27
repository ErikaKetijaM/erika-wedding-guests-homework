import { setSyncStatus, syncTransaction } from './sheets.js';
import { notifyTransaction } from './notifications.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, body = req.body || {};
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const employees = await fetch(`${url}/rest/v1/employees?display_name=eq.${encodeURIComponent(body.role)}&select=id,role`, { headers }).then((response) => response.json());
  const employee = employees[0];
  if (!employee) return res.status(403).json({ error: 'Unknown role.' });
  const sale = body.kind === 'sale';
  if ((sale && employee.role !== 'salesperson') || (!sale && employee.role !== 'expense_reporter')) return res.status(403).json({ error: 'This role cannot submit this transaction.' });
  const row = sale ? { reference: body.reference, kind: 'sale', submitted_by: employee.id, customer: body.customer, project: body.project, description: body.description, amount: body.amount, proposed_richard_pct: body.r, proposed_anastasia_pct: body.a, proposed_jean_claude_pct: body.j, status: 'pending_approval' } : { reference: body.reference, kind: 'expense', submitted_by: employee.id, description: body.description, amount: body.amount, category: body.category, proposed_allocation: body.allocation, status: body.allocation === 'overhead' ? 'approved' : 'awaiting_allocation', final_allocation: body.allocation === 'overhead' ? 'overhead' : null };
  const created = await fetch(`${url}/rest/v1/transactions`, { method: 'POST', headers, body: JSON.stringify(row) });
  const saved = await created.json();
  if (!created.ok) return res.status(400).json({ error: saved.message || 'Could not save transaction.' });
  try { await syncTransaction(saved[0], body.role); await setSyncStatus(saved[0].id, 'synced'); } catch (error) { await setSyncStatus(saved[0].id, 'failed', error.message); }
  await notifyTransaction(saved[0], 'submission', `${saved[0].reference} was submitted on the website and is ${saved[0].status === 'approved' ? 'approved' : 'waiting for Svetlana’s decision'}.`);
  return res.status(201).json({ ok: true });
}
