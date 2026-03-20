-- ═══════════════════════════════════════════════
-- BACKFILL: Populate audit_logs from existing historical data
-- Run this AFTER 024_organization_audit_logs.sql has created the table
-- Safe to run multiple times (but will create duplicates — only run once)
-- ═══════════════════════════════════════════════

-- 1. Backfill from security_audit_log (admin events with actor info)
INSERT INTO audit_logs (organization_id, project_id, category, action, resource_type, resource_id, actor_id, actor_email, actor_ip, actor_type, description, metadata, created_at)
SELECT
    p.organization_id,
    sal.project_id,
    CASE sal.event_type
        WHEN 'api_key_created' THEN 'api_key'
        WHEN 'api_key_deleted' THEN 'api_key'
        WHEN 'api_key_rotated' THEN 'api_key'
        WHEN 'webhook_created' THEN 'webhook'
        WHEN 'webhook_deleted' THEN 'webhook'
        WHEN 'settings_updated' THEN 'settings'
        WHEN 'incident_reviewed' THEN 'security'
        WHEN 'ip_blocked' THEN 'security'
        WHEN 'rate_limit_exceeded' THEN 'security'
        WHEN 'auth_failed' THEN 'security'
        ELSE 'settings'
    END,
    CASE sal.event_type
        WHEN 'api_key_created' THEN 'created'
        WHEN 'api_key_deleted' THEN 'deleted'
        WHEN 'api_key_rotated' THEN 'updated'
        WHEN 'webhook_created' THEN 'created'
        WHEN 'webhook_deleted' THEN 'deleted'
        WHEN 'settings_updated' THEN 'updated'
        WHEN 'incident_reviewed' THEN 'reviewed'
        WHEN 'ip_blocked' THEN 'updated'
        WHEN 'rate_limit_exceeded' THEN 'updated'
        WHEN 'auth_failed' THEN 'updated'
        ELSE 'updated'
    END,
    CASE sal.event_type
        WHEN 'api_key_created' THEN 'api_key'
        WHEN 'api_key_deleted' THEN 'api_key'
        WHEN 'api_key_rotated' THEN 'api_key'
        WHEN 'webhook_created' THEN 'webhook'
        WHEN 'webhook_deleted' THEN 'webhook'
        WHEN 'incident_reviewed' THEN 'security_incident'
        ELSE 'project_settings'
    END,
    NULL,
    sal.actor_id,
    sal.actor_email,
    sal.actor_ip,
    'user',
    COALESCE(sal.event_type, 'unknown') || ' (backfilled)',
    COALESCE(sal.details, '{}'),
    sal.created_at
FROM security_audit_log sal
JOIN projects p ON p.id = sal.project_id;

-- 2. Backfill from security_incidents
INSERT INTO audit_logs (organization_id, project_id, category, action, resource_type, resource_id, actor_type, description, metadata, created_at)
SELECT
    p.organization_id,
    si.project_id,
    'security',
    'created',
    'security_incident',
    si.id::text,
    'system',
    si.incident_type || ': ' || COALESCE(LEFT(si.description, 120), 'Security incident') || ' (backfilled)',
    jsonb_build_object(
        'severity', si.severity,
        'risk_score', si.risk_score,
        'action_taken', si.action_taken,
        'source', 'security_incidents_backfill'
    ),
    si.created_at
FROM security_incidents si
JOIN projects p ON p.id = si.project_id;

-- 3. Backfill from platform_events (operational events)
INSERT INTO audit_logs (organization_id, project_id, category, action, resource_type, resource_id, actor_id, actor_type, description, metadata, created_at)
SELECT
    COALESCE(pe.organization_id, p.organization_id),
    pe.project_id,
    CASE
        WHEN pe.event_type LIKE 'api_key%' THEN 'api_key'
        WHEN pe.event_type LIKE 'webhook%' THEN 'webhook'
        WHEN pe.event_type LIKE 'prompt%' THEN 'prompt'
        WHEN pe.event_type LIKE 'provider%' OR pe.event_type LIKE 'org.provider%' THEN 'provider'
        WHEN pe.event_type LIKE 'custom_rule%' THEN 'security'
        WHEN pe.event_type LIKE 'cache%' THEN 'cache'
        WHEN pe.event_type LIKE 'subscription%' THEN 'billing'
        WHEN pe.event_type LIKE 'credits%' THEN 'billing'
        WHEN pe.event_type LIKE 'org.invite%' OR pe.event_type LIKE 'user.invite%' THEN 'member'
        WHEN pe.event_type LIKE 'scan%' THEN 'integration'
        ELSE 'settings'
    END,
    CASE
        WHEN pe.event_type LIKE '%.created' OR pe.event_type LIKE '%.generated' OR pe.event_type LIKE '%.triggered' THEN 'created'
        WHEN pe.event_type LIKE '%.deleted' OR pe.event_type LIKE '%.removed' THEN 'deleted'
        WHEN pe.event_type LIKE '%.revoked' THEN 'revoked'
        WHEN pe.event_type LIKE '%.canceled' THEN 'deactivated'
        WHEN pe.event_type LIKE '%.deployed' THEN 'deployed'
        WHEN pe.event_type LIKE '%.topup' THEN 'topup'
        WHEN pe.event_type LIKE '%invite_sent' OR pe.event_type LIKE '%invite_accepted' THEN 'invited'
        WHEN pe.event_type LIKE '%.completed' OR pe.event_type LIKE '%.applied' THEN 'updated'
        ELSE 'created'
    END,
    CASE
        WHEN pe.event_type LIKE 'api_key%' THEN 'api_key'
        WHEN pe.event_type LIKE 'webhook%' THEN 'webhook'
        WHEN pe.event_type LIKE 'prompt%' THEN 'prompt'
        WHEN pe.event_type LIKE 'provider%' OR pe.event_type LIKE 'org.provider%' THEN 'custom_provider'
        WHEN pe.event_type LIKE 'custom_rule%' THEN 'custom_rule'
        WHEN pe.event_type LIKE 'cache%' THEN 'cache_settings'
        WHEN pe.event_type LIKE 'subscription%' THEN 'subscription'
        WHEN pe.event_type LIKE 'credits%' THEN 'credits'
        WHEN pe.event_type LIKE '%invite%' THEN 'member'
        WHEN pe.event_type LIKE 'scan%' THEN 'scan'
        ELSE 'project'
    END,
    NULL,
    pe.user_id,
    CASE WHEN pe.product = 'billing' THEN 'webhook' ELSE 'user' END,
    pe.event_type || ' (backfilled)',
    COALESCE(pe.metadata, '{}'),
    pe.created_at
FROM platform_events pe
LEFT JOIN projects p ON p.id = pe.project_id
WHERE COALESCE(pe.organization_id, p.organization_id) IS NOT NULL;

-- 4. Backfill from credit_transactions
INSERT INTO audit_logs (organization_id, category, action, resource_type, resource_id, actor_type, description, metadata, created_at)
SELECT
    ct.organization_id,
    'billing',
    'topup',
    'credits',
    ct.id::text,
    'system',
    'Credit transaction: $' || ct.amount::text || ' (backfilled)',
    jsonb_build_object(
        'amount', ct.amount,
        'transaction_type', ct.transaction_type,
        'description', ct.description,
        'source_table', 'credit_transactions_backfill'
    ),
    ct.created_at
FROM credit_transactions ct
WHERE ct.organization_id IS NOT NULL;
