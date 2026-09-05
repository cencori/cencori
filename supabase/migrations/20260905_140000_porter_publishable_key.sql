-- Keep a Porter's publishable key where it can be shown again.
--
-- Provisioning mints a key, returns it once, and stores only its hash -- which is right for a
-- secret key and wrong for this one. A publishable key is designed to sit in the page source of the
-- customer's own website, is domain locked at the gateway, and is worthless anywhere else. Showing
-- it a second time gives away nothing that reading the customer's HTML would not.
--
-- Without this there is no snippet. The console can tell someone a Porter exists and never tell
-- them the line to paste, which makes the product something a person on our side has to set up by
-- hand.
--
-- Only the Porter's own key lives here. The api_keys table keeps hashing everything, secret keys
-- included, and nothing about how those are stored changes. Whether every publishable key on the
-- platform should be re-displayable is a larger question than this column answers.

alter table public.porters
    add column if not exists publishable_key text;

comment on column public.porters.publishable_key is
    'The publishable key that belongs in this Porter''s snippet. Safe to display: it is domain locked and meant to be public.';
