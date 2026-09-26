import { setSyncStatus, syncTransaction } from './sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-manager-passcode'] !== process.env.MANAGER_PASSCODE) return res.status(403).json({ error: 'Manager authorization required.' });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const transactions = await fetch(`${url}/rest/v1/transactions?select=*&order=submitted_at.asc`, { headers }).then((response) => response.json());
  const employees = await fetch(`${url}/rest/v1/employees?select=id,display_name`, { headers }).then((response) => response.json());
  const names = new Map(employees.map((employee) => [employee.id, employee.display_name]));
  let synced = 0, failed = 0;
  for (const transaction of transactions) {
    try { await syncTransaction(transaction, names.get(transaction.submitted_by)); await setSyncStatus(transaction.id, 'synced'); synced += 1; }
    catch (error) { await setSyncStatus(transaction.id, 'failed', error.message); failed += 1; }
  }
  return res.status(failed ? 502 : 200).json({ ok: failed === 0, synced, failed });
}
