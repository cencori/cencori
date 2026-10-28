-- Plan reminders already sent in each billing period ("ends_3", "grace", ...),
-- so the hourly job sends each one once, however late or often it runs. A new
-- pass starts a new period row, and its reminders start over.
alter table public.business_usage
    add column if not exists reminders_sent text[] not null default '{}';
