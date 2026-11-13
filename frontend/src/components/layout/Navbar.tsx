/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ROLES, ROLE_LABELS } from '../../config/constants';
import {
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Users,
  Inbox,
  Menu,
  X,
  GraduationCap,
  Key,
} from 'lucide-react';
import { MockInboxModal } from '../common/MockInboxModal';
import { ForgotPasswordModal } from '../auth/ForgotPasswordModal';

export const Navbar: React.FC = () => {
  const { currentUser, role, unreadCount, logout, switchUser, allUsers } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [showSwitchMenu, setShowSwitchMenu] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleGoToLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (location.pathname === '/') {
      const authCard = document.getElementById('auth-card');
      if (authCard) {
        authCard.scrollIntoView({ behavior: 'smooth' });
        const emailInput = authCard.querySelector<HTMLInputElement>('input[type="email"]');
        if (emailInput) {
          setTimeout(() => emailInput.focus(), 300);
        }
      }
    } else {
      navigate('/?focus=login#auth-card');
    }
  };

  const handleQuickSwitch = (userId: string) => {
    switchUser(userId);
    setShowSwitchMenu(false);
    navigate('/');
  };

  // Role-specific nav links according to Scenario 3 & 4 and RBAC
  const getNavLinks = () => {
    if (role === ROLES.STUDENT) {
      return [
        { to: '/courses', label: 'הקורסים שלי' },
        { to: '/submissions', label: 'ההגשות שלי' },
        { to: '/dashboard', label: 'לוח ביצועים' },
        { to: '/ai-assistant', label: 'עוזר AI' },
        { to: '/notifications', label: 'התראות' },
      ];
    }
    if (role === ROLES.LECTURER) {
      return [
        { to: '/courses', label: 'הקורסים שלי' },
        { to: '/lecturer/grading', label: 'בדיקת מטלות' },
        { to: '/lecturer/dashboard', label: 'לוח מחוונים' },
        { to: '/lecturer/at-risk', label: 'סטודנטים בסיכון' },
        { to: '/notifications', label: 'התראות' },
      ];
    }
    if (role === ROLES.TA) {
      return [
        { to: '/courses', label: 'הקורסים שלי' },
        { to: '/lecturer/grading', label: 'בדיקת מטלות' },
        { to: '/notifications', label: 'התראות' },
      ];
    }
    if (role === ROLES.ADMIN) {
      return [
        { to: '/courses', label: 'כל הקורסים' },
        { to: '/admin/create-course', label: 'פתיחת קורס חדש' },
        { to: '/admin/users', label: 'ניהול משתמשים וקורסים' },
        { to: '/admin/control', label: 'בקרת אנליטיקה' },
        { to: '/admin/audit', label: 'יומן ביקורת' },
        { to: '/notifications', label: 'התראות' },
      ];
    }
    return [{ to: '/', label: 'עמוד הבית' }];
  };

  const navLinks = getNavLinks();

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-header border-b border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6 sm:gap-8">
          {/* Zone 1: Brand title wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-indigo-950 dark:text-white">CampuScope</span>
            </Link>

            {currentUser && (
              <span className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {ROLE_LABELS[currentUser.role]}
              </span>
            )}
          </div>

          {/* Zone 2: Role navigation links (single line, no wrapping) */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`whitespace-nowrap shrink-0 transition-colors py-1 relative ${
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: Actions (Bell with unread counter, theme toggle, quick user switch, user profile & logout) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            {/* Mock Email Inbox Inspector button */}
            <button
              onClick={() => setShowInboxModal(true)}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="תיבת דואר מדומה (אימיילים ואימותים)"
              aria-label="דואר מדומה"
            >
              <Inbox className="w-4 h-4" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={isDark ? 'מעבר למצב יום' : 'מעבר למצב לילה'}
              title={isDark ? 'מעבר למצב יום' : 'מעבר למצב לילה'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {currentUser ? (
              <>
                {/* Notification Bell with live unread counter */}
                <Link
                  to="/notifications"
                  className="relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={`התראות (${unreadCount} לא נקראו)`}
                  title="מרכז התראות"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 end-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600 rounded-full px-1 border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </Link>

                {/* Quick Role / User Switcher for seamless evaluation */}
                <div className="relative">
                  <button
                    onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
                    title="החלף משתמש לבדיקה מהירה"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="hidden md:inline">החלף משתמש</span>
                  </button>

                  {showSwitchMenu && (
                    <div className="absolute start-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        משתמשי הדגמה מהירים
                      </div>
                      {allUsers.slice(0, 6).map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleQuickSwitch(u.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-start text-xs transition-colors ${
                            currentUser.id === u.id
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <img
                            src={u.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80'}
                            alt={u.name}
                            className="w-6 h-6 rounded-full object-cover shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 truncate">
                            <div>{u.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {ROLE_LABELS[u.role]} · {u.email}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* User Profile Avatar & Name */}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 p-1 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  title="הפרופיל שלי"
                >
                  <img
                    src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80'}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                  <span className="hidden xl:inline font-semibold">{currentUser.name}</span>
                </Link>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  title="התנתק מהמערכת"
                  aria-label="התנתקות"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                {/* Key icon button for forgot password */}
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                  title="שכחתי סיסמה"
                  aria-label="שכחתי סיסמה"
                >
                  <Key className="w-4 h-4" />
                </button>

                {/* Login button that directly opens/focuses credentials input */}
                <button
                  type="button"
                  onClick={handleGoToLogin}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap shadow-sm"
                >
                  התחברות למערכת
                </button>
              </div>
            )}

            {/* Mobile menu hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="תפריט ניווט"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === link.to
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {currentUser && (
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                הפרופיל שלי ({currentUser.name})
              </Link>
            )}
          </div>
        )}
      </header>

      {/* Mock Inbox Modal */}
      <MockInboxModal isOpen={showInboxModal} onClose={() => setShowInboxModal(false)} />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </>
  );
};
