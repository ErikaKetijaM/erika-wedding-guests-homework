import crypto from 'node:crypto';

const salesHeaders = ['Reference', 'Submission time', 'Salesperson', 'Customer', 'Project', 'Description', 'Amount', 'Proposed Richard %', 'Proposed Anastasia %', 'Proposed Jean-Claude %', 'Approved Richard %', 'Approved Anastasia %', 'Approved Jean-Claude %', 'Richard commission', 'Anastasia commission', 'Jean-Claude commission', 'Status'];
const expenseHeaders = ['Reference', 'Submission time', 'Reporter', 'Description', 'Category', 'Amount', 'Proposed allocation', 'Final allocation', 'Status'];
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

async function writeHeaders() {
  await google(`/values/${encodeURIComponent('Sales!A1:Q1')}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [salesHeaders] }) });
  await google(`/values/${encodeURIComponent('Expenses!A1:N1')}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [[...expenseHeaders, '', '', '', '', '']] }) });
}

async function styleTabs() {
  const spreadsheet = await google('?fields=sheets.properties');
  const sheets = Object.fromEntries(spreadsheet.sheets.map((sheet) => [sheet.properties.title, sheet.properties.sheetId]));
  const header = (sheetId, columns, color) => ({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: columns }, cell: { userEnteredFormat: { backgroundColor: color, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)' } });
  const widths = (sheetId, values) => values.map((pixelSize, index) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 }, properties: { pixelSize }, fields: 'pixelSize' } }));
  const sheetSetup = (title, columns, color, columnWidths) => {
    const sheetId = sheets[title];
    if (sheetId === undefined) return [];
    return [
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 }, tabColor: color }, fields: 'gridProperties.frozenRowCount,tabColor' } },
      header(sheetId, columns, color),
      ...widths(sheetId, columnWidths),
      { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: columns } } } }
    ];
  };
  const requests = [
    ...sheetSetup('Sales', 17, { red: 0.13, green: 0.32, blue: 0.27 }, [100, 155, 125, 145, 80, 290, 95, 115, 115, 120, 115, 115, 120, 120, 125, 130, 135]),
    ...sheetSetup('Expenses', 9, { red: 0.53, green: 0.28, blue: 0.16 }, [100, 155, 120, 310, 105, 100, 150, 135, 145])
  ];
  if (requests.length) await google(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
}

async function ensureTabs() {
  const sheet = await google('?fields=sheets.properties');
  const existing = new Set(sheet.sheets.map((item) => item.properties.title));
  const missing = ['Sales', 'Expenses'].filter((title) => !existing.has(title));
  if (missing.length) await google(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }) });
  await writeHeaders();
  await styleTabs();
}

const amount = (value) => Number(value || 0).toFixed(2);
const sheetInfo = (transaction, submittedByName) => transaction.kind === 'sale' ? {
  tab: 'Sales', end: 'Q',
  row: [transaction.reference, transaction.submitted_at || new Date().toISOString(), submittedByName, transaction.customer || '', transaction.project || '', transaction.description, Number(transaction.amount), transaction.proposed_richard_pct, transaction.proposed_anastasia_pct, transaction.proposed_jean_claude_pct, transaction.approved_richard_pct ?? '', transaction.approved_anastasia_pct ?? '', transaction.approved_jean_claude_pct ?? '', transaction.status === 'approved' ? amount(transaction.richard_commission) : '0.00', transaction.status === 'approved' ? amount(transaction.anastasia_commission) : '0.00', transaction.status === 'approved' ? amount(transaction.jean_claude_commission) : '0.00', transaction.status]
} : {
  tab: 'Expenses', end: 'I',
  row: [transaction.reference, transaction.submitted_at || new Date().toISOString(), submittedByName, transaction.description, transaction.category || '', Number(transaction.amount), transaction.proposed_allocation || '', transaction.final_allocation || '', transaction.status]
};

export async function syncTransaction(transaction, submittedByName = transaction.submitted_by) {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Google Sheets credentials are not configured.');
  await ensureTabs();
  const { tab, end, row } = sheetInfo(transaction, submittedByName);
  const current = await google(`/values/${encodeURIComponent(`${tab}!A2:A`)}`);
  const rowNumber = (current.values || []).findIndex((item) => item[0] === transaction.reference) + 2;
  if (rowNumber > 1) await google(`/values/${encodeURIComponent(`${tab}!A${rowNumber}:${end}${rowNumber}`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [row] }) });
  else await google(`/values/${encodeURIComponent(`${tab}!A:${end}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [row] }) });
}

export async function refreshHeaders() {
  await ensureTabs();
}

export async function inspectSheets() {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Google Sheets credentials are not configured.');
  const spreadsheet = await google('?fields=sheets.properties');
  const tabs = spreadsheet.sheets.map((sheet) => sheet.properties.title);
  const result = { tabs, sales: null, expenses: null };
  for (const [key, tab] of [['sales', 'Sales'], ['expenses', 'Expenses']]) {
    if (!tabs.includes(tab)) continue;
    const [header, rows] = await Promise.all([
      google(`/values/${encodeURIComponent(`${tab}!1:1`)}`),
      google(`/values/${encodeURIComponent(`${tab}!A2:A`)}`)
    ]);
    result[key] = { headers: header.values?.[0] || [], rowCount: (rows.values || []).filter((row) => row[0]).length };
  }
  return result;
}

export async function setSyncStatus(transactionId, status, error = null) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${url}/rest/v1/transactions?id=eq.${encodeURIComponent(transactionId)}`, { method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sheets_sync_status: status, sheets_sync_error: error }) });
}
