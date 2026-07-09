DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='messages' AND column_name='is_internal'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN is_internal BOOLEAN DEFAULT false;
  END IF;
END $$;
