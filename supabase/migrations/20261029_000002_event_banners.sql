-- An event's banner or flyer: shown at the top of its ticket page and as the
-- picture when the link is shared. A URL on our own file store (event-banners).
alter table public.studio_events add column if not exists banner_url text;
