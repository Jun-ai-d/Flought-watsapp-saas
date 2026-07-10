-- Add interaction_history array to contacts table for long-term AI memory

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS interaction_history jsonb[] DEFAULT '{}';
