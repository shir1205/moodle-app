
CREATE TABLE IF NOT EXISTS public.assignments (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
    instructions TEXT NOT NULL DEFAULT '',
    due_date TIMESTAMPTZ NOT NULL,
    max_grade INTEGER NOT NULL DEFAULT 100 CHECK (max_grade >= 1),
    allowed_formats TEXT[] NOT NULL DEFAULT ARRAY['.pdf', '.zip'],
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.assignments
ENABLE ROW LEVEL SECURITY;
