-- Tensor quota retune (2026-10-04).
--
-- Free/auto stays request-counted but pinned to cheap weak models server-side
-- (deepseek-v4-flash + maximo atlas), so a request cap is a cost cap:
-- 15 req/wk x ~$0.007 medium turn = ~$0.11/wk worst case per free user.
--
-- Builder ₦5k $0.25 -> $0.50/wk (~12 glm-5.3-flash / ~38 v4-pro medium turns).
-- At ₦5k net ~$3.10/mo, max cost $2.17/mo, profitable even at 100% use.
--
-- Pro ₦15k $1.00 -> $2.00/wk (~21 gpt-6-sol / ~10 opus-5-5 medium turns).
-- At ₦15k net ~$9.50/mo, max cost $8.67/mo, margin from breakage.

update public.basecode_plans
set weekly_request_limit = 15, updated_at = now()
where code = 'free';

update public.basecode_plans
set weekly_budget_microusd = 500000, updated_at = now()
where code = 'builder';

update public.basecode_plans
set weekly_budget_microusd = 2000000, updated_at = now()
where code = 'pro';
