-- Add catalog_id to tenant_bsp_config
ALTER TABLE tenant_bsp_config ADD COLUMN IF NOT EXISTS catalog_id text;

-- Update the message_type constraint on messages
DO $$
BEGIN
  -- Try dropping the default constraint name
  BEGIN
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  -- Add the new constraint with 'order' and 'catalog'
  ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
    CHECK (message_type IN ('text','image','document','audio','template','interactive','catalog','order'));
END $$;
