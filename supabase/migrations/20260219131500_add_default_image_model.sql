-- Migration to add default_image_model to projects table
-- This allows users to save their preferred image generation model in the BYOK flow.

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS default_image_model text;

-- Add a comment to the column for documentation
COMMENT ON COLUMN public.projects.default_image_model IS 'The default AI model to use for image generation tasks within this project';
