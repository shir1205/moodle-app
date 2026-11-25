-- Task #184: הבטחת עמודת role עם ברירת מחדל 'student' והגבלה לתפקידים מותרים
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';

ALTER TABLE public.users
ALTER COLUMN role SET DEFAULT 'student';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('student', 'lecturer', 'admin'));
    END IF;
END $$;