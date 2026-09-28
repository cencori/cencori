-- Data-plane split: one round trip for the whole per-project gateway config.
--
-- The chat hot path used to fan out ~8 serial Supabase REST reads per request
-- (network policy, security settings, custom rules, failover settings, BYOK
-- keys, embedded fallback keys, cache settings). This RPC returns them all as
-- a single JSON bundle. The gateway warmer fetches it once per project per
-- minute (packed Redis blob + instance-local seeding); per-concern readers
-- then hit memory instead of the network.
--
-- Control plane owns the tables; the data plane reads through this function.
-- Callers use the service-role client. Failover semantics are preserved by
-- the warmer: dashboard rows (including inactive ones) win over embedded
-- fallback rows exactly as resolveProviderKeyRow does.

create or replace function public.gateway_project_config(p_project_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
    select jsonb_build_object(
        'network', (
            select to_jsonb(t)
            from (
                select access_mode, allowed_cidrs
                from public.project_network_policies
                where project_id = p_project_id
            ) t
        ),
        'security', (
            select to_jsonb(t)
            from (
                select safety_threshold, filter_jailbreaks, filter_pii, filter_prompt_injection
                from public.security_settings
                where project_id = p_project_id
            ) t
        ),
        'custom_rules', (
            select coalesce(jsonb_agg(to_jsonb(t) order by priority desc), '[]'::jsonb)
            from (
                select id, project_id, name, description, match_type, pattern,
                    case_sensitive, action, is_active, priority
                from public.custom_data_rules
                where project_id = p_project_id
                    and is_active = true
                order by priority desc
            ) t
        ),
        'failover', (
            select to_jsonb(t)
            from (
                select enable_fallback, fallback_provider, fallback_model,
                    max_retries_before_fallback, circuit_breaker_enabled,
                    circuit_breaker_failure_threshold, circuit_breaker_timeout_seconds
                from public.project_settings
                where project_id = p_project_id
            ) t
        ),
        'provider_keys', (
            select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
            from (
                select provider, encrypted_key, key_hint, is_active, default_model
                from public.provider_keys
                where project_id = p_project_id
            ) t
        ),
        'embedded_keys', (
            select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
            from (
                select id, provider, status, base_url, encrypted_key_ref, key_hint, created_at
                from public.provider_connections
                where project_id = p_project_id
                    and status = 'active'
                    and encrypted_key_ref is not null
                order by created_at desc
                limit 25
            ) t
        ),
        'cache_settings', (
            select to_jsonb(t)
            from (
                select cache_enabled, exact_match_enabled, semantic_match_enabled,
                    ttl_seconds, similarity_threshold, max_entries, excluded_models,
                    max_cacheable_temperature
                from public.prompt_cache_settings
                where project_id = p_project_id
            ) t
        )
    );
$$;

revoke all on function public.gateway_project_config(uuid) from public;
grant execute on function public.gateway_project_config(uuid) to service_role;

comment on function public.gateway_project_config(uuid) is
    'Data-plane reader: whole per-project gateway config in one round trip. Warmed into the packed cache blob; control-plane writes invalidate it.';
