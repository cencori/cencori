-- Retire OpenRouter as a provider (removed 2026-09-23).
--
-- With the free tier retired, OpenRouter was purely a paid proxy whose margin
-- stacked on Cencori's markup. DeepSeek, Kimi and Qwen move to direct provider
-- keys; the frontier dupes (GPT-5, Opus 4.5, Gemini, Grok) were already served
-- direct. The catalog block, router overrides, endpoint and managed key are
-- gone alongside this.
--
-- Deactivate rather than delete: ai_requests rows still reference these model
-- names historically, and cost re-computation over old logs must keep resolving
-- the price that applied at the time.
--
-- Also deletes the gpt-oss → openrouter model_mappings rows from
-- 20260910_120000: failover resolves mappings at runtime, and a mapping that
-- points at an unregistered provider is a dead end. Groq failover falls back
-- to its default provider chain.

UPDATE model_pricing
SET is_active = false,
    review_notes = 'Retired 2026-09-23: OpenRouter removed as a provider; open-weight models move to direct keys.',
    updated_at = NOW()
WHERE provider = 'openrouter'
  AND model_name IN (
    'openai/gpt-5',
    'anthropic/claude-opus-4.5',
    'google/gemini-3.1-pro-preview',
    'x-ai/grok-4.3',
    'x-ai/grok-4.6',
    'deepseek/deepseek-v4-pro',
    'deepseek/deepseek-v4-flash',
    'moonshotai/kimi-k3',
    'moonshotai/kimi-k2.7-code',
    'moonshotai/kimi-k2.6',
    'qwen/qwen3.8-max',
    'qwen/qwen3-coder-plus',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b'
  );

DELETE FROM public.model_mappings
WHERE target_provider = 'openrouter';
