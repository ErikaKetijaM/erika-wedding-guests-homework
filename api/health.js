export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "friends-included-finance",
    integrations: {
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      googleSheets: Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    },
  });
}
