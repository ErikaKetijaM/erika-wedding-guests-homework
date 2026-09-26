import crypto from 'node:crypto';

const base64url = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');

async function googleAccessToken() {
  const account = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  if (!account.client_email || !account.private_key) throw new Error('Google Sheets credentials are not configured.');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(account.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || 'Could not authenticate with Google Sheets.');
  return body.access_token;
}

async function google(path, options = {}) {
  const token = await googleAccessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Google Sheets request failed.');
  return body;
}

async function ensureTabs() {
  const sheet = await google('?fields=sheets.properties');
  const existing = new Set(sheet.sheets.map((item) => item.properties.title));
  const missing = ['Sales', 'Expenses'].filter((title) => !existing.has(title));
  if (missing.length) await google(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }) });
  for (const title of missing) await google(`/values/${encodeURIComponent(`${title}!A1:N1`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [['Reference', 'Submitted at', 'Submitted by', 'Customer', 'Description', 'Amount', 'Project', 'Category', 'Proposed allocation', 'Final allocation', 'Proposed split', 'Approved split', 'Commission split', 'Status']] }) });
}

const value = (number) => Number(number || 0).toFixed(2);

export async function syncTransaction(transaction, submittedByName = transaction.submitted_by) {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Google Sheets credentials are not configured.');
  await ensureTabs();
  const tab = transaction.kind === 'sale' ? 'Sales' : 'Expenses';
  const current = await google(`/values/${encodeURIComponent(`${tab}!A2:A`)}`);
  const rowNumber = (current.values || []).findIndex((row) => row[0] === transaction.reference) + 2;
  const row = [[transaction.reference, transaction.submitted_at || new Date().toISOString(), submittedByName, transaction.customer || '', transaction.description, Number(transaction.amount), transaction.project || '', transaction.category || '', transaction.proposed_allocation || '', transaction.final_allocation || '', transaction.kind === 'sale' ? `${transaction.proposed_richard_pct}/${transaction.proposed_anastasia_pct}/${transaction.proposed_jean_claude_pct}` : '', transaction.kind === 'sale' ? `${transaction.approved_richard_pct ?? ''}/${transaction.approved_anastasia_pct ?? ''}/${transaction.approved_jean_claude_pct ?? ''}` : '', transaction.kind === 'sale' ? `${value(transaction.richard_commission)}/${value(transaction.anastasia_commission)}/${value(transaction.jean_claude_commission)}` : '', transaction.status]];
  if (rowNumber > 1) await google(`/values/${encodeURIComponent(`${tab}!A${rowNumber}:N${rowNumber}`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: row }) });
  else await google(`/values/${encodeURIComponent(`${tab}!A:N`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: row }) });
}

export async function setSyncStatus(transactionId, status, error = null) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${url}/rest/v1/transactions?id=eq.${encodeURIComponent(transactionId)}`, { method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sheets_sync_status: status, sheets_sync_error: error }) });
}
