-- ============================================================================
-- CampuScope - Story #7 (4.3.1 At-Risk Students) Demo Seed Data (Idempotent)
-- ============================================================================
-- Part A: Uses ONLY existing Supabase tables & columns:
--   - public.users (id, email, full_name, role)
--   - public.assignments (id, course_id, unit_id, title, instructions, due_date, max_grade, allowed_formats, status)
--   - public.submissions (id, assignment_id, student_id, file_name, file_url, status, submitted_at, updated_at)
--   - public.submission_grades (submission_id, grade, feedback, published_at)
--
-- Note: If public.users has a foreign key to auth.users(id), ensure matching
-- auth users exist first or replace these UUIDs with existing student UUIDs.
-- ============================================================================

INSERT INTO public.users (id, email, full_name, role)
VALUES
    ('11111111-1111-4111-8111-111111111101', 'atrisk.missed@campuscope.ac.il', 'אלון מזרחי', 'student'),
    ('11111111-1111-4111-8111-111111111102', 'healthy.student@campuscope.ac.il', 'דנה כהן', 'student'),
    ('11111111-1111-4111-8111-111111111103', 'borderline.student@campuscope.ac.il', 'נועה לביא', 'student')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assignments (id, course_id, unit_id, title, instructions, due_date, max_grade, allowed_formats, status)
VALUES
    ('assign-risk-01', 'course-1', 'unit-1', 'מטלה 1: רקורסיה', 'פתרון תרגילי רקורסיה', '2026-11-10T23:59:00Z', 100, ARRAY['.pdf', '.zip'], 'published'),
    ('assign-risk-02', 'course-1', 'unit-1', 'מטלה 2: רשימות מקושרות', 'מימוש רשימה מקושרת', '2026-11-17T23:59:00Z', 100, ARRAY['.pdf', '.zip'], 'published'),
    ('assign-risk-03', 'course-1', 'unit-2', 'מטלה 3: עצים בינאריים', 'אלגוריתמי סריקה על BST', '2026-11-22T23:59:00Z', 100, ARRAY['.pdf', '.zip'], 'published'),
    ('assign-risk-04', 'course-1', 'unit-2', 'מטלה 4: טבלאות גיבוב', 'מטלה עתידית (לא נחשבת כאיחור)', '2026-12-20T23:59:00Z', 100, ARRAY['.pdf', '.zip'], 'published')
ON CONFLICT (id) DO NOTHING;

-- Healthy student (11111111-1111-4111-8111-111111111102): submitted all 3 past-due assignments with high grades -> NOT at risk
-- Low-grade student (11111111-1111-4111-8111-111111111103): submitted 2 of 3 past-due assignments (1 missed < 2), avg 47.5 (< 60) -> AT RISK (low grade)
-- Missed-assignments student (11111111-1111-4111-8111-111111111101): 0 submissions (3 missed >= 2) -> AT RISK (missed assignments)
INSERT INTO public.submissions (id, assignment_id, student_id, file_name, file_url, status, submitted_at, updated_at)
VALUES
    ('sub-risk-01', 'assign-risk-01', '11111111-1111-4111-8111-111111111102', 'hw1_dana.pdf', 'https://example.com/hw1_dana.pdf', 'submitted', '2026-11-09T18:00:00Z', '2026-11-09T18:00:00Z'),
    ('sub-risk-02', 'assign-risk-02', '11111111-1111-4111-8111-111111111102', 'hw2_dana.pdf', 'https://example.com/hw2_dana.pdf', 'submitted', '2026-11-16T18:00:00Z', '2026-11-16T18:00:00Z'),
    ('sub-risk-03', 'assign-risk-03', '11111111-1111-4111-8111-111111111102', 'hw3_dana.pdf', 'https://example.com/hw3_dana.pdf', 'submitted', '2026-11-21T18:00:00Z', '2026-11-21T18:00:00Z'),
    ('sub-risk-04', 'assign-risk-01', '11111111-1111-4111-8111-111111111103', 'hw1_noa.pdf', 'https://example.com/hw1_noa.pdf', 'submitted', '2026-11-09T19:00:00Z', '2026-11-09T19:00:00Z'),
    ('sub-risk-05', 'assign-risk-02', '11111111-1111-4111-8111-111111111103', 'hw2_noa.pdf', 'https://example.com/hw2_noa.pdf', 'submitted', '2026-11-16T19:00:00Z', '2026-11-16T19:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.submission_grades (submission_id, grade, feedback, published_at)
VALUES
    ('sub-risk-01', 88, 'פתרון נקי ומדויק', '2026-11-12T10:00:00Z'),
    ('sub-risk-02', 92, 'מימוש מצוין של רשימה מקושרת', '2026-11-19T10:00:00Z'),
    ('sub-risk-03', 85, 'עבודה טובה מאוד', '2026-11-24T10:00:00Z'),
    ('sub-risk-04', 45, 'חסרים תנאי עצירה ומקרי קצה', '2026-11-12T11:00:00Z'),
    ('sub-risk-05', 50, 'נדרשת השלמה של בדיקות קצה', '2026-11-19T11:00:00Z')
ON CONFLICT (submission_id) DO NOTHING;

-- ============================================================================
-- Part B (TODO - Team 2 Schema): Uncomment / adapt once Team 2 adds
-- 'courses', 'enrollments', and 'course_lecturers' tables.
-- ============================================================================
-- CREATE TABLE IF NOT EXISTS public.enrollments (
--     course_id TEXT NOT NULL,
--     student_id UUID NOT NULL,
--     PRIMARY KEY (course_id, student_id)
-- );
-- INSERT INTO public.enrollments (course_id, student_id)
-- VALUES
--     ('course-1', '11111111-1111-4111-8111-111111111101'),
--     ('course-1', '11111111-1111-4111-8111-111111111102'),
--     ('course-1', '11111111-1111-4111-8111-111111111103')
-- ON CONFLICT DO NOTHING;
