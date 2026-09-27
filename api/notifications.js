const supabase = (path, options = {}) => fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
  ...options,
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
});

async function updateDelivery(id, values) {
  await supabase(`notification_deliveries?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(values) });
}

export async function notifyTransaction(transaction, eventType, text) {
  const employee = (await supabase(`employees?id=eq.${encodeURIComponent(transaction.submitted_by)}&select=linked_telegram_chat_id`).then((response) => response.json()))[0];
  const chatId = transaction.originating_chat_id || employee?.linked_telegram_chat_id || null;
  const delivery = await supabase('notification_deliveries', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ transaction_id: transaction.id, chat_id: chatId, event_type: eventType, status: chatId ? 'pending' : 'not_applicable' }) });
  if (!delivery.ok || !chatId || !process.env.TELEGRAM_BOT_TOKEN) return;
  const saved = (await delivery.json())[0];
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
    if (!response.ok) throw new Error((await response.json()).description || 'Telegram rejected the message.');
    await updateDelivery(saved.id, { status: 'sent', sent_at: new Date().toISOString() });
  } catch (error) {
    await updateDelivery(saved.id, { status: 'failed', error_message: error.message });
  }
}
