const api = (path, options = {}) => fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
  ...options,
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
});
import { setSyncStatus, syncTransaction } from './sheets.js';

async function telegram(chatId, text) {
  return fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'POST only' });
  const message = request.body?.message;
  if (!message?.chat?.id || !message?.from?.id) return response.status(200).json({ ok: true });
  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.TELEGRAM_BOT_TOKEN) {
    return response.status(500).json({ error: 'Bot is not configured' });
  }
  const users = await api(`employees?telegram_user_id=eq.${message.from.id}&select=id,display_name,role`);
  const normalEmployee = (await users.json())[0];
  const testLinksResponse = await api(`telegram_test_links?telegram_user_id=eq.${message.from.id}&select=telegram_user_id`);
  const testLinks = await testLinksResponse.json();
  const testLinked = Array.isArray(testLinks) && testLinks.length > 0;
  const testEmployee = testLinked ? (await api('employees?display_name=eq.Test%20Telegram%20Salesperson&select=id,display_name,role').then((item) => item.json()))[0] : null;
  const employee = testEmployee || normalEmployee;
  if (text === '/start') {
    const greeting = employee
      ? `Hello ${employee.display_name}. You are linked as ${employee.role}. Your Telegram user ID is ${message.from.id}; this chat ID is ${chatId}. Sales: /sale REF|Customer|A or B|Description|Amount|Richard%|Anastasia%|Jean-Claude%. Expenses: /expense REF|Description|Materials, Travel, or Other|Amount|A, B, or overhead.`
      : `Welcome to Friends Included Finance. Your account is not linked yet. Your Telegram user ID is ${message.from.id}; this chat ID is ${chatId}. Copy both numbers into the website’s “Test this system” page to link the fictional test salesperson.`;
    await telegram(chatId, greeting);
    return response.status(200).json({ ok: true });
  }
  if (text.startsWith('/sale ')) {
    if (!employee || employee.role !== 'salesperson') { await telegram(chatId, 'Only linked salespeople can submit sales.'); return response.status(200).json({ ok: true }); }
    const p = text.slice(6).split('|').map(x => x.trim());
    const [reference, customer, project, description, amountText, rText, aText, jText] = p;
    const amount = Number(amountText), r = Number(rText), a = Number(aText), j = Number(jText);
    if (p.length !== 8 || !reference || !customer || !['A','B'].includes(project) || !description || amount <= 0 || r < 0 || a < 0 || j < 0 || r + a + j !== 100) { await telegram(chatId, 'Use: /sale REF|Customer|A or B|Description|Amount|Richard%|Anastasia%|Jean-Claude%'); return response.status(200).json({ ok: true }); }
    const row = { reference: reference.toUpperCase(), kind: 'sale', submitted_by: employee.id, originating_chat_id: chatId, customer, project, description, amount, proposed_richard_pct:r, proposed_anastasia_pct:a, proposed_jean_claude_pct:j, status:'pending_approval' };
    const saved = await api('transactions', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(row) });
    if (!saved.ok) { await telegram(chatId, saved.status === 409 ? 'That reference already exists.' : 'The sale could not be saved.'); return response.status(200).json({ok:true}); }
    const record = (await saved.json())[0];
    try { await syncTransaction(record, employee.display_name); await setSyncStatus(record.id, 'synced'); } catch (error) { await setSyncStatus(record.id, 'failed', error.message); }
    await telegram(chatId, `Sale ${row.reference} recorded: €${amount.toFixed(2)}, Project ${project}, Pending approval.`);
    return response.status(200).json({ok:true});
  }
  if (text.startsWith('/expense ')) {
    if (!employee || employee.role !== 'expense_reporter') { await telegram(chatId, 'Only Kevin can submit expenses.'); return response.status(200).json({ ok: true }); }
    const [reference, description, category, amountText, allocation] = text.slice(9).split('|').map(x => x.trim()); const amount = Number(amountText); const map = { A:'A', B:'B', overhead:'overhead' };
    if (!reference || !description || !['Materials','Travel','Other'].includes(category) || amount <= 0 || !map[allocation]) { await telegram(chatId, 'Use: /expense REF|Description|Materials, Travel, or Other|Amount|A, B, or overhead'); return response.status(200).json({ ok:true }); }
    const automatic = allocation === 'overhead';
    const saved = await api('transactions', { method:'POST', headers:{Prefer:'return=representation'}, body:JSON.stringify({reference:reference.toUpperCase(),kind:'expense',submitted_by:employee.id,originating_chat_id:chatId,description,amount,category,proposed_allocation:map[allocation],final_allocation:automatic?'overhead':null,status:automatic?'approved':'awaiting_allocation'}) });
    if (!saved.ok) { await telegram(chatId, saved.status===409?'That reference already exists.':'The expense could not be saved.'); return response.status(200).json({ok:true}); }
    const record = (await saved.json())[0];
    try { await syncTransaction(record, employee.display_name); await setSyncStatus(record.id, 'synced'); } catch (error) { await setSyncStatus(record.id, 'failed', error.message); }
    await telegram(chatId, `Expense ${reference.toUpperCase()} recorded: €${amount.toFixed(2)}, ${automatic?'Company overhead.':'Awaiting allocation.'}`); return response.status(200).json({ok:true});
  }
  await telegram(chatId, 'Use /start to check your account link. Then use /sale or /expense to submit a transaction.');
  return response.status(200).json({ ok: true });
}
