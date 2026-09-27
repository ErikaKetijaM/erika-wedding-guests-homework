export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST' });
  const test = request.body?.action === 'link-test';
  if (test) {
    const telegramUserId = Number(request.body?.telegramUserId);
    const chatId = Number(request.body?.chatId);
    if (!Number.isSafeInteger(telegramUserId) || !Number.isSafeInteger(chatId)) return response.status(400).json({ error: 'Enter the numeric Telegram user ID and chat ID shown by the bot.' });
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return response.status(503).json({ error: 'Database is not configured.' });
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
    let employee = (await fetch(`${url}/rest/v1/employees?display_name=eq.Test%20Telegram%20Salesperson&select=id`, { headers }).then((item) => item.json()))[0];
    if (!employee) {
      const created = await fetch(`${url}/rest/v1/employees`, { method: 'POST', headers, body: JSON.stringify({ display_name: 'Test Telegram Salesperson', role: 'salesperson' }) });
      employee = (await created.json())[0];
    }
    if (!employee) return response.status(502).json({ error: 'Could not prepare the fictional test employee.' });
    const saved = await fetch(`${url}/rest/v1/telegram_test_links?on_conflict=telegram_user_id`, { method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify({ telegram_user_id: telegramUserId, chat_id: chatId }) });
    if (!saved.ok) return response.status(502).json({ error: 'Could not save the fictional test link. Run the one-time Test Links SQL setup first.' });
    return response.status(200).json({ ok: true, message: 'Telegram account linked to the fictional Test Telegram Salesperson. Your real homework employee link is unchanged.' });
  }
  const provided = request.headers.authorization?.replace('Bearer ', '');
  if (!process.env.TELEGRAM_WEBHOOK_SETUP_KEY || provided !== process.env.TELEGRAM_WEBHOOK_SETUP_KEY) {
    return response.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.APP_BASE_URL) {
    return response.status(500).json({ error: 'Telegram configuration is incomplete' });
  }
  const webhook = `${process.env.APP_BASE_URL.replace(/\/$/, '')}/api/telegram`;
  const result = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: webhook }),
  });
  const data = await result.json();
  return response.status(result.ok ? 200 : 502).json({ webhook, telegram: data });
}
