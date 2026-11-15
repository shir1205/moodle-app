/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { UI_TIMINGS } from '../../config/constants';

interface CountdownTimerProps {
  dueDate: string;
  onExpire?: () => void;
  className?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ dueDate, onExpire, className = '' }) => {
  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>(() => calculateTimeLeft(dueDate));

  function calculateTimeLeft(dueIso: string) {
    const totalMs = new Date(dueIso).getTime() - Date.now();
    if (totalMs <= 0) {
      return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
    }
    const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((totalMs / 1000 / 60) % 60);
    const seconds = Math.floor((totalMs / 1000) % 60);
    return { totalMs, days, hours, minutes, seconds, isExpired: false };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      const updated = calculateTimeLeft(dueDate);
      setTimeLeft(updated);
      if (updated.isExpired) {
        clearInterval(timer);
        onExpire?.();
      }
    }, UI_TIMINGS.COUNTDOWN_TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [dueDate, onExpire]);

  if (timeLeft.isExpired) {
    return (
      <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-sm font-medium ${className}`}>
        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>מועד ההגשה חלף (החלון נעול)</span>
      </div>
    );
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium border ${
        isUrgent
          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800'
          : 'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-800'
      } ${className}`}
      aria-label="ספירה לאחור למועד ההגשה"
    >
      <Clock className={`w-4 h-4 shrink-0 ${isUrgent ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-indigo-600 dark:text-indigo-400'}`} />
      <span className="font-semibold">נותרו להגשה:</span>
      <div className="flex items-center gap-1.5 tabular-nums text-xs sm:text-sm">
        {timeLeft.days > 0 && (
          <span>
            <strong>{timeLeft.days}</strong> ימים
          </span>
        )}
        <span>
          <strong>{String(timeLeft.hours).padStart(2, '0')}</strong>:
          <strong>{String(timeLeft.minutes).padStart(2, '0')}</strong>:
          <strong>{String(timeLeft.seconds).padStart(2, '0')}</strong>
        </span>
      </div>
    </div>
  );
};
