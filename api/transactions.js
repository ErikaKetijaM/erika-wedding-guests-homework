import { setSyncStatus, syncTransaction } from './sheets.js';
import { notifyTransaction } from './notifications.js';
import { requireSession } from './auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, body = req.body || {};
  const session = requireSession(req, res);
  if (!session) return;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  const employees = await fetch(`${url}/rest/v1/employees?display_name=eq.${encodeURIComponent(session.role)}&select=id,role`, { headers }).then((response) => response.json());
  const employee = employees[0];
  if (!employee) return res.status(403).json({ error: 'Unknown role.' });
  const sale = body.kind === 'sale';
  if (!['sale', 'expense'].includes(body.kind)) return res.status(400).json({ error: 'Transaction type must be a sale or expense.' });
  if ((sale && employee.role !== 'salesperson') || (!sale && employee.role !== 'expense_reporter')) return res.status(403).json({ error: 'This role cannot submit this transaction.' });
  const reference = String(body.reference || '').trim().toUpperCase();
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);
  if (!reference || !description || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Reference, description, and a positive amount are required.' });

  let row;
  if (sale) {
    const split = [Number(body.r), Number(body.a), Number(body.j)];
    if (!String(body.customer || '').trim() || !['A', 'B'].includes(body.project)) return res.status(400).json({ error: 'Sales require a customer and Project A or B.' });
    if (split.some((value) => !Number.isFinite(value) || value < 0) || split.reduce((total, value) => total + value, 0) !== 100) return res.status(400).json({ error: 'Commission shares must be non-negative and total 100%.' });
    row = { reference, kind: 'sale', submitted_by: employee.id, customer: String(body.customer).trim(), project: body.project, description, amount, proposed_richard_pct: split[0], proposed_anastasia_pct: split[1], proposed_jean_claude_pct: split[2], status: 'pending_approval' };
  } else {
    if (!['Materials', 'Travel', 'Other'].includes(body.category) || !['A', 'B', 'overhead'].includes(body.allocation)) return res.status(400).json({ error: 'Expenses need a valid category and allocation.' });
    row = { reference, kind: 'expense', submitted_by: employee.id, description, amount, category: body.category, proposed_allocation: body.allocation, status: body.allocation === 'overhead' ? 'approved' : 'awaiting_allocation', final_allocation: body.allocation === 'overhead' ? 'overhead' : null };
  }
  const created = await fetch(`${url}/rest/v1/transactions`, { method: 'POST', headers, body: JSON.stringify(row) });
  const saved = await created.json();
  if (!created.ok) return res.status(400).json({ error: saved.message || 'Could not save transaction.' });
  try { await syncTransaction(saved[0], session.role); await setSyncStatus(saved[0].id, 'synced'); } catch (error) { await setSyncStatus(saved[0].id, 'failed', error.message); }
  await notifyTransaction(saved[0], 'submission', `${saved[0].reference} was submitted on the website and is ${saved[0].status === 'approved' ? 'approved' : 'waiting for Svetlana’s decision'}.`);
  return res.status(201).json({ ok: true });
}
