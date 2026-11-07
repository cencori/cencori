-- Tensor tasks run to completion: drop the per-task cost cap on every plan.
--
-- The cap ended tasks mid-way with "This task has reached the size limit for your plan", often
-- before the agent wrote anything, and the user was left with no answer. Spend stays bounded by
-- each plan's period budget (pass_budget_microusd) and its task count, which are unchanged.
--
-- basecode_gateway_access already treats a null cap as "no cap", so no function changes.

begin;

update public.basecode_plans
set task_cost_cap_microusd = null
where task_cost_cap_microusd is not null;

-- Tasks already running copied the cap when they were reserved; lift it from them too.
update public.basecode_turn_reservations
set cost_cap_microusd = null
where cost_cap_microusd is not null
  and status in ('reserved', 'running');

comment on column public.basecode_plans.task_cost_cap_microusd is
  'Unused since 2026-11-07: tasks run to completion. Null means no per-task cap.';

commit;
