-- Migración para registro de aceptación de términos y condiciones
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='terms_accepted') THEN
        ALTER TABLE users ADD COLUMN terms_accepted BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='terms_accepted_at') THEN
        ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMPTZ;
    END IF;
END $$;
