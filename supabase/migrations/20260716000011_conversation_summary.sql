-- Add summary column to conversations for long-term memory
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS summary TEXT;
