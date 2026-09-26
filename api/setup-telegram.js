export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Use POST' });
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
