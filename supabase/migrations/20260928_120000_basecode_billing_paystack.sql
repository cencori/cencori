-- Migrate Basecode NGN collection from Flutterwave to Paystack.
--
-- New checkouts and webhook events are written with provider = 'paystack'.
-- 'flutterwave' stays in every check so historical rows keep validating;
-- dropping it would violate the constraint on existing data.

alter table public.basecode_billing_customers
  drop constraint if exists basecode_billing_customers_provider_check;
alter table public.basecode_billing_customers
  add constraint basecode_billing_customers_provider_check
  check (provider in ('flutterwave', 'paystack', 'bachs'));

alter table public.basecode_checkout_sessions
  drop constraint if exists basecode_checkout_sessions_provider_check;
alter table public.basecode_checkout_sessions
  add constraint basecode_checkout_sessions_provider_check
  check (provider in ('flutterwave', 'paystack', 'bachs'));

alter table public.basecode_payments
  drop constraint if exists basecode_payments_provider_check;
alter table public.basecode_payments
  add constraint basecode_payments_provider_check
  check (provider in ('flutterwave', 'paystack', 'bachs'));

alter table public.basecode_subscriptions
  drop constraint if exists basecode_subscriptions_provider_check;
alter table public.basecode_subscriptions
  add constraint basecode_subscriptions_provider_check
  check (provider in ('flutterwave', 'paystack', 'bachs', 'manual'));

alter table public.basecode_webhook_events
  drop constraint if exists basecode_webhook_events_provider_check;
alter table public.basecode_webhook_events
  add constraint basecode_webhook_events_provider_check
  check (provider in ('flutterwave', 'paystack', 'bachs'));
