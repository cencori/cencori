-- Fix wallet debits: credit_transactions.reference_id is UUID-typed, but every
-- writer passes TEXT (gateway request UUIDs, memory-upload:<upload>:<batch>
-- refs, agent test UUIDs). A typed plpgsql TEXT parameter has no implicit cast
-- to UUID, so deduct_organization_credits and store_memory_batch_and_charge
-- fail with 42804 (column "reference_id" is of type uuid but expression is of
-- type text) on every real debit. Observable symptom: zero 'usage' rows have
-- ever been written and no wallet has ever been debited.
--
-- Widen the column to TEXT; existing UUIDs convert losslessly and every
-- caller already binds TEXT.
ALTER TABLE public.credit_transactions
    ALTER COLUMN reference_id TYPE text USING reference_id::text;
