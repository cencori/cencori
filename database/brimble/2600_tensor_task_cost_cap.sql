-- Each task may spend at most a quarter of its plan's monthly limit. Before this, a plan's tasks had
-- no limit of their own (task_cost_cap_microusd was null), so one long task could spend a whole
-- month's allowance by itself. A task's cap is copied onto its reservation when it starts
-- (basecode_reserve_turn), so tasks already running keep the cap they started with; and the gateway
-- refuses the task's next model call once it is reached ("task_cost_limit"), which ends the turn.
--
-- Rows only, no change to the table: an update takes row locks, which do not wait behind the
-- database's backups the way an ALTER does (see 2100).

update public.basecode_plans
set task_cost_cap_microusd = pass_budget_microusd / 4
where pass_budget_microusd is not null
  and pass_budget_microusd > 0;
