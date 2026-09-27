import { authIsConfigured } from './auth.js';

export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json({
    ok: true,
    service: "friends-included-finance",
    deployment: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    integrations: {
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      googleSheets: Boolean(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      googleSheetIdConfigured: Boolean(process.env.GOOGLE_SHEET_ID),
      googleServiceAccountConfigured: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      roleAccessConfigured: authIsConfigured(),
    },
  });
}
