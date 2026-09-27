# Friends Included Finance Workspace

Day 4 homework application by **Ērika Ketija Muižniece**.

## What is live

- Supabase is the source of truth for transactions, approvals, original proposals, final decisions, sync state, and Telegram delivery state.
- The website submits sales and expenses through the same server-side validation rules used by the Telegram bot.
- Telegram supports `/start`, `/sale`, and `/expense`; Telegram-originated records retain their original chat ID for later approval/allocation notices.
- Google Sheets synchronizes by transaction reference: a retry or approval updates the existing row instead of adding a duplicate.
- Svetlana can approve decisions with the manager passcode. Other demonstration roles see only their own ledger entries and cannot see company financial results or manager controls in the app.
- The public **Test this system** page lets an instructor link their own Telegram account to a fictional test salesperson, submit a test sale, and approve or change that fictional test without receiving a private administrator password. The approval reply returns to the original Telegram chat.

## Demonstration role

The selector is intentionally labelled **Demonstration role** so an instructor can open the public link and inspect every permitted view without needing an access code. It controls the classroom demonstration view and allowed form type; this is not intended as real-world staff authentication.

## Useful checks

- `/api/health` checks whether required deployment integrations are configured.
- `/api/check-sheets` confirms the Sales and Expenses tabs, headers, and row totals.
- A Sheets failure is retained as `Sync failed`; the manager’s **Sync all records** action retries the same references without changing financial totals.

## Secrets

Never commit bot tokens, API keys, service-account JSON, or a populated `.env` file. Store these only in Vercel Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `MANAGER_PASSCODE`

## Database

Run `supabase/schema.sql` in the Supabase SQL Editor when creating a clean project.
