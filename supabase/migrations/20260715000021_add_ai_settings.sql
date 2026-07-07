-- Add ai_settings column to tenants table to store greeting configurations

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{
  "welcome_message_type": "fixed",
  "fixed_welcome_message": "Hi there! I am your AI assistant. How can I help you today?",
  "system_prompt": "You are a helpful AI assistant for our business. Answer questions concisely and politely."
}'::jsonb;
