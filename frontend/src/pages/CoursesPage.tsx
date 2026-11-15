/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CourseService } from '../services/courseService';
import { AnalyticsService } from '../services/analyticsService';
import { CourseCard } from '../components/common/CourseCard';
import { EmptyState } from '../components/common/EmptyState';
import { ROLES } from '../config/constants';
import { BookOpen, Plus, Search, Filter } from 'lucide-react';

export const CoursesPage: React.FC = () => {
  const { currentUser, role } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  const courses = CourseService.getCoursesForUser(
    currentUser?.id || '',
    role || ROLES.STUDENT,
    currentUser?.assignedCourseIds || []
  );

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.includes(searchQuery) || c.code.toLowerCase().includes(searchQuery.toLowerCase()) || c.description.includes(searchQuery);
    const matchesDept = selectedDept === 'all' || c.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  // Calculate student course progress if student
  const getProgress = (courseId: string) => {
    if (role !== ROLES.STUDENT || !currentUser) return undefined;
    const p = AnalyticsService.getStudentCourseProgress(currentUser.id, courseId);
    return p.completionRatePercent;
  };

  const departments = ['all', ...Array.from(new Set(courses.map((c) => c.department)))];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {role === ROLES.LECTURER
              ? 'הקורסים בהוראתי'
              : role === ROLES.TA
              ? 'הקורסים לתרגול ובדיקה'
              : role === ROLES.ADMIN
              ? 'ניהול כלל קורסי המכללה'
              : 'הקורסים שלי'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {role === ROLES.STUDENT
              ? 'חומרי למידה, מטלות פתוחות, משובים ועוזר AI אישי לכל קורס'
              : role === ROLES.ADMIN
              ? 'פתיחת קורסים, הקצאת מרצים, ניהול סילבוס ובקרה מוסדית'
              : 'ניהול יחידות לימוד, העלאת חומרים, בדיקת מטלות ומעקב ציונים'}
          </p>
        </div>

        {role === ROLES.ADMIN && (
          <Link
            to="/admin/create-course"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>פתיחת קורס חדש (Admin בלבד)</span>
          </Link>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש קורס לפי שם או קוד..."
            className="w-full ps-9 pe-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">כל המחלקות</option>
            {departments.filter((d) => d !== 'all').map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              progressPercent={getProgress(course.id)}
              userRole={role || ROLES.STUDENT}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="לא נמצאו קורסים מתאימים"
          description="נסה לשנות את מונחי החיפוש או הסינון."
          actionText="אפס חיפוש"
          onAction={() => {
            setSearchQuery('');
            setSelectedDept('all');
          }}
        />
      )}
    </div>
  );
};
