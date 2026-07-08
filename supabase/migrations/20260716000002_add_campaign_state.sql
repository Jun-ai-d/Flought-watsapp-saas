ALTER TABLE drip_enrollments ADD COLUMN current_step_order INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drip_enrollments ADD COLUMN next_step_at TIMESTAMPTZ DEFAULT now();
