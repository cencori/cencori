-- Migration to add 'tokenize' to allowed actions in custom_data_rules
-- Run this in Supabase SQL Editor or via CLI

DO $$
BEGIN
    -- Drop the existing constraint if it exists. 
    -- We try to guess the name, but if it was auto-generated differently, this might need manual adjustment.
    -- Standard naming convention for unnamed check constraint: <table>_<column>_check
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_data_rules_action_check') THEN
        ALTER TABLE custom_data_rules DROP CONSTRAINT custom_data_rules_action_check;
    END IF;
    
    -- Re-add the constraint with 'tokenize' included
    ALTER TABLE custom_data_rules ADD CONSTRAINT custom_data_rules_action_check 
    CHECK (action IN ('mask', 'redact', 'block', 'tokenize'));
END $$;
