-- Web request logs: richer metadata for request detail dialogs

alter table public.web_request_logs
    add column if not exists metadata jsonb;

comment on column public.web_request_logs.metadata is 'Structured middleware context (runtime, scope, headers, and deployment hints)';
