-- SLA Hardening: Add tracking flag to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT false;
