DO $$ 
BEGIN 
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations;
  EXCEPTION 
    WHEN duplicate_object THEN 
      NULL; 
  END; 
END $$;
