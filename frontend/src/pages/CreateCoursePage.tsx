/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CourseService } from '../services/courseService';
import { THEME_COLORS } from '../config/constants';
import { BookOpen, Plus, ArrowRight } from 'lucide-react';

export const CreateCoursePage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const lecturers = allUsers.filter((u) => u.role === 'lecturer');
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('מדעי המחשב');
  const [semester, setSemester] = useState('סמסטר א׳ תשפ״ו');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>(
    lecturers.length > 0 ? lecturers[0].id : 'user-lecturer-1'
  );
  const [accentColor, setAccentColor] = useState<string>(THEME_COLORS.PRIMARY);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim()) {
      setError('נא למלא שם קורס וקוד קורס');
      return;
    }

    const lecturer = allUsers.find((u) => u.id === selectedLecturerId) || {
      id: 'user-lecturer-1',
      name: 'ד"ר מיכל לוי',
    };

    const newCourse = CourseService.createCourse({
      title: title.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      department,
      semester,
      lecturerId: lecturer.id,
      lecturerName: lecturer.name,
      accentColor,
    });

    showToast(`הקורס "${newCourse.title}" נוצר בהצלחה והוקצה למרצה ${lecturer.name}!`, 'success');
    navigate(`/courses/${newCourse.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold mb-2">
          הרשאות מנהל מערכת בלבד (Admin)
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <span>פתיחת קורס אקדמי חדש</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          הגדרת קורס מוסדי חדש, שיוך מרצה אחראי, פתיחת סילבוס שבועי והעלאת חומרי הוראה
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                שם הקורס המלא <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="למשל: תכנות מונחה עצמים ב-Java"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                קוד קורס <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="CS105"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              תיאור הקורס ומטרותיו
            </label>
            <textarea
              rows={3}
              placeholder="נושאי הקורס, מודלים, דרישות קדם..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                מחלקה
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="מדעי המחשב">מדעי המחשב</option>
                <option value="הנדסת תוכנה">הנדסת תוכנה</option>
                <option value="מתמטיקה">מתמטיקה</option>
                <option value="מערכות מידע">מערכות מידע</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                סמסטר ושנת לימודים
              </label>
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              מרצה אחראי לקורס
            </label>
            <select
              value={selectedLecturerId}
              onChange={(e) => setSelectedLecturerId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {lecturers.map((lec) => (
                <option key={lec.id} value={lec.id}>
                  {lec.name} ({lec.email}) - {lec.department}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              צבע מיתוג לקורס
            </label>
            <div className="flex items-center gap-3">
              {[THEME_COLORS.PRIMARY, THEME_COLORS.SECONDARY, THEME_COLORS.ACCENT, THEME_COLORS.GOLD, '#0EA5E9', '#8B5CF6'].map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      accentColor === color ? 'scale-125 border-slate-900 dark:border-white shadow' : 'border-transparent'
                    }`}
                  />
                )
              )}
            </div>
          </div>

          {error && <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>}

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>צור קורס חדש</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
