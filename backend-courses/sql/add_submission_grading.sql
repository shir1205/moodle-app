BEGIN;

-- Preserve the submission ID when a student replaces a file.
ALTER TABLE public.submissions
    ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

CREATE UNIQUE INDEX IF NOT EXISTS submissions_assignment_student_unique
    ON public.submissions (assignment_id, student_id);

CREATE OR REPLACE FUNCTION public.save_assignment_submission(
    p_assignment_id text,
    p_student_id text,
    p_file_name text,
    p_file_url text,
    p_submitted_at timestamptz
)
RETURNS SETOF public.submissions
LANGUAGE sql
SECURITY INVOKER
AS $$
    INSERT INTO public.submissions (
        assignment_id, student_id, file_name, file_url,
        status, submitted_at, updated_at
    )
    VALUES (
        p_assignment_id, p_student_id, p_file_name, p_file_url,
        'submitted', p_submitted_at, p_submitted_at
    )
    ON CONFLICT (assignment_id, student_id)
    DO UPDATE SET
        file_name = EXCLUDED.file_name,
        file_url = EXCLUDED.file_url,
        submitted_at = EXCLUDED.submitted_at,
        updated_at = EXCLUDED.updated_at
    RETURNING *;
$$;

REVOKE EXECUTE ON FUNCTION public.save_assignment_submission(
    text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_assignment_submission(
    text, text, text, text, timestamptz
) TO service_role;

CREATE TABLE IF NOT EXISTS public.submission_grades (
    submission_id text PRIMARY KEY REFERENCES public.submissions(id),
    grade numeric NOT NULL CHECK (grade >= 0),
    feedback text NOT NULL DEFAULT '',
    published_at timestamptz
);

ALTER TABLE public.submission_grades ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.submission_grades
    FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.submission_grades
    TO service_role;

CREATE TABLE IF NOT EXISTS public.course_lecturers (
    course_id text NOT NULL,
    lecturer_id uuid NOT NULL REFERENCES public.users(id),
    PRIMARY KEY (course_id, lecturer_id)
);

ALTER TABLE public.course_lecturers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.course_lecturers
    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.course_lecturers TO service_role;

COMMIT;