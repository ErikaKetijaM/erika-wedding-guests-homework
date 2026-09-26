# Friends Included Finance Workspace

This repository contains the Day 4 homework application for **Ērika Ketija Muižniece**.

## Current progress

- Website foundation: dashboard, role selector, transaction forms, manager queue, and records view.
- Secure deployment foundation: environment-variable template, health check, Vercel configuration, and database schema.
- Still to connect: Supabase tables, Telegram webhook, Google Sheets synchronization, approval workflow, and final Test 1/Test 2 verification.

## Secrets

Never commit bot tokens, API keys, service-account JSON, or a populated `.env` file. Add these only in Vercel Environment Variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `GOOGLE_SHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

## Database

After creating the Supabase project, open **SQL Editor** and run `supabase/schema.sql`. The schema uses Supabase as the source of truth, protects browser access with Row Level Security, and retains original proposals, final decisions, notification status, and sync status.
