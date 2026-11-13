/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { APP_CONFIG } from '../../config/constants';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="w-full border-t border-slate-200/80 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <strong>{APP_CONFIG.APP_NAME}</strong> · {APP_CONFIG.APP_SUBTITLE} · שנת לימודים {APP_CONFIG.ACADEMIC_YEAR}
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>גרסה {APP_CONFIG.VERSION}</span>
            <span>·</span>
            <span>סביבת הדגמה אקדמית</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
