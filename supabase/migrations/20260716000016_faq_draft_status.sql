-- Migration: Add status column to FAQs to prevent hallucination loops
-- This ensures that Auto-FAQ Miner generated FAQs don't go live immediately.

ALTER TABLE faqs 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'published' 
CHECK (status IN ('published', 'draft', 'rejected'));
