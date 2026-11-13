/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StorageService } from '../../services/storage';
import { AuthService } from '../../services/authService';
import { Modal } from './Modal';
import { Mail, CheckCircle2, Clock, Trash2, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import confetti from 'canvas-confetti';

interface MockEmail {
  id: string;
  toUserId?: string;
  toEmail?: string;
  subject: string;
  body: string;
  verificationToken?: string;
  userId?: string;
  sentAt: string;
}

interface MockInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

export const MockInboxModal: React.FC<MockInboxModalProps> = ({ isOpen, onClose, onVerified }) => {
  const [emails, setEmails] = useState<MockEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadEmails = () => {
    const list = StorageService.get<MockEmail[]>(StorageService.keys.MOCK_INBOX, []);
    setEmails(list);
    if (list.length > 0 && !selectedEmail) {
      setSelectedEmail(list[0]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEmails();
    }
  }, [isOpen]);

  const handleVerifyLink = (userId: string) => {
    AuthService.verifyEmail(userId);
    showToast('החשבון אומת בהצלחה, אפשר להתחבר', 'success');
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {}
    onVerified?.();
    onClose();
    navigate('/');
  };

  const handleClearInbox = () => {
    StorageService.set(StorageService.keys.MOCK_INBOX, []);
    setEmails([]);
    setSelectedEmail(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="תיבת דואר מדומה (סימולציית שרת מיילים)" maxWidth="2xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span>הודעות דוא״ל הנשלחות מהמערכת (אימות הרשמה, ציונים חדשים, הודעות עידוד) מוצגות כאן לבדיקה</span>
          {emails.length > 0 && (
            <button
              onClick={handleClearInbox}
              className="text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>נקה תיבה</span>
            </button>
          )}
        </div>

        {emails.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">תיבת הדואר המדומה ריקה כרגע</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-h-[300px]">
            {/* Emails List */}
            <div className="md:col-span-2 border rounded-xl divide-y border-slate-200 dark:border-slate-800 overflow-y-auto max-h-80">
              {emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <button
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`w-full text-start p-3 transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-r-2 border-indigo-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {email.subject}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(email.sentAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Email Preview */}
            <div className="md:col-span-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              {selectedEmail ? (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                    {selectedEmail.subject}
                  </h4>
                  <div className="text-xs text-slate-400 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                    נשלח אל: {selectedEmail.toEmail || selectedEmail.toUserId} ·{' '}
                    {new Date(selectedEmail.sentAt).toLocaleString('he-IL')}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                    {selectedEmail.body}
                  </div>

                  {selectedEmail.verificationToken && selectedEmail.userId && (
                    <div className="mt-6 p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                      <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>קישור אימות חשבון פעיל:</span>
                      </div>
                      <button
                        onClick={() => handleVerifyLink(selectedEmail.userId!)}
                        className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow"
                      >
                        <span>לחץ/י כאן לאימות החשבון והתחברות</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">
                  בחר מייל לצפייה
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
