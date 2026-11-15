/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Course } from '../../types';
import { BookOpen, User as UserIcon, Sparkles } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  progressPercent?: number;
  userRole?: string;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, progressPercent, userRole }) => {
  const [imageError, setImageError] = useState(false);

  // Compute counts
  const unitsCount = course.units.length;
  let materialsCount = 0;
  course.units.forEach((u) => {
    materialsCount += u.materials.length;
  });

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group relative flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {/* Course Banner Cover with Gradient Overlay & Course Title On Top */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
        {!imageError ? (
          <img
            src={course.coverImage}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: course.fallbackGradient }}
          />
        )}

        {/* Dual-layer scrim for maximum contrast and elegance */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-black/20" />

        {/* Top Badges: Course Code & Accent dot */}
        <div className="absolute top-3.5 inset-x-4 flex items-center justify-between z-10">
          <span className="text-xs font-mono font-semibold tracking-wide text-white/95 px-2.5 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
            {course.code}
          </span>
          <span
            className="w-3 h-3 rounded-full border-2 border-white/80 shadow"
            style={{ backgroundColor: course.accentColor }}
            title="צבע זיהוי הקורס"
          />
        </div>

        {/* Course Title On Top of Image */}
        <div className="absolute bottom-3 inset-x-4 z-10">
          <h3 className="text-lg font-bold text-white leading-snug line-clamp-2 drop-shadow-sm group-hover:text-indigo-200 transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-1">
            <UserIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>{course.lecturerName}</span>
          </p>
        </div>
      </div>

      {/* Course Content Details */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">
          {course.description}
        </p>

        {/* Metadata in clean unboxed typography (zero-pill discipline) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>{unitsCount} יחידות לימוד</span>
              <span aria-hidden="true">·</span>
              <span>{materialsCount} חומרים</span>
            </span>
            <span>{course.semester}</span>
          </div>

          {/* Student Progress Bar (if student) */}
          {userRole === 'student' && typeof progressPercent === 'number' && (
            <div className="mt-2">
              <div className="flex justify-between items-center text-xs font-medium mb-1">
                <span className="text-slate-500 dark:text-slate-400">התקדמות בקורס</span>
                <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Quick AI Assistant cue */}
          <div className="mt-3 flex items-center justify-end">
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 group-hover:underline">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>כניסה לקורס ולעוזר ה-AI &larr;</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};
