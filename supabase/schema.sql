-- Friends Included Ltd: source-of-truth schema.
-- Run this in Supabase SQL Editor after the project has been created.

create extension if not exists pgcrypto;

create type public.employee_role as enum ('manager', 'salesperson', 'expense_reporter');
create type public.transaction_kind as enum ('sale', 'expense');
create type public.transaction_status as enum ('pending_approval', 'awaiting_allocation', 'approved');
create type public.project_code as enum ('A', 'B', 'overhead');
create type public.sync_status as enum ('pending', 'synced', 'failed');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'not_applicable');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  role public.employee_role not null,
  telegram_user_id bigint unique,
  linked_telegram_chat_id bigint,
  created_at timestamptz not null default now()
);

insert into public.employees (display_name, role) values
  ('Svetlana', 'manager'),
  ('Richard', 'salesperson'),
  ('Anastasia', 'salesperson'),
  ('Jean-Claude', 'salesperson'),
  ('Kevin', 'expense_reporter');

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^[SE][0-9]+$'),
  kind public.transaction_kind not null,
  submitted_by uuid not null references public.employees(id),
  submitted_at timestamptz not null default now(),
  originating_chat_id bigint,
  customer text,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  project public.project_code,
  category text check (category in ('Materials', 'Travel', 'Other')),
  proposed_allocation public.project_code,
  final_allocation public.project_code,
  proposed_richard_pct numeric(5,2),
  proposed_anastasia_pct numeric(5,2),
  proposed_jean_claude_pct numeric(5,2),
  approved_richard_pct numeric(5,2),
  approved_anastasia_pct numeric(5,2),
  approved_jean_claude_pct numeric(5,2),
  richard_commission numeric(12,2) not null default 0,
  anastasia_commission numeric(12,2) not null default 0,
  jean_claude_commission numeric(12,2) not null default 0,
  status public.transaction_status not null,
  sheets_sync_status public.sync_status not null default 'pending',
  sheets_sync_error text,
  approved_at timestamptz,
  approved_by uuid references public.employees(id),
  constraint sales_complete check (
    kind <> 'sale' or (
      customer is not null and project in ('A', 'B') and category is null and
      proposed_richard_pct between 0 and 100 and
      proposed_anastasia_pct between 0 and 100 and
      proposed_jean_claude_pct between 0 and 100 and
      proposed_richard_pct + proposed_anastasia_pct + proposed_jean_claude_pct = 100
    )
  ),
  constraint expenses_complete check (
    kind <> 'expense' or (
      customer is null and category is not null and proposed_allocation is not null
    )
  )
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  chat_id bigint,
  event_type text not null check (event_type in ('submission', 'sale_approval', 'expense_allocation')),
  status public.delivery_status not null default 'pending',
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(transaction_id, event_type)
);

alter table public.employees enable row level security;
alter table public.transactions enable row level security;
alter table public.notification_deliveries enable row level security;

-- The deployed server uses the service-role key. Browser clients do not directly access records.
revoke all on public.employees, public.transactions, public.notification_deliveries from anon, authenticated;
