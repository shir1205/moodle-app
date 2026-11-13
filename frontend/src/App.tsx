/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ROLES } from './config/constants';

// Pages
import { WelcomePage } from './pages/WelcomePage';
import { TwoFactorAuthPage } from './pages/TwoFactorAuthPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CreateCoursePage } from './pages/CreateCoursePage';
import { CreateAssignmentPage } from './pages/CreateAssignmentPage';
import { AssignmentDetailPage } from './pages/AssignmentDetailPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { LecturerDashboardPage } from './pages/LecturerDashboardPage';
import { AtRiskStudentsPage } from './pages/AtRiskStudentsPage';
import { CheckAssignmentsPage } from './pages/CheckAssignmentsPage';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminControlPage } from './pages/AdminControlPage';
import { ProfilePage } from './pages/ProfilePage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { MockInboxPage } from './pages/MockInboxPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Entrance / Welcome Screen */}
              <Route path="/" element={<AppLayout />}>
                <Route index element={<WelcomePage />} />
                <Route path="mock-inbox" element={<MockInboxPage />} />
                <Route path="verify" element={<VerifyEmailPage />} />
                <Route path="two-factor-setup" element={<TwoFactorAuthPage />} />
                <Route path="unauthorized" element={<UnauthorizedPage />} />

                {/* Authenticated Global Routes */}
                <Route
                  path="courses"
                  element={
                    <ProtectedRoute>
                      <CoursesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="courses/:courseId"
                  element={
                    <ProtectedRoute>
                      <CourseDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="courses/:courseId/assignments/:assignmentId"
                  element={
                    <ProtectedRoute>
                      <AssignmentDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="ai-assistant"
                  element={
                    <ProtectedRoute>
                      <AiAssistantPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />

                {/* Student Dedicated Routes */}
                <Route
                  path="submissions"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.ADMIN]}>
                      <MySubmissionsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.STUDENT, ROLES.ADMIN]}>
                      <StudentDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Course Creation - Admin Only */}
                <Route
                  path="admin/create-course"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                      <CreateCoursePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="lecturer/create-course"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                      <CreateCoursePage />
                    </ProtectedRoute>
                  }
                />

                {/* Lecturer & TA Dedicated Routes */}
                <Route
                  path="courses/:courseId/assignments/new"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.LECTURER, ROLES.ADMIN]}>
                      <CreateAssignmentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="courses/:courseId/assignments/:assignmentId/edit"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.LECTURER, ROLES.ADMIN]}>
                      <CreateAssignmentPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="lecturer/grading"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.LECTURER, ROLES.TA, ROLES.ADMIN]}>
                      <CheckAssignmentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="lecturer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.LECTURER, ROLES.ADMIN]}>
                      <LecturerDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="lecturer/at-risk"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.LECTURER, ROLES.ADMIN]}>
                      <AtRiskStudentsPage />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Dedicated Routes */}
                <Route
                  path="admin/users"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                      <AdminControlPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/control"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                      <AdminControlPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="admin/audit"
                  element={
                    <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                      <AdminControlPage />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
