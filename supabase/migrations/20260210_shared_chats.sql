create table if not exists shared_chats (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  title text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Enable RLS
alter table shared_chats enable row level security;

-- Allow anyone to read shared chats (public access)
create policy "Public chats are viewable by everyone" 
  on shared_chats for select 
  using (true);

-- Allow authenticated users to insert (sharing their own chat)
create policy "Users can insert their own chats" 
  on shared_chats for insert 
  with check (auth.uid() = user_id);

-- Start with allowing public insert for unauthenticated users too (if we want anonymous sharing)
-- For now let's restrict to authenticated users or just allow anon insert if `user_id` is null?
-- The plan didn't specify strict auth. Let's allow public insert for now to support all users.
create policy "Anyone can insert chats" 
  on shared_chats for insert 
  with check (true);
