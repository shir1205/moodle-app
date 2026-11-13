/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Home } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-6 shadow-sm">
        <ShieldAlert className="w-9 h-9" />
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">
        אין לך הרשאה לצפות בעמוד זה
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-8 leading-relaxed">
        העמוד המבוקש מוגבל לתפקידים מורשים בלבד בהתאם למדיניות אבטחת המידע של המוסד האקדמי.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
      >
        <Home className="w-4 h-4" />
        <span>חזרה לדף הבית</span>
      </Link>
    </div>
  );
};
