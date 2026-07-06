-- Add AI Handoff Summarization fields
alter table conversations add column if not exists handover_summary text;
alter table conversations add column if not exists handover_reason text;
