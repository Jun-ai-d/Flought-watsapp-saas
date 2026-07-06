-- Phase 17: Rich Media Templates Schema Updates

ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS header_type TEXT CHECK (header_type IN ('text', 'image', 'video', 'document')),
ADD COLUMN IF NOT EXISTS header_content TEXT,
ADD COLUMN IF NOT EXISTS footer TEXT,
ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]'::jsonb;
