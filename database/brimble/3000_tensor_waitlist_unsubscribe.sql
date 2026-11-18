-- Unsubscribing from emails to the Tensor waitlist.
--
-- Most of the waitlist has no Cencori account, so the account's email preferences cannot serve
-- them. The link in an email's footer sets this instead (app/api/tensor/waitlist/unsubscribe),
-- and a send to the waitlist leaves out anyone who has it set.

alter table public.tensor_waitlist
  add column if not exists unsubscribed_at timestamptz;

comment on column public.tensor_waitlist.unsubscribed_at is
  'When this person asked for no more email, from the link in an email''s footer.';
