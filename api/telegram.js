const api = (path, options = {}) => fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
  ...options,
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
});

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
  const users = await api(`employees?telegram_user_id=eq.${message.from.id}&select=display_name,role`);
  const employee = (await users.json())[0];
  if (text === '/start') {
    const greeting = employee
      ? `Hello ${employee.display_name}. You are linked as ${employee.role}. Transaction commands will be enabled in the next release.`
      : 'Welcome to Friends Included Finance. Your Telegram account is not linked to an employee yet. Ask Svetlana to link it in manager setup.';
    await telegram(chatId, greeting);
    return response.status(200).json({ ok: true });
  }
  await telegram(chatId, 'Use /start to check your account link. Transaction submission will be enabled shortly.');
  return response.status(200).json({ ok: true });
}
